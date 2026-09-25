const { createAdmin, createUser } = require("../_helpers/auth.helper");
const { createAvatar } = require("../_helpers/admin.helper");
const {
  getAvatars,
  updateMetadata,
  getBulkMetadata,
} = require("../_helpers/user.helper");

jest.setTimeout(20000);

describe("Avatars", () => {
  let admin, avatarId;

  beforeAll(async () => {
    admin = await createAdmin();

    const r = await createAvatar(
      admin.token,
      "A1",
      "https://example.com/1.png"
    );

    expect(r.status).toBe(200);
    avatarId = r.data.avatarId;
  });

  test("Get avatars lists the recently created avatar", async () => {
    const res = await getAvatars();
    expect(res.status).toBe(200);
    expect(res.data.avatars.find((a) => a.id === avatarId)).toBeDefined();
  });

  test("Bulk metadata returns a user's avatar", async () => {
    const user = await createUser();
    await updateMetadata(user.token, avatarId);

    const res = await getBulkMetadata(user.token, [user.userId]);
    expect(res.status).toBe(200);
    expect(res.data.avatars.length).toBe(1);
    expect(res.data.avatars[0].userId).toBe(user.userId);
    expect(res.data.avatars[0].imageUrl).toBe("https://example.com/1.png");
  });
});
