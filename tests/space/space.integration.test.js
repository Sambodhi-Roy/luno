const { createUser, createAdmin } = require("../_helpers/auth.helper");
const { createSpace, deleteSpace } = require("../_helpers/space.helper");

jest.setTimeout(20000);

describe("Space Integration", () => {
  let admin, user, spaceId;

  beforeAll(async () => {
    admin = await createAdmin();
    user = await createUser();
  });

  test("User can create space", async () => {
    const res = await createSpace(user.token, "MySpace", "100x200", undefined);
    expect(res.status).toBe(200);
    expect(res.data.spaceId).toBeDefined();
    spaceId = res.data.spaceId;
  });

  test("User can delete own space", async () => {
    const del = await deleteSpace(user.token, spaceId);
    expect(del.status).toBe(200);
  });
});
