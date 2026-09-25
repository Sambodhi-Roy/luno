const { createUser, createAdmin } = require("../_helpers/auth.helper");
const { createElement, createMap } = require("../_helpers/admin.helper");
const {
  createSpace,
  deleteSpace,
  getSpace,
  getAllSpaces,
} = require("../_helpers/space.helper");

jest.setTimeout(30000);

describe("Space Integration", () => {
  let admin, user, mapId;

  beforeAll(async () => {
    admin = await createAdmin();
    user = await createUser();

    const e1 = await createElement(admin.token);
    const e2 = await createElement(admin.token);

    const mapRes = await createMap(admin.token, {
      dimensions: "100x200",
      defaultElements: [
        { elementId: e1.data.id, x: 20, y: 20 },
        { elementId: e2.data.id, x: 18, y: 20 },
        { elementId: e1.data.id, x: 19, y: 20 },
      ],
    });
    expect(mapRes.status).toBe(200);
    mapId = mapRes.data.id;
  });

  test("User can create an empty space with dimensions", async () => {
    const res = await createSpace(user.token, "MySpace", "100x200");
    expect(res.status).toBe(200);
    expect(res.data.spaceId).toBeDefined();
  });

  test("Creating a space from a map copies the map's default elements", async () => {
    const res = await createSpace(user.token, "FromMap", undefined, mapId);
    expect(res.status).toBe(200);
    expect(res.data.spaceId).toBeDefined();

    const space = await getSpace(user.token, res.data.spaceId);
    expect(space.status).toBe(200);
    expect(space.data.dimensions).toBe("100x200");
    expect(space.data.mapId).toBe(mapId);
    expect(space.data.elements.length).toBe(3);
  });

  test("Creating a space without dimensions or mapId fails", async () => {
    const res = await createSpace(user.token, "NoSize");
    expect(res.status).toBe(400);
  });

  test("Creating a space with an unknown mapId fails", async () => {
    const res = await createSpace(user.token, "BadMap", undefined, "no-such-map");
    expect(res.status).toBe(400);
  });

  test("User can delete own space", async () => {
    const created = await createSpace(user.token, "ToDelete", "100x200");
    const del = await deleteSpace(user.token, created.data.spaceId);
    expect(del.status).toBe(200);

    const after = await getSpace(user.token, created.data.spaceId);
    expect(after.status).toBe(404);
  });

  test("Deleting a space that does not exist returns 404", async () => {
    const del = await deleteSpace(user.token, "random-id-that-does-not-exist");
    expect(del.status).toBe(404);
  });

  test("User cannot delete a space created by another user", async () => {
    const created = await createSpace(user.token, "NotYours", "100x200");
    const del = await deleteSpace(admin.token, created.data.spaceId);
    expect(del.status).toBe(403);
  });

  test("Listing spaces returns only the caller's spaces", async () => {
    const before = await getAllSpaces(admin.token);
    expect(before.status).toBe(200);
    expect(before.data.spaces.length).toBe(0);

    const created = await createSpace(admin.token, "AdminSpace", "100x200");
    const after = await getAllSpaces(admin.token);
    expect(after.data.spaces.length).toBe(1);
    expect(after.data.spaces[0].id).toBe(created.data.spaceId);
  });
});
