const { createUser, createAdmin } = require("../_helpers/auth.helper");
const { createMap } = require("../_helpers/admin.helper");
const client = require("../_helpers/axios.client");

jest.setTimeout(20000);

describe("Maps", () => {
  let admin, user, mapId;

  beforeAll(async () => {
    admin = await createAdmin();
    user = await createUser();

    const res = await createMap(admin.token, { dimensions: "25x25" });
    mapId = res.data.id;
  });

  test("Signed-in users can list maps", async () => {
    const res = await client.get("/maps", {
      headers: { authorization: `Bearer ${user.token}` },
    });

    expect(res.status).toBe(200);
    const map = res.data.maps.find((m) => m.id === mapId);
    expect(map).toBeDefined();
    expect(map.dimensions).toBe("25x25");
    expect(map).toHaveProperty("thumbnail");
    expect(map).toHaveProperty("tmjUrl");
  });

  test("Listing maps requires a token", async () => {
    const res = await client.get("/maps");
    expect(res.status).toBe(401);
  });
});
