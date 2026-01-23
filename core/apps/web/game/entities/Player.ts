import * as Phaser from "phaser"

export type Direction = "up" | "down" | "left" | "right";

export class Player{
    sprite: Phaser.Physics.Arcade.Sprite;
    speed = 120;
    direction: Direction = "down";

    keys:{
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key; 
        up2: Phaser.Input.Keyboard.Key;
        down2: Phaser.Input.Keyboard.Key;
        left2: Phaser.Input.Keyboard.Key;
        right2: Phaser.Input.Keyboard.Key;
    };

    scene: Phaser.Scene;

    constructor(scene: Phaser.Scene, x:number, y:number){
        this.scene = scene

        // Creating the sprite
        this.sprite = scene.physics.add.sprite(x,y,"adam");
        this.sprite.setScale(2) //16px -> 32px

        this.sprite.body?.setSize(10,10)
        this.sprite.body?.setOffset(3,20)

        this.keys = scene.input.keyboard!.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,

            up2: Phaser.Input.Keyboard.KeyCodes.UP,
            down2: Phaser.Input.Keyboard.KeyCodes.DOWN,
            left2: Phaser.Input.Keyboard.KeyCodes.LEFT,
            right2: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        }) as any;

        // Start with idle down
        this.sprite.play("idle-down")
    }

    update(dt:number){
        let vx = 0;
        let vy = 0;

        this.sprite.setVelocity(0, 0);

        const left = this.keys.left.isDown || this.keys.left2.isDown
        const right = this.keys.right.isDown || this.keys.right2.isDown
        const up = this.keys.up.isDown || this.keys.up2.isDown
        const down = this.keys.down.isDown || this.keys.down2.isDown

        if(left){
            vx = -1;
            this.direction = "left"
        }else if(right){
            vx = 1
            this.direction = "right"
        }

        if(up){
            vy = -1
            this.direction = "up"
        }else if (down){
            vy = 1
            this.direction = "down"
        }

        // Normalise diagonal movement
        if(vx!=0 || vy!=0){
            const len = Math.sqrt(vx*vx + vy*vy)
            vx /= len
            vy /=len

            this.sprite.setVelocity(vx * this.speed, vy * this.speed);

            this.sprite.play(`walk-${this.direction}`, true)
        }
        else{
            this.sprite.play(`idle-${this.direction}`, true)
        }
    }
}