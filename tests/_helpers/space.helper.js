const client = require("./axios.client");

function createSpace(token, name, dimensions, mapId) {
  return client.post(
    "/space",
    { name, dimensions, mapId },
    { headers: { authorization: `Bearer ${token}` } }
  );
}

function deleteSpace(token, spaceId) {
  return client.delete(`/space/${spaceId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

module.exports = { createSpace, deleteSpace };
