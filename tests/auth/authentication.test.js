const { signup, signin } = require("../_helpers/auth.helper");
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
});
