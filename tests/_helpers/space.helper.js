const client = require("./axios.client");

const auth = (token) => ({ headers: { authorization: `Bearer ${token}` } });

function createSpace(token, name, dimensions, mapId) {
  return client.post("/space", { name, dimensions, mapId }, auth(token));
}

function deleteSpace(token, spaceId) {
  return client.delete(`/space/${spaceId}`, auth(token));
}

function getSpace(token, spaceId) {
  return client.get(`/space/${spaceId}`, auth(token));
}

function getAllSpaces(token) {
  return client.get("/space/all", auth(token));
}

function getAllElements(token) {
  return client.get("/space/elements", auth(token));
}

function addElement(token, spaceId, elementId, x, y) {
  return client.post("/space/element", { spaceId, elementId, x, y }, auth(token));
}

function removeElement(token, id) {
  // axios sends DELETE bodies via the `data` config key
  return client.delete("/space/element", { ...auth(token), data: { id } });
}

module.exports = {
  createSpace,
  deleteSpace,
  getSpace,
  getAllSpaces,
  getAllElements,
  addElement,
  removeElement,
};
