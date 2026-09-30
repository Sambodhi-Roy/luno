const { signup, signin } = require("../_helpers/auth.helper");
const client = require("../_helpers/axios.client");
jest.setTimeout(20000);

describe("Authentication", () => {
  test("User is able to sign up only once (duplicate => 409)", async () => {
    const username = `test-${Math.random().toString(36).slice(2, 8)}`;
    const password = "password123";

    const res1 = await signup(username, password);
    expect(res1.status).toBe(200);

    const res2 = await signup(username, password);
    // Duplicate should return 409 according to your controller
    expect(res2.status).toBe(409);
  });

  test("Signup request fails if the username is empty", async () => {
    const res = await signup("", "password123");
    // server validation should return 400
    expect(res.status).toBe(400);
  });

  test("Signin succeeds if credentials are correct", async () => {
    const username = `test-${Math.random().toString(36).slice(2, 8)}`;
    const password = "password123";
    const s = await signup(username, password);
    expect(s.status).toBe(200);

    const login = await signin(username, password);
    expect(login.status).toBe(200);
    expect(login.data.token).toBeDefined();
  });

  test("Signin fails with wrong username/password", async () => {
    const username = `test-${Math.random().toString(36).slice(2, 8)}`;
    const password = "password123";
    const s = await signup(username, password);
    expect(s.status).toBe(200);

    const badLogin = await signin("this-does-not-exist", password);
    // your controller returns 401 for invalid username/password
    expect(badLogin.status).toBe(401);
  });

  // Usernames are case-insensitive: "Sam" and "sam" are the same account
  test("A username that differs only in case is already taken", async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const first = await signup(`test-Case${suffix}`, "password123");
    expect(first.status).toBe(200);

    const second = await signup(`test-case${suffix}`, "password123");
    expect(second.status).toBe(409);
  });

  test("Signing in ignores case and keeps the name as typed", async () => {
    const username = `test-Mixed${Math.random().toString(36).slice(2, 8)}`;
    expect((await signup(username, "password123")).status).toBe(200);

    const login = await signin(username.toUpperCase(), "password123");
    expect(login.status).toBe(200);

    const me = await client.get("/user/me", { headers: { authorization: `Bearer ${login.data.token}` } });
    expect(me.data.username).toBe(username);
  });
});
