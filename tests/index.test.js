const axios = require("axios");

const BACKEND_URL = "http://localhost:3000";

describe("Authentication", () => {
  test("User is able to sign up only once", async () => {
    const username = "testuser" + Math.random(); // testuser0.12331313
    const password = "password123";
    const response = await axios.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password,
      type: "admin",
    });

    expect(response.status).toBe(200);

    // Try signing up again with the same username
    const updatedResponse = await axios.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password,
      type: "admin",
    });

    expect(updatedResponse.status).toBe(400);
  });

  test("Signup request fails if the username is empty", async () => {
    const username = `testuser-${Math.random()}`; // testuser-0.12312313
    const password = "password123";

    // Signup request with empty username should fail
    const response = await axios.post(`${BACKEND_URL}/api/v1/signup`, {
      password,
    });

    expect(response.status).toBe(400);
  });

  test("Signin succeeds if the username and password are correct", async () => {
    const username = `testuser-${Math.random()}`;
    const password = "password123";

    // First, sign up the user
    await axios.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password,
      type: "admin",
    });

    // Then, attempt to sign in
    const response = await axios.post(`${BACKEND_URL}/api/v1/signin`, {
      username,
      password,
    });

    expect(response.status).toBe(200);
    expect(response.data.token).toBeDefined();
  });

  test("Signin fails if the username and password are incorrect", async () => {
    const username = `testuser-${Math.random()}`;
    const password = "password123";

    await axios.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password,
      role: "admin",
    });

    const response = await axios.post(`${BACKEND_URL}/api/v1/signin`, {
      username: "WrongUsername",
      password,
    });

    expect(response.status).toBe(403);
  });
});
