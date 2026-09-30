// Seeds the starter maps, furniture elements and avatars used by the web app.
// Idempotent: fixed ids are upserted, so it is safe to run repeatedly (`npx prisma db seed`).
// Image paths are served by apps/web from its public/ folder.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import client from "../src/index.js";

// Art lives in the private luno-assets repo, mounted at apps/web/public/assets (Pipoya's free 32x32 packs).
// Ids are kept across art swaps, so existing users, spaces and placements keep pointing at valid rows.
// Furniture comes from the assets repo's manifest (one entry per elements/<name>.png), so adding a piece there
// only needs a re-seed. Ids are seed-element-<name>; the first six names keep the ids placements already use.
const ELEMENTS_MANIFEST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/web/public/assets/elements/elements.json"
);
if (!existsSync(ELEMENTS_MANIFEST)) {
  throw new Error(`${ELEMENTS_MANIFEST} is missing: fetch the art with \`git submodule update --init\``);
}
const manifest = JSON.parse(readFileSync(ELEMENTS_MANIFEST, "utf8")) as {
  name: string;
  width: number;
  height: number;
  static: boolean;
}[];
const elements = manifest.map(({ name, ...size }) => ({
  id: `seed-element-${name}`,
  imageUrl: `/assets/elements/${name}.png`,
  ...size,
}));

// Width and height must match the size in tiles of each .tmj
const maps = [
  {
    id: "seed-map-office",
    name: "Office",
    width: 25,
    height: 25,
    thumbnail: "/assets/maps/office/thumbnail.png",
    tmjUrl: "/assets/maps/office/office.tmj",
    // Tile coordinates of each element's top-left corner, kept clear of the map's own walls and furniture
    defaults: [
      { elementId: "seed-element-palm", x: 10, y: 3 },
      { elementId: "seed-element-palm", x: 14, y: 3 },
      { elementId: "seed-element-bookshelf", x: 21, y: 12 },
      { elementId: "seed-element-table", x: 12, y: 15 },
      { elementId: "seed-element-chair", x: 11, y: 16 },
      { elementId: "seed-element-chair", x: 15, y: 16 },
      { elementId: "seed-element-plant", x: 22, y: 17 },
      { elementId: "seed-element-sofa", x: 12, y: 22 },
    ],
  },
  {
    id: "seed-map-village",
    name: "Village",
    width: 60,
    height: 60,
    thumbnail: "/assets/maps/village/thumbnail.png",
    tmjUrl: "/assets/maps/village/village.tmj",
    defaults: [],
  },
];

// "adam" stays the default avatar's id and file name (see DEFAULT_AVATAR_URL in apps/web/lib/avatars.ts)
// One per sheet in assets/characters (every human Pipoya character, first colour variant); the picker sorts by name
const AVATAR_NAMES = [
  "Adam", "Ari", "Ava", "Bea", "Bella", "Ben", "Casey", "Cleo", "Cody", "Dana", "Dora", "Eli", "Emma", "Evan",
  "Fay", "Fern", "Finn", "Gabe", "Gia", "Grant", "Gus", "Hana", "Hazel", "Helen", "Hugo", "Iris", "Ivan",
  "Jack", "Jade", "Jordan", "Kai", "Kira", "Leo", "Lily", "Luca", "Max", "Maya", "Mia", "Morgan", "Nina",
  "Noah", "Nora", "Olive", "Omar", "Owen", "Pete", "Pia", "Quinn", "Raj", "Riley", "Rosa", "Sam", "Sara",
  "Tess", "Theo", "Uma", "Vera", "Vic", "Wes", "Wren", "Zane", "Zoe",
];
const avatars = AVATAR_NAMES.map((name) => ({
  id: `seed-avatar-${name.toLowerCase()}`,
  name,
  imageUrl: `/assets/characters/${name.toLowerCase()}.png`,
}));

async function main() {
  for (const { id, ...data } of elements) {
    await client.element.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  for (const { id: mapId, defaults, ...mapData } of maps) {
    await client.map.upsert({ where: { id: mapId }, create: { id: mapId, ...mapData }, update: mapData });

    // Replace the defaults wholesale so edits to the lists above are reflected on re-seed
    await client.$transaction([
      client.mapElements.deleteMany({ where: { mapId } }),
      client.mapElements.createMany({ data: defaults.map((d) => ({ mapId, ...d })) }),
    ]);
  }

  for (const { id, ...data } of avatars) {
    await client.avatar.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  console.log(
    `Seeded ${elements.length} elements, ${maps.length} maps (${maps.map((m) => m.name).join(", ")}), ${avatars.length} avatars`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.$disconnect());
