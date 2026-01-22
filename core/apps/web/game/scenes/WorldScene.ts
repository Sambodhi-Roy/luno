import * as Phaser from "phaser";
import { Player } from "../entities/Player";

export class WorldScene extends Phaser.Scene {
  player!: Player

  constructor() {
    super("WorldScene");
    console.log("WorldScene constructor");
  }

  preload() {
    console.log("WorldScene preload()");
    this.load.tilemapTiledJSON("map", "/assets/maps/sample-map.tmj");
    this.load.image(
    "Room_Builder_free_32x32",
    "/assets/tilesets/Room_Builder_free_32x32.png")
    
    this.load.image(
      "Interiors_free_32x32",
      "/assets/tilesets/Interiors_free_32x32.png"
    );

    this.load.spritesheet("adam","/assets/characters/adam.png",{
      frameWidth: 16,
      frameHeight: 32,
    })
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

    this.createAnimations();

    this.player = new Player(this, map.widthInPixels/2, map.heightInPixels/2);

    const cam = this.cameras.main;

    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    cam.centerOn(
    map.widthInPixels / 2,
    map.heightInPixels / 2
    );
  }

  update(_:number, delta: number){
    const dt = delta/1000
    this.player.update(dt)
  }

  private createAnimations(){
    const anims = this.anims;

    anims.create({
      key: "idle-right",
      frames:[{key: "adam", frame:0}],
      frameRate:1,
      repeat: -1,
    })
    
    anims.create({
      key: "idle-up",
      frames:[{key: "adam", frame:1}],
      frameRate:1,
      repeat: -1,
    })

    anims.create({
      key: "idle-left",
      frames:[{key: "adam", frame:2}],
      frameRate:1,
      repeat: -1,
    })

    anims.create({
      key: "idle-down",
      frames:[{key: "adam", frame:3}],
      frameRate:1,
      repeat: -1,
    })
  }
}
