// tests/_helpers/user.helper.js
const client = require("./axios.client");

function updateMetadata(token, avatarId) {
  return client.post(
    "/user/metadata",
    { avatarId },
    { headers: { authorization: `Bearer ${token}` } }
  );
}

function getAvatars() {
  return client.get("/user/avatars");
}

function getBulkMetadata(ids) {
  // server expects ?ids=[id1,id2] or comma-separated; we pass an array as JSON string
  return client.get(`/user/metadata/bulk?ids=${JSON.stringify(ids)}`);
}

module.exports = { updateMetadata, getAvatars, getBulkMetadata };
