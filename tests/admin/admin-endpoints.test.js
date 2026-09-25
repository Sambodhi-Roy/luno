const { createUser, createAdmin } = require("../_helpers/auth.helper");
const {
  createAvatar,
  createElement,
  updateElement,
  createMap,
} = require("../_helpers/admin.helper");

jest.setTimeout(30000);

describe("Admin endpoints", () => {
  let admin, user;

  beforeAll(async () => {
    admin = await createAdmin();
    user = await createUser();
  });

  test("Normal users get 403 on every admin endpoint", async () => {
    const element = await createElement(user.token);
    const map = await createMap(user.token);
    const avatar = await createAvatar(user.token, "Timmy", "https://example.com/a.png");
    const update = await updateElement(user.token, "123", "https://example.com/b.png");

    expect(element.status).toBe(403);
    expect(map.status).toBe(403);
    expect(avatar.status).toBe(403);
    expect(update.status).toBe(403);
  });

  test("Admins can hit every admin endpoint", async () => {
    const element = await createElement(admin.token);
    const map = await createMap(admin.token);
    const avatar = await createAvatar(admin.token, "Timmy", "https://example.com/a.png");

    expect(element.status).toBe(200);
    expect(map.status).toBe(200);
    expect(avatar.status).toBe(200);
  });

  test("Admin can update an element's imageUrl", async () => {
    const element = await createElement(admin.token);
    const update = await updateElement(admin.token, element.data.id, "https://example.com/c.png");
    expect(update.status).toBe(200);
  });
});
