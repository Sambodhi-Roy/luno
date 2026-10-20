import * as Phaser from "phaser";

// The parts of a Tiled map's JSON that describe tile animations (Phaser loads them but never plays them)
type AnimatedTiledMap = {
  tilesets: { firstgid: number; tiles?: { id: number; animation?: { tileid: number; duration: number }[] }[] }[];
};

// How often frames are checked; each animation still changes only when its own frame time is up
const TICK_MS = 50;

type Animation = { frames: number[]; durations: number[]; total: number; tiles: Phaser.Tilemaps.Tile[]; shown: number };

/**
 * Plays the tile animations defined in a Tiled map (water, waterfalls, ...). Every tile of one animation shows
 * the same frame, so all the water on a map ripples together.
 */
export function animateTiles(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap, tiled: AnimatedTiledMap) {
  // First frame's global id -> animation
  const byFirstFrame = new Map<number, Animation>();
  for (const tileset of tiled.tilesets) {
    for (const tile of tileset.tiles ?? []) {
      if (!tile.animation?.length) continue;
      const frames = tile.animation.map((f) => tileset.firstgid + f.tileid);
      const durations = tile.animation.map((f) => f.duration);
      const total = durations.reduce((sum, d) => sum + d, 0);
      byFirstFrame.set(tileset.firstgid + tile.id, { frames, durations, total, tiles: [], shown: 0 });
    }
  }
  if (byFirstFrame.size === 0) return;

  for (const layer of map.layers) {
    for (const row of layer.data) {
      for (const tile of row) byFirstFrame.get(tile.index)?.tiles.push(tile);
    }
  }
  const animations = [...byFirstFrame.values()].filter((a) => a.tiles.length > 0);
  if (animations.length === 0) return;

  const timer = scene.time.addEvent({
    delay: TICK_MS,
    loop: true,
    callback: () => {
      const now = scene.time.now;
      for (const anim of animations) {
        let t = now % anim.total;
        let frame = 0;
        while (t >= anim.durations[frame]!) t -= anim.durations[frame++]!;
        if (frame === anim.shown) continue;
        anim.shown = frame;
        for (const tile of anim.tiles) tile.index = anim.frames[frame]!;
      }
    },
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timer.remove());
}
