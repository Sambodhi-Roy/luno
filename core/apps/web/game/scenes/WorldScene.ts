import * as Phaser from "phaser";
import { buildCollisionGrid, type CollisionGrid, type TiledMap } from "@repo/protocol/rules";
import type { RemoteUser, SpaceElement } from "@repo/protocol";
import { DEFAULT_AVATAR_URL } from "@/lib/avatars";
import type { Element, Me, SpaceDetail } from "@/lib/types";
import { animKey, Avatar, TILE } from "../entities/Avatar";
import { LocalPlayer } from "../entities/LocalPlayer";
import { NetworkManager, type ConnectionStatus } from "../network/NetworkManager";
import { BuildTool } from "../tools/BuildTool";

const MIN_ZOOM = 1.5;
const FALLBACK_MAP_URL = "/assets/maps/office/office.tmj";
// Used for anyone without an avatar, and when an avatar's sheet fails to load
const DEFAULT_CHARACTER_URL = DEFAULT_AVATAR_URL;
// Every character sheet shares this layout (Pipoya / RPG Maker): 32x32 frames, 3 per row, one row per direction.
// The middle frame is the standing pose; walking steps through left foot, standing, right foot, standing.
const CHARACTER_FRAME = { frameWidth: 32, frameHeight: 32 };
const FRAMES_PER_ROW = 3;
const DIRECTION_ROW = { down: 0, left: 1, right: 2, up: 3 };
const WALK_CYCLE = [0, 1, 2, 1];
// How quickly the camera catches up with the player (0-1 per frame)
const CAMERA_LERP = 0.1;
// Editor camera: how far past the fitted zoom the wheel can zoom in, each wheel notch, and key pan speed
const EDITOR_MAX_ZOOM_FACTOR = 3;
const EDITOR_ZOOM_STEP = 1.1;
const EDITOR_PAN_PX_PER_SEC = 600;

type TiledTileset = { name: string; image: string };

// Playing: walk around with everyone else over the WebSocket
export type PlayModeData = {
  mode: "play";
  onStatus: (status: ConnectionStatus) => void;
  onPresence: (online: number) => void;
};

// Editing (the owner's editor page): no avatar or connection, a free camera, and furniture placement
export type EditModeData = {
  mode: "edit";
  // Persist a change through the API. Resolve with the saved placement / true, or null / false on failure.
  onPlace: (elementId: string, x: number, y: number) => Promise<SpaceElement | null>;
  // `undo` puts the same piece back in the same spot, for an Undo button
  onRemove: (placement: SpaceElement, undo: () => void) => Promise<boolean>;
};

// What React passes to createGame. onLoadProgress reports asset loading from 0 to 1.
export type GameOptions = { space: SpaceDetail; me: Me; onLoadProgress?: (progress: number) => void } & (
  | PlayModeData
  | EditModeData
);

export type WorldSceneData = GameOptions & {
  // Set by createGame: called at the end of create(), once the scene can take build-tool calls
  onCreated: (scene: WorldScene) => void;
};

export class WorldScene extends Phaser.Scene {
  // Not `data`: Phaser.Scene already uses that name for its DataManager
  private ctx!: WorldSceneData;
  private tiledMap: TiledMap | null = null;
  private spaceWidth = 0;
  private spaceHeight = 0;
  private grid!: CollisionGrid;
  private network: NetworkManager | null = null;
  private player: LocalPlayer | null = null;
  private readonly remotes = new Map<string, Avatar>();
  // Players whose character sheet is still loading, kept up to date until their Avatar can be drawn
  private readonly pendingRemotes = new Map<string, RemoteUser>();
  // One load per character sheet, shared by everyone wearing it
  private readonly characterLoads = new Map<string, Promise<string>>();
  // Furniture currently in the space, keyed by placement id
  private readonly placed = new Map<string, { data: SpaceElement; image: Phaser.GameObjects.Image }>();
  private buildTool: BuildTool | null = null;
  private busy = false;
  // Smallest zoom at which the map still covers the viewport
  private fitZoom = MIN_ZOOM;
  private panKeys: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key[]> | null = null;

