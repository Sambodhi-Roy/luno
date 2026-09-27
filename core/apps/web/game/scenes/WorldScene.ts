import * as Phaser from "phaser";
import { buildCollisionGrid, type CollisionGrid, type TiledMap } from "@repo/protocol/rules";
import type { RemoteUser } from "@repo/protocol";
import type { Me, SpaceDetail } from "@/lib/types";
import { Avatar, TILE } from "../entities/Avatar";
import { LocalPlayer } from "../entities/LocalPlayer";
import { NetworkManager, type ConnectionStatus } from "../network/NetworkManager";

const MIN_ZOOM = 1.5;
const FALLBACK_MAP_URL = "/assets/maps/sample-map.tmj";
// How quickly the camera catches up with the player (0-1 per frame)
const CAMERA_LERP = 0.1;

type TiledTileset = { name: string; image: string };

export type WorldSceneData = {
  space: SpaceDetail;
  me: Me;
  onStatus: (status: ConnectionStatus) => void;
  onPresence: (online: number) => void;
};

export class WorldScene extends Phaser.Scene {
  // Not `data`: Phaser.Scene already uses that name for its DataManager
  private ctx!: WorldSceneData;
  private grid!: CollisionGrid;
  private network!: NetworkManager;
  private player: LocalPlayer | null = null;
  private readonly remotes = new Map<string, Avatar>();

  constructor() {
    super("WorldScene");
  }

  init(data: WorldSceneData) {
    this.ctx = data;
  }

  preload() {
    const { space } = this.ctx;
    this.load.tilemapTiledJSON("map", space.tmjUrl ?? FALLBACK_MAP_URL);

    // Tileset image paths inside a .tmj point at the artist's folders, so load each one
    // from /assets/tilesets by file name, keyed by the tileset name used in Tiled
    this.load.once("filecomplete-tilemapJSON-map", () => {
      const tilesets: TiledTileset[] = this.cache.tilemap.get("map").data.tilesets;
      for (const ts of tilesets) {
        const fileName = ts.image.split("/").pop();
        this.load.image(ts.name, `/assets/tilesets/${fileName}`);
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

    this.placeElements();
    this.createAnimations();

    // Same rules the server enforces, so predicted steps are almost never rejected
    const [width, height] = space.dimensions.split("x").map(Number) as [number, number];
    const tiledMap = space.tmjUrl ? (this.cache.tilemap.get("map").data as TiledMap) : null;
    this.grid = buildCollisionGrid(
      width,
      height,
      tiledMap,
      space.elements.map(({ x, y, element }) => ({ x, y, ...element }))
    );

    this.setUpCamera(map);
    this.connect();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.network.close());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.network.close());
  }

  update() {
    this.player?.update();
  }

  private connect() {
    this.network = new NetworkManager(this.ctx.space.id, this.ctx.onStatus)
      .on("space-joined", ({ spawn, users }) => {
        // Also runs after a reconnect: start from the server's view of the room
        this.clearRemotes();
        users.forEach((u) => this.addRemote(u));

        if (this.player) {
          this.player.snapTo(spawn.x, spawn.y);
        } else {
          this.player = new LocalPlayer(this, spawn.x, spawn.y, this.ctx.me.username, this.grid, (x, y) =>
            this.network.sendMove(x, y)
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
      });

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

  private placeElements() {
    for (const { element, x, y } of this.ctx.space.elements) {
      const px = x * TILE;
      const py = y * TILE;
      const w = element.width * TILE;
      const h = element.height * TILE;

      // Depth = bottom edge, so characters standing below draw in front and those above draw behind
      this.add.image(px, py, elementKey(element.id)).setOrigin(0, 0).setDisplaySize(w, h).setDepth(py + h);
    }
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
