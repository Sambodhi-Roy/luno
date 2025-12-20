const { createAdmin } = require("../_helpers/auth.helper");
const { createAvatar } = require("../_helpers/admin.helper");
const { getAvatars } = require("../_helpers/user.helper");

jest.setTimeout(20000);

describe("Avatars", () => {
  let admin;

  beforeAll(async () => {
    admin = await createAdmin();

    const r = await createAvatar(
      admin.token,
      "A1",
      "https://example.com/1.png"
    );

    expect(r.status).toBe(200);
  });

  test("Get avatars returns at least one avatar", async () => {
    const res = await getAvatars();
    expect(res.status).toBe(200);
    expect(res.data.avatars.length).toBeGreaterThan(0);
  });
});
