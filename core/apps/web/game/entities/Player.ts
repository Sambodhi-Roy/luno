import * as Phaser from "phaser"

export type Direction = "up" | "down" | "left" | "right";

export class Player{
    sprite: Phaser.GameObjects.Sprite;
    speed = 120;
    direction: Direction = "down";

    keys:{
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key; 
    };

    scene: Phaser.Scene;

    constructor(scene: Phaser.Scene, x:number, y:number){
        this.scene = scene

        // Creating the sprite
        this.sprite = scene.add.sprite(x,y,"adam");
        this.sprite.setScale(2) //16px -> 32px

        this.keys = scene.input.keyboard!.addKeys({
            up: "W",
            down: "S",
            left: "A",
            right: "D",
        }) as any;

        // Start with idle down
        this.sprite.play("idle-down")
    }

    update(dt:number){
        let vx = 0;
        let vy = 0;

        if(this.keys.left.isDown){
            vx = -1;
            this.direction = "left"
        }else if(this.keys.right.isDown){
            vx = 1
            this.direction = "right"
        }

        if(this.keys.up.isDown){
            vy = -1
            this.direction = "up"
        }else if (this.keys.down.isDown){
            vy = 1
            this.direction = "down"
        }

        // Normalise diagonal movement
        if(vx!=0 || vy!=0){
            const len = Math.sqrt(vx*vx + vy*vy)
            vx /= len
            vy /=len

            this.sprite.x += vx * this.speed*dt
            this.sprite.y += vy * this.speed*dt

            this.sprite.play(`walk-${this.direction}`, true)
        }
        else{
            this.sprite.play(`idle-${this.direction}`, true)
        }
    }
}