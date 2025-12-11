const { createAdmin, createUser } = require("../_helpers/auth.helper");
const { createAvatar } = require("../_helpers/admin.helper");
const { updateMetadata } = require("../_helpers/user.helper");

jest.setTimeout(20000);

describe("User Metadata Endpoints", () => {
  let admin, user, avatarId;

  beforeAll(async () => {
    admin = await createAdmin();
    user = await createUser();

    const avatarRes = await createAvatar(
      admin.token,
      "Timmy",
      "https://example.com/a.png"
    );
    expect(avatarRes.status).toBe(200);
    avatarId = avatarRes.data.avatarId;
  });

  test("User can't update metadata with wrong avatar id", async () => {
    const res = await updateMetadata(user.token, "non-existent-id");
    expect(res.status).toBe(400);
  });

  test("User can update metadata with a valid avatar id", async () => {
    const res = await updateMetadata(user.token, avatarId);
    expect(res.status).toBe(200);
  });

  test("User can't update metadata without auth header", async () => {
    // call axios directly to not pass auth header
    const client = require("../_helpers/axios.client");
    const res = await client.post("/user/metadata", { avatarId });
    expect(res.status).toBe(403);
  });
});
