import * as Phaser from "phaser";
import type { SpaceDetail } from "@/lib/types";
import { Player } from "../entities/Player";

const TILE = 32;
const MIN_ZOOM = 1.5;
const FALLBACK_MAP_URL = "/assets/maps/sample-map.tmj";

type TiledTileset = { name: string; image: string };

export class WorldScene extends Phaser.Scene {
  player!: Player;
  private space!: SpaceDetail;

  constructor() {
    super("WorldScene");
  }

  init(data: { space: SpaceDetail }) {
    this.space = data.space;
  }

  preload() {
    this.load.tilemapTiledJSON("map", this.space.tmjUrl ?? FALLBACK_MAP_URL);

    // Tileset image paths inside a .tmj point at the artist's folders, so load each one
    // from /assets/tilesets by file name, keyed by the tileset name used in Tiled
    this.load.once("filecomplete-tilemapJSON-map", () => {
      const tilesets: TiledTileset[] = this.cache.tilemap.get("map").data.tilesets;
      for (const ts of tilesets) {
        const fileName = ts.image.split("/").pop();
        this.load.image(ts.name, `/assets/tilesets/${fileName}`);
      }
    });

    for (const { element } of this.space.elements) {
      const key = elementKey(element.id);
      if (!this.textures.exists(key)) this.load.image(key, element.imageUrl);
    }

    this.load.spritesheet("adam", "/assets/characters/adam.png", {
      frameWidth: 16,
      frameHeight: 32,
    });
  }

  create() {
    const map = this.make.tilemap({ key: "map" });
    const tilesets = map.tilesets.map((ts) => map.addTilesetImage(ts.name, ts.name)!);

    const colliders: Phaser.Tilemaps.TilemapLayer[] = [];
    for (const layerData of map.layers) {
      const layer = map.createLayer(layerData.name, tilesets, 0, 0);
      if (!layer) continue;
      layer.setCollisionByProperty({ collides: true });
      // The "Collision" layer only marks blocked tiles; it isn't meant to be seen
      if (layerData.name === "Collision") layer.setVisible(false);
      colliders.push(layer);
    }

    const blockers = this.placeElements();

    this.createAnimations();

    this.player = new Player(this, map.widthInPixels / 2, map.heightInPixels / 2);
    this.player.sprite.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    for (const layer of colliders) this.physics.add.collider(this.player.sprite, layer);
    this.physics.add.collider(this.player.sprite, blockers);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.startFollow(this.player.sprite, true, 0.1, 0.1);

    // Zoom in enough that the map always covers the viewport (no empty margins on big screens)
    const fitZoom = () =>
      cam.setZoom(
        Math.max(MIN_ZOOM, this.scale.width / map.widthInPixels, this.scale.height / map.heightInPixels)
      );
    fitZoom();
    this.scale.on("resize", fitZoom);
    this.events.once("shutdown", () => this.scale.off("resize", fitZoom));
  }

  update() {
    this.player.update();
    // Draw the player in front of things above them and behind things below them
    this.player.sprite.setDepth(this.player.sprite.body!.bottom);
  }

  // Draws the space's elements and returns static bodies for the ones that block movement
  private placeElements() {
    const blockers = this.physics.add.staticGroup();

    for (const { element, x, y } of this.space.elements) {
      const px = x * TILE;
      const py = y * TILE;
      const w = element.width * TILE;
      const h = element.height * TILE;

      this.add
        .image(px, py, elementKey(element.id))
        .setOrigin(0, 0)
        .setDisplaySize(w, h)
        .setDepth(py + h);

      if (element.static) {
        // Only the bottom row blocks, so taller furniture can be walked behind (top-down perspective)
        const zone = this.add.zone(px, py + h - TILE, w, TILE).setOrigin(0, 0);
        blockers.add(zone);
      }
    }

    return blockers;
  }

  private createAnimations() {
    const anims = this.anims;
    if (anims.exists("idle-down")) return;

    anims.create({
      key: "idle-right",
      frames: [{ key: "adam", frame: 0 }],
      frameRate: 1,
      repeat: -1,
    });

    anims.create({
      key: "idle-up",
      frames: [{ key: "adam", frame: 1 }],
      frameRate: 1,
      repeat: -1,
    });

    anims.create({
      key: "idle-left",
      frames: [{ key: "adam", frame: 2 }],
      frameRate: 1,
      repeat: -1,
    });

    anims.create({
      key: "idle-down",
      frames: [{ key: "adam", frame: 3 }],
      frameRate: 1,
      repeat: -1,
    });

    anims.create({
      key: "walk-right",
      frames: anims.generateFrameNumbers("adam", { start: 48, end: 53 }),
      frameRate: 10,
      repeat: 0,
    });

    anims.create({
      key: "walk-up",
      frames: anims.generateFrameNumbers("adam", { start: 54, end: 59 }),
      frameRate: 10,
      repeat: 0,
    });

    anims.create({
      key: "walk-left",
      frames: anims.generateFrameNumbers("adam", { start: 60, end: 65 }),
      frameRate: 10,
      repeat: 0,
    });

    anims.create({
      key: "walk-down",
      frames: anims.generateFrameNumbers("adam", { start: 66, end: 71 }),
      frameRate: 10,
      repeat: 0,
    });
  }
}

const elementKey = (elementId: string) => `element:${elementId}`;
