// tests/_helpers/auth.helper.js
const client = require("./axios.client");

async function signup(username, password, role = "user") {
  return client.post("/user/signup", { username, password, role });
}

async function signin(username, password) {
  return client.post("/user/signin", { username, password });
}

// convenience: create user and return credentials & token
async function createUser(role = "user") {
  const username = `${role}-${Math.random().toString(36).slice(2, 9)}`;
  const password = "password123";
  const signupRes = await signup(username, password, role);
  if (signupRes.status >= 400) {
    throw new Error(`createUser signup failed: ${signupRes.status}`);
  }
  const signinRes = await signin(username, password);
  if (signinRes.status >= 400) {
    throw new Error(`createUser signin failed: ${signinRes.status}`);
  }
  return {
    username,
    password,
    token: signinRes.data.token,
    userId: signinRes.data.userId,
  };
}

async function createAdmin() {
  return createUser("admin");
}

module.exports = { signup, signin, createUser, createAdmin };
