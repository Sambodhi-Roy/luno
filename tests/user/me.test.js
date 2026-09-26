const { createUser } = require("../_helpers/auth.helper");
const client = require("../_helpers/axios.client");

jest.setTimeout(20000);

describe("Current user", () => {
  let user;

  beforeAll(async () => {
    user = await createUser();
  });

  test("GET /user/me returns the signed-in user", async () => {
    const res = await client.get("/user/me", {
      headers: { authorization: `Bearer ${user.token}` },
    });

    expect(res.status).toBe(200);
    expect(res.data.id).toBe(user.userId);
    expect(res.data.username).toBe(user.username);
    expect(res.data.role).toBe("User");
    expect(res.data).toHaveProperty("avatar");
    expect(res.data).not.toHaveProperty("password");
  });

  test("GET /user/me without a token returns 401", async () => {
    const res = await client.get("/user/me");
    expect(res.status).toBe(401);
  });

  test("POST /user/signout clears the auth cookie", async () => {
    const res = await client.post("/user/signout");
    expect(res.status).toBe(200);

    const setCookie = (res.headers["set-cookie"] || []).join(";");
    expect(setCookie).toMatch(/token=;/);
    expect(setCookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
