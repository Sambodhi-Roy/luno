const client = require("./axios.client");

function createAvatar(
  token,
  name = "TestAvatar",
  imageUrl = "https://example.com/a.png"
) {
  return client.post(
    "/admin/avatar",
    { name, imageUrl },
    { headers: { authorization: `Bearer ${token}` } }
  );
}

module.exports = { createAvatar };
