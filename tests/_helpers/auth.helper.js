const axios = require("./axios.client");

async function signup(username, password, role = "User") {
  return axios.post("/user/signup", {
    username,
    password,
    role,
  });
}

async function signin(username, password) {
  return axios.post("/user/signin", { username, password });
}

async function createUser(role = "User") {
  const username = `test-${Math.random()}`;
  const password = "password123";

  const signupRes = await signup(username, password, role);
  if (signupRes.status !== 200) {
    throw new Error(`createUser signup failed: ${signupRes.status}`);
  }

  const signinRes = await signin(username, password);
  if (signinRes.status !== 200) {
    throw new Error(`createUser signin failed: ${signinRes.status}`);
  }

  return {
    username,
    token: signinRes.data.token,
  };
}

async function createAdmin() {
  return createUser("Admin"); // ✅ exact enum value
}

module.exports = {
  createUser,
  createAdmin,
};
