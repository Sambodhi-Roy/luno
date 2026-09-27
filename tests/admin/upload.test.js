const fs = require("fs");
const path = require("path");
const { createUser, createAdmin } = require("../_helpers/auth.helper");
const { uploadImage, uploadMap } = require("../_helpers/admin.helper");

jest.setTimeout(30000);

// Uploads land in the web app's public folder, served at /uploads/...
const WEB_PUBLIC = path.resolve(__dirname, "../../core/apps/web/public");
const OFFICE = path.join(WEB_PUBLIC, "assets/maps/office");
const readAsset = (...parts) => fs.readFileSync(path.join(...parts));
const diskPath = (url) => path.join(WEB_PUBLIC, url);

describe("Admin uploads", () => {
  let admin, user;
  const created = [];

  beforeAll(async () => {
    admin = await createAdmin();
    user = await createUser();
  });

  // Don't leave test files in the uploads folder
  afterAll(() => {
    for (const p of created) fs.rmSync(p, { recursive: true, force: true });
  });

  const png = readAsset(WEB_PUBLIC, "assets/elements/chair.png");

  test("Normal users cannot upload", async () => {
    const res = await uploadImage(user.token, "element", png);
    expect(res.status).toBe(403);
  });

  test("Files that aren't PNGs are rejected", async () => {
    const res = await uploadImage(admin.token, "element", Buffer.from("not an image"), "fake.png");
    expect(res.status).toBe(400);
  });

  test("An unknown kind is rejected", async () => {
    const res = await uploadImage(admin.token, "wallpaper", png);
    expect(res.status).toBe(400);
  });

  test("A PNG is saved and its public URL returned", async () => {
    const res = await uploadImage(admin.token, "element", png);
    expect(res.status).toBe(200);
    expect(res.data.url).toMatch(/^\/uploads\/elements\/[\w-]+\.png$/);

    const file = diskPath(res.data.url);
    created.push(file);
    expect(fs.readFileSync(file).equals(png)).toBe(true);
  });

  const tmj = readAsset(OFFICE, "office.tmj");
  const tilesets = ["Room_Builder_free_32x32.png", "Interiors_free_32x32.png"].map((name) => ({
    name,
    data: readAsset(OFFICE, name),
  }));

  test("A map missing one of its tileset images is rejected", async () => {
    const res = await uploadMap(admin.token, tmj, tilesets.slice(0, 1));
    expect(res.status).toBe(400);
    expect(res.data.message).toContain("Interiors_free_32x32.png");
  });

  test("A file that isn't a Tiled map is rejected", async () => {
    const res = await uploadMap(admin.token, Buffer.from(JSON.stringify({ hello: "world" })), tilesets);
    expect(res.status).toBe(400);
  });

  test("A valid map is saved next to its tilesets", async () => {
    const res = await uploadMap(admin.token, tmj, tilesets);
    expect(res.status).toBe(200);
    expect(res.data.width).toBe(25);
    expect(res.data.height).toBe(25);
    expect(res.data.tmjUrl).toMatch(/^\/uploads\/maps\/[\w-]+\/map\.tmj$/);

    const folder = path.dirname(diskPath(res.data.tmjUrl));
    created.push(folder);
    expect(fs.existsSync(path.join(folder, "map.tmj"))).toBe(true);
    for (const { name } of tilesets) expect(fs.existsSync(path.join(folder, name))).toBe(true);
  });
});