  constructor() {
    super("WorldScene");
  }

  init(data: WorldSceneData) {
    this.ctx = data;
  }

  preload() {
    const { space } = this.ctx;
    const mapUrl = space.tmjUrl ?? FALLBACK_MAP_URL;
    this.load.tilemapTiledJSON("map", mapUrl);

    // Tileset image paths inside a .tmj point at the artist's folders, so each image is loaded by file name
    // from the folder the .tmj lives in, keyed by the tileset name used in Tiled
    this.load.once("filecomplete-tilemapJSON-map", () => {
      const tilesets: TiledTileset[] = this.cache.tilemap.get("map").data.tilesets;
      const mapFolder = mapUrl.slice(0, mapUrl.lastIndexOf("/") + 1);
      for (const ts of tilesets) {
        const fileName = ts.image.split("/").pop();
        this.load.image(ts.name, `${mapFolder}${fileName}`);
      }
    });

    for (const { element } of space.elements) {
      const key = elementKey(element.id);
      if (!this.textures.exists(key)) this.load.image(key, element.imageUrl);
    }

    // The default character, plus ours so we appear straight away; other players' sheets load as they join
    this.load.spritesheet(characterKey(DEFAULT_CHARACTER_URL), DEFAULT_CHARACTER_URL, CHARACTER_FRAME);
    const mine = this.ctx.me.avatar?.imageUrl;
    if (mine) this.load.spritesheet(characterKey(mine), mine, CHARACTER_FRAME);

    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => this.ctx.onLoadProgress?.(progress));
  }

  create() {
    const { space } = this.ctx;
    const map = this.make.tilemap({ key: "map" });
    const tilesets = map.tilesets.map((ts) => map.addTilesetImage(ts.name, ts.name)!);

    for (const layerData of map.layers) {
      const layer = map.createLayer(layerData.name, tilesets, 0, 0);
      // The "Collision" layer only marks blocked tiles; it isn't meant to be seen
      if (layer && layerData.name === "Collision") layer.setVisible(false);
    }

    [this.spaceWidth, this.spaceHeight] = space.dimensions.split("x").map(Number) as [number, number];
    this.tiledMap = space.tmjUrl ? (this.cache.tilemap.get("map").data as TiledMap) : null;
    for (const placement of space.elements) this.drawElement(placement);
    this.rebuildGrid();

    this.ctx.onLoadProgress?.(1);
    this.load.off(Phaser.Loader.Events.PROGRESS);
    for (const key of this.textures.getTextureKeys()) {
      if (key.startsWith(CHARACTER_PREFIX)) this.createCharacterAnimations(key);
    }
    this.setUpCamera(map);

    if (this.ctx.mode === "play") {
      this.connect();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.network?.close());
      this.events.once(Phaser.Scenes.Events.DESTROY, () => this.network?.close());
    } else {
      this.setUpEditorCamera();
      this.setUpBuildInput();
    }

    this.ctx.onCreated(this);
  }

  update(_time: number, delta: number) {
    this.player?.update();
    this.buildTool?.update();
    this.panWithKeys(delta);
  }

  /**
   * Stops (or resumes) reading the keyboard, e.g. while a dialog is open over the game, so typing doesn't move
   * the player and the browser gets the keys back.
   */
  setKeyboardEnabled(enabled: boolean) {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.enabled = enabled;
    if (enabled) {
      keyboard.enableGlobalCapture();
    } else {
      keyboard.disableGlobalCapture();
      // Otherwise a key held when the dialog opened stays "down"
      keyboard.resetKeys();
    }
  }

  /* ---------- Editing (called from React through the game controller) ---------- */

  /** Selects the element to place (loading its image first if needed), or clears the selection with null. */
  async setBuildTool(element: Element | null) {
    if (this.ctx.mode !== "edit") return;
    if (!this.buildTool) {
      this.buildTool = new BuildTool(this, this.spaceWidth, this.spaceHeight, (el) => elementKey(el.id));
    }
    if (element) await this.ensureTexture(element);
    this.buildTool.select(element);
  }

  private setUpBuildInput() {
    // Right-click removes furniture, so keep the browser menu out of the way
    this.input.mouse?.disableContextMenu();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (this.busy) return;
      if (pointer.rightButtonDown()) void this.removeAt(pointer);
      else if (pointer.leftButtonDown()) void this.placeSelected();
    });
  }

  private async placeSelected() {
    const tool = this.buildTool;
    const element = tool?.selected;
    if (this.ctx.mode !== "edit" || !tool || !element || !tool.target.fits) return;

    this.busy = true;
    const saved = await this.ctx.onPlace(element.id, tool.target.x, tool.target.y);
    this.busy = false;
    if (saved) this.addElement(saved);
  }

  private async removeAt(pointer: Phaser.Input.Pointer) {
    if (this.ctx.mode !== "edit") return;
    const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    // Topmost (highest depth) furniture under the pointer
    let hit: string | null = null;
    let hitDepth = -Infinity;
    for (const [id, { image }] of this.placed) {
      if (image.getBounds().contains(world.x, world.y) && image.depth > hitDepth) {
        hit = id;
        hitDepth = image.depth;
      }
    }
    if (!hit) return;

    const placement = this.placed.get(hit)!.data;
    this.busy = true;
    const removed = await this.ctx.onRemove(placement, () => void this.restoreElement(placement));
    this.busy = false;
    if (removed) this.removeElement(hit);
  }

  /** Undo for a removal: saves the piece again at its old spot (as a new placement) and draws it. */
  private async restoreElement({ element, x, y }: SpaceElement) {
    if (this.ctx.mode !== "edit") return;
    const saved = await this.ctx.onPlace(element.id, x, y);
    if (saved && this.sys.isActive()) void this.addElement(saved);
  }

  /* ---------- Furniture ---------- */

  /** Adds placed furniture (from the API response or a broadcast; the second copy is ignored). */
  private async addElement(placement: SpaceElement) {
    if (this.placed.has(placement.id)) return;
    await this.ensureTexture(placement.element);
    if (this.placed.has(placement.id)) return;
    this.drawElement(placement);
    this.rebuildGrid();
  }

  private removeElement(id: string) {
    const entry = this.placed.get(id);
    if (!entry) return;
    entry.image.destroy();
    this.placed.delete(id);
    this.rebuildGrid();
  }

  private drawElement(placement: SpaceElement) {
    const { element, x, y } = placement;
    const px = x * TILE;
    const py = y * TILE;
    const w = element.width * TILE;
    const h = element.height * TILE;

    // Depth = bottom edge, so characters standing below draw in front and those above draw behind
    const image = this.add.image(px, py, elementKey(element.id)).setOrigin(0, 0).setDisplaySize(w, h).setDepth(py + h);
    this.placed.set(placement.id, { data: placement, image });
  }

  /** Loads an element's image if this scene hasn't seen that element before. */
  private ensureTexture(element: { id: string; imageUrl: string }) {
    const key = elementKey(element.id);
    if (this.textures.exists(key)) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.load.image(key, element.imageUrl);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
  }

  // Same rules the server enforces, so predicted steps are almost never rejected
  private rebuildGrid() {
    this.grid = buildCollisionGrid(
      this.spaceWidth,
      this.spaceHeight,
      this.tiledMap,
      [...this.placed.values()].map(({ data: { x, y, element } }) => ({ x, y, ...element }))
    );
  }

  /* ---------- Multiplayer ---------- */

  private connect() {
    if (this.ctx.mode !== "play") return;
    const network = new NetworkManager(this.ctx.space.id, this.ctx.onStatus);
    this.network = network;
    network
      .on("space-joined", ({ spawn, users }) => {
        // Also runs after a reconnect: start from the server's view of the room
        this.clearRemotes();
        users.forEach((u) => this.addRemote(u));

        if (this.player) {
          this.player.snapTo(spawn.x, spawn.y);
        } else {
          this.player = new LocalPlayer(
            this,
            spawn.x,
            spawn.y,
            this.ctx.me.username,
            this.loadedCharacterKey(this.ctx.me.avatar?.imageUrl ?? null),
            (x, y) => this.grid.isWalkable(x, y),
            (x, y) => network.sendMove(x, y)
          );
          this.cameras.main.startFollow(this.player.sprite, true, CAMERA_LERP, CAMERA_LERP);
        }
        this.reportPresence();
      })
      .on("user-join", (user) => {
        // A known user re-joining (e.g. from another tab) just moves to their new spot, unless they changed
        // avatar, in which case they're redrawn
        const existing = this.remotes.get(user.userId);
        if (existing && existing.textureKey === characterKey(user.avatarUrl ?? DEFAULT_CHARACTER_URL)) {
          existing.snapTo(user.x, user.y);
        } else {
          this.removeRemote(user.userId);
          this.addRemote(user);
        }
        this.reportPresence();
      })
      .on("movement", ({ userId, x, y }) => {
        const pending = this.pendingRemotes.get(userId);
        if (pending) this.pendingRemotes.set(userId, { ...pending, x, y });
        else this.remotes.get(userId)?.moveTo(x, y);
      })
      .on("movement-rejected", ({ x, y }) => this.player?.snapTo(x, y))
      .on("user-left", ({ userId }) => {
        this.removeRemote(userId);
        this.reportPresence();
      })
      .on("element-added", (placement) => void this.addElement(placement))
      .on("element-removed", ({ id }) => this.removeElement(id));

    network.connect();
  }

  /** Draws another player once their character sheet has loaded (usually at once: it's cached). */
  private addRemote(user: RemoteUser) {
    this.pendingRemotes.set(user.userId, user);
    void this.ensureCharacter(user.avatarUrl).then((key) => {
      // Their latest position. Skip if they left while the sheet loaded, or re-joined wearing another avatar
      // (that join draws them instead).
      const latest = this.pendingRemotes.get(user.userId);
      if (!latest || latest.avatarUrl !== user.avatarUrl || !this.sys.isActive()) return;
      this.pendingRemotes.delete(user.userId);
      this.remotes.set(user.userId, new Avatar(this, latest.x, latest.y, latest.username, key));
    });
  }

  private removeRemote(userId: string) {
    this.pendingRemotes.delete(userId);
    this.remotes.get(userId)?.destroy();
    this.remotes.delete(userId);
  }

  private clearRemotes() {
    this.remotes.forEach((avatar) => avatar.destroy());
    this.remotes.clear();
    this.pendingRemotes.clear();
  }

  private reportPresence() {
    if (this.ctx.mode !== "play") return;
    this.ctx.onPresence(this.remotes.size + this.pendingRemotes.size + (this.player ? 1 : 0));
  }

  /* ---------- Character sheets ---------- */

  /** Texture key of a sheet that's already loaded, or the default character's. */
  private loadedCharacterKey(url: string | null) {
    const key = characterKey(url ?? DEFAULT_CHARACTER_URL);
    return this.textures.exists(key) ? key : characterKey(DEFAULT_CHARACTER_URL);
  }

  /** Loads a character sheet and its animations if needed; resolves with the texture key to draw with. */
  private ensureCharacter(url: string | null) {
    if (!url) return Promise.resolve(characterKey(DEFAULT_CHARACTER_URL));
    const key = characterKey(url);
    if (this.textures.exists(key)) return Promise.resolve(key);

    let load = this.characterLoads.get(key);
    if (!load) {
      load = new Promise<string>((resolve) => {
        const done = () => {
          this.load.off(`filecomplete-spritesheet-${key}`, done);
          this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
          if (this.textures.exists(key)) {
            this.createCharacterAnimations(key);
            resolve(key);
          } else {
            resolve(characterKey(DEFAULT_CHARACTER_URL));
          }
        };
        const failed = (file: Phaser.Loader.File) => {
          if (file.key === key) done();
        };
        this.load.on(`filecomplete-spritesheet-${key}`, done);
        this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
        this.load.spritesheet(key, url, CHARACTER_FRAME);
        this.load.start();
      });
      this.characterLoads.set(key, load);
    }
    return load;
  }

  private setUpCamera(map: Phaser.Tilemaps.Tilemap) {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.centerOn(map.widthInPixels / 2, map.heightInPixels / 2);

    // Zoom in enough that the map always covers the viewport (no empty margins on big screens).
    // The editor may be zoomed in further, so only raise the zoom when it falls below the fit.
    const fit = () => {
      this.fitZoom = Math.max(MIN_ZOOM, this.scale.width / map.widthInPixels, this.scale.height / map.heightInPixels);
      cam.setZoom(Math.max(this.ctx.mode === "edit" ? cam.zoom : 0, this.fitZoom));
    };
    fit();
    this.scale.on("resize", fit);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", fit));
  }

  /* ---------- Editor camera: wheel to zoom, WASD / arrows or middle-drag to pan ---------- */

  private setUpEditorCamera() {
    const cam = this.cameras.main;

    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const next = dy > 0 ? cam.zoom / EDITOR_ZOOM_STEP : cam.zoom * EDITOR_ZOOM_STEP;
      cam.setZoom(Phaser.Math.Clamp(next, this.fitZoom, this.fitZoom * EDITOR_MAX_ZOOM_FACTOR));
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!pointer.middleButtonDown()) return;
      cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
      cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
    });

    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const keys = (...codes: number[]) => codes.map((code) => keyboard.addKey(code, false));
    const { W, A, S, D, UP, DOWN, LEFT, RIGHT } = Phaser.Input.Keyboard.KeyCodes;
    this.panKeys = { up: keys(W, UP), down: keys(S, DOWN), left: keys(A, LEFT), right: keys(D, RIGHT) };
  }

  private panWithKeys(deltaMs: number) {
    if (!this.panKeys) return;
    const held = (dir: keyof NonNullable<typeof this.panKeys>) => this.panKeys![dir].some((k) => k.isDown);
    const cam = this.cameras.main;
    const step = (EDITOR_PAN_PX_PER_SEC * deltaMs) / 1000 / cam.zoom;
    cam.scrollX += (Number(held("right")) - Number(held("left"))) * step;
    cam.scrollY += (Number(held("down")) - Number(held("up"))) * step;
  }

  private createCharacterAnimations(key: string) {
    const anims = this.anims;
    if (anims.exists(animKey(key, "idle-down"))) return;

    for (const dir of ["right", "up", "left", "down"] as const) {
      const first = DIRECTION_ROW[dir] * FRAMES_PER_ROW;
      anims.create({
        key: animKey(key, `idle-${dir}`),
        frames: [{ key, frame: first + 1 }],
        frameRate: 1,
        repeat: -1,
      });
      anims.create({
        key: animKey(key, `walk-${dir}`),
        frames: anims.generateFrameNumbers(key, { frames: WALK_CYCLE.map((i) => first + i) }),
        frameRate: 8,
        // Loops while stepping tile to tile; Avatar switches back to idle when movement stops
        repeat: -1,
      });
    }
  }
}

const elementKey = (elementId: string) => `element:${elementId}`;
const CHARACTER_PREFIX = "character:";
const characterKey = (url: string) => `${CHARACTER_PREFIX}${url}`;
