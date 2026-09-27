import * as Phaser from "phaser";
import { buildCollisionGrid, type CollisionGrid, type TiledMap } from "@repo/protocol/rules";
import type { RemoteUser, SpaceElement } from "@repo/protocol";
import type { Element, Me, SpaceDetail } from "@/lib/types";
import { Avatar, TILE } from "../entities/Avatar";
import { LocalPlayer } from "../entities/LocalPlayer";
import { NetworkManager, type ConnectionStatus } from "../network/NetworkManager";
import { BuildTool } from "../tools/BuildTool";

const MIN_ZOOM = 1.5;
const FALLBACK_MAP_URL = "/assets/maps/office/office.tmj";
// How quickly the camera catches up with the player (0-1 per frame)
const CAMERA_LERP = 0.1;

type TiledTileset = { name: string; image: string };

export type WorldSceneData = {
  space: SpaceDetail;
  me: Me;
  onStatus: (status: ConnectionStatus) => void;
  onPresence: (online: number) => void;
  // Build mode: persist a change through the API. Resolve with the saved placement / true, or null / false on failure.
  onPlace: (elementId: string, x: number, y: number) => Promise<SpaceElement | null>;
  onRemove: (spaceElementId: string) => Promise<boolean>;
  // Set by createGame: called at the end of create(), once the scene can take build-mode calls
  onCreated: (scene: WorldScene) => void;
};

export class WorldScene extends Phaser.Scene {
  // Not `data`: Phaser.Scene already uses that name for its DataManager
  private ctx!: WorldSceneData;
  private tiledMap: TiledMap | null = null;
  private spaceWidth = 0;
  private spaceHeight = 0;
  private grid!: CollisionGrid;
  private network!: NetworkManager;
  private player: LocalPlayer | null = null;
  private readonly remotes = new Map<string, Avatar>();
  // Furniture currently in the space, keyed by placement id
  private readonly placed = new Map<string, { data: SpaceElement; image: Phaser.GameObjects.Image }>();
  private buildMode = false;
  private buildTool: BuildTool | null = null;
  private busy = false;

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

    this.load.spritesheet("adam", "/assets/characters/adam.png", {
      frameWidth: 16,
      frameHeight: 32,
    });
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

    this.createAnimations();
    this.setUpCamera(map);
    this.setUpBuildInput();
    this.connect();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.network.close());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.network.close());
    this.ctx.onCreated(this);
  }

  update() {
    this.player?.update();
    this.buildTool?.update();
  }

  /* ---------- Build mode (called from React through the game controller) ---------- */

  setBuildMode(enabled: boolean) {
    this.buildMode = enabled;
    if (!enabled) void this.setBuildTool(null);
  }

  /** Selects the element to place (loading its image first if needed), or clears the selection with null. */
  async setBuildTool(element: Element | null) {
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
      if (!this.buildMode || this.busy) return;
      if (pointer.rightButtonDown()) void this.removeAt(pointer);
      else if (pointer.leftButtonDown()) void this.placeSelected();
    });
  }

  private async placeSelected() {
    const tool = this.buildTool;
    const element = tool?.selected;
    if (!tool || !element || !tool.target.fits) return;

    this.busy = true;
    const saved = await this.ctx.onPlace(element.id, tool.target.x, tool.target.y);
    this.busy = false;
    if (saved) this.addElement(saved);
  }

  private async removeAt(pointer: Phaser.Input.Pointer) {
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

    this.busy = true;
    const removed = await this.ctx.onRemove(hit);
    this.busy = false;
    if (removed) this.removeElement(hit);
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
    this.network = new NetworkManager(this.ctx.space.id, this.ctx.onStatus)
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
            (x, y) => this.grid.isWalkable(x, y),
            (x, y) => this.network.sendMove(x, y)
          );
          this.cameras.main.startFollow(this.player.sprite, true, CAMERA_LERP, CAMERA_LERP);
        }
        this.reportPresence();
      })
      .on("user-join", (user) => {
        // A known user re-joining (e.g. from another tab) just moves to their new spot
        const existing = this.remotes.get(user.userId);
        if (existing) existing.snapTo(user.x, user.y);
        else this.addRemote(user);
        this.reportPresence();
      })
      .on("movement", ({ userId, x, y }) => this.remotes.get(userId)?.moveTo(x, y))
      .on("movement-rejected", ({ x, y }) => this.player?.snapTo(x, y))
      .on("user-left", ({ userId }) => {
        this.remotes.get(userId)?.destroy();
        this.remotes.delete(userId);
        this.reportPresence();
      })
      .on("element-added", (placement) => void this.addElement(placement))
      .on("element-removed", ({ id }) => this.removeElement(id));

    this.network.connect();
  }

  private addRemote(user: RemoteUser) {
    this.remotes.set(user.userId, new Avatar(this, user.x, user.y, user.username));
  }

  private clearRemotes() {
    this.remotes.forEach((avatar) => avatar.destroy());
    this.remotes.clear();
  }

  private reportPresence() {
    this.ctx.onPresence(this.remotes.size + (this.player ? 1 : 0));
  }

  private setUpCamera(map: Phaser.Tilemaps.Tilemap) {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.centerOn(map.widthInPixels / 2, map.heightInPixels / 2);

    // Zoom in enough that the map always covers the viewport (no empty margins on big screens)
    const fitZoom = () =>
      cam.setZoom(Math.max(MIN_ZOOM, this.scale.width / map.widthInPixels, this.scale.height / map.heightInPixels));
    fitZoom();
    this.scale.on("resize", fitZoom);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", fitZoom));
  }

  private createAnimations() {
    const anims = this.anims;
    if (anims.exists("idle-down")) return;

    // Sprite sheet layout of /assets/characters/adam.png: idle frames 0-3, walk cycles of 6 from frame 48
    const idleFrames = { right: 0, up: 1, left: 2, down: 3 };
    const walkStart = { right: 48, up: 54, left: 60, down: 66 };

    for (const dir of ["right", "up", "left", "down"] as const) {
      anims.create({
        key: `idle-${dir}`,
        frames: [{ key: "adam", frame: idleFrames[dir] }],
        frameRate: 1,
        repeat: -1,
      });
      anims.create({
        key: `walk-${dir}`,
        frames: anims.generateFrameNumbers("adam", { start: walkStart[dir], end: walkStart[dir] + 5 }),
        frameRate: 10,
        // Loops while stepping tile to tile; Avatar switches back to idle when movement stops
        repeat: -1,
      });
    }
  }
}

const elementKey = (elementId: string) => `element:${elementId}`;
