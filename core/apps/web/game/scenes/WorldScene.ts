import * as Phaser from "phaser";

export class WorldScene extends Phaser.Scene {
  constructor() {
    super("WorldScene");
    console.log("WorldScene constructor");
  }

  preload() {
    console.log("WorldScene preload()");
    this.load.tilemapTiledJSON("map", "/assets/maps/sample-map.tmj");
    this.load.image(
    "Room_Builder_free_32x32",
    "/assets/tilesets/Room_Builder_free_32x32.png"
  );

  this.load.image(
    "Interiors_free_32x32",
    "/assets/tilesets/Interiors_free_32x32.png"
  );
  }

  create() {
  console.log("WorldScene create()");

  const map = this.make.tilemap({ key: "map" });

  const roomBuilder = map.addTilesetImage("Sample2", "Room_Builder_free_32x32");
  const interiors = map.addTilesetImage("Sample", "Interiors_free_32x32");

  if (!roomBuilder || !interiors) {
    throw new Error("Tilesets not found. Check tileset names in Tiled.");
  }

  map.createLayer("Ground", [roomBuilder, interiors], 0, 0);
  map.createLayer("Walls", [roomBuilder, interiors], 0, 0);
  map.createLayer("Objects", [roomBuilder, interiors], 0, 0);

  const collisionLayer = map.createLayer("Collision", [roomBuilder, interiors], 0, 0);
  collisionLayer?.setVisible(false);

  const cam = this.cameras.main;

cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

cam.centerOn(
  map.widthInPixels / 2,
  map.heightInPixels / 2
);

}
}
