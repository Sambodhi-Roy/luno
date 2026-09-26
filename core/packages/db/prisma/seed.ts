// Seeds the starter map, furniture elements and avatar used by the web app.
// Idempotent: fixed ids are upserted, so it is safe to run repeatedly (`npx prisma db seed`).
// Image paths are served by apps/web from its public/ folder.
import client from "../src/index.js";

const elements = [
  { id: "seed-element-plant", imageUrl: "/assets/elements/plant.png", width: 2, height: 2, static: true },
  { id: "seed-element-palm", imageUrl: "/assets/elements/palm.png", width: 2, height: 3, static: true },
  { id: "seed-element-bookshelf", imageUrl: "/assets/elements/bookshelf.png", width: 2, height: 3, static: true },
  { id: "seed-element-sofa", imageUrl: "/assets/elements/sofa.png", width: 3, height: 2, static: true },
  { id: "seed-element-table", imageUrl: "/assets/elements/table.png", width: 2, height: 3, static: true },
  { id: "seed-element-chair", imageUrl: "/assets/elements/chair.png", width: 1, height: 2, static: false },
];

const officeMap = {
  id: "seed-map-office",
  name: "Office",
  // Must match the tile size of sample-map.tmj
  width: 25,
  height: 25,
  thumbnail: "/assets/maps/sample-map.png",
  tmjUrl: "/assets/maps/sample-map.tmj",
};

// Tile coordinates of each element's top-left corner, kept clear of the map's own furniture
const officeDefaults = [
  { elementId: "seed-element-bookshelf", x: 2, y: 1 },
  { elementId: "seed-element-bookshelf", x: 5, y: 1 },
  { elementId: "seed-element-palm", x: 22, y: 1 },
  { elementId: "seed-element-sofa", x: 10, y: 5 },
  { elementId: "seed-element-table", x: 15, y: 8 },
  { elementId: "seed-element-chair", x: 14, y: 9 },
  { elementId: "seed-element-chair", x: 17, y: 9 },
  { elementId: "seed-element-plant", x: 1, y: 21 },
  { elementId: "seed-element-palm", x: 22, y: 21 },
];

const avatars = [
  { id: "seed-avatar-adam", name: "Adam", imageUrl: "/assets/characters/adam.png" },
];

async function main() {
  for (const { id, ...data } of elements) {
    await client.element.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  const { id: mapId, ...mapData } = officeMap;
  await client.map.upsert({ where: { id: mapId }, create: officeMap, update: mapData });

  // Replace the defaults wholesale so edits to the list above are reflected on re-seed
  await client.$transaction([
    client.mapElements.deleteMany({ where: { mapId } }),
    client.mapElements.createMany({
      data: officeDefaults.map((d) => ({ mapId, ...d })),
    }),
  ]);

  for (const { id, ...data } of avatars) {
    await client.avatar.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  console.log(
    `Seeded ${elements.length} elements, map "${officeMap.name}" with ${officeDefaults.length} defaults, ${avatars.length} avatar(s)`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.$disconnect());
