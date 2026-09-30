const client = require("./axios.client");

const auth = (token) => ({ headers: { authorization: `Bearer ${token}` } });

// visibility is "Public" or "Private"; the API defaults to "Private"
function createSpace(token, name, dimensions, mapId, visibility) {
  return client.post("/space", { name, dimensions, mapId, visibility }, auth(token));
}

function updateSpace(token, spaceId, changes) {
  return client.patch(`/space/${spaceId}`, changes, auth(token));
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

function getJoinedSpaces(token) {
  return client.get("/space/joined", auth(token));
}

function getPublicSpaces(token) {
  return client.get("/space/public", auth(token));
}

function visitSpace(token, spaceId) {
  return client.post(`/space/${spaceId}/visit`, {}, auth(token));
}

function leaveSpace(token, spaceId) {
  return client.delete(`/space/${spaceId}/membership`, auth(token));
}

function getInvite(token, code) {
  return client.get(`/space/invite/${code}`, auth(token));
}

function acceptInvite(token, code) {
  return client.post(`/space/invite/${code}`, {}, auth(token));
}

function resetInvite(token, spaceId) {
  return client.post(`/space/${spaceId}/invite/reset`, {}, auth(token));
}

function getAllElements(token) {
  return client.get("/space/elements", auth(token));
}

function addElement(token, spaceId, elementId, x, y) {
  return client.post("/space/element", { spaceId, elementId, x, y }, auth(token));
}

// A space with a map built in the editor; size is "small", "medium" or "large"
function createCustomSpace(token, name, size, visibility) {
  return client.post("/space", { name, layout: "custom", size, visibility }, auth(token));
}

function saveCustomMap(token, spaceId, map) {
  return client.put(`/space/${spaceId}/custom-map`, map, auth(token));
}

function uploadSpaceThumbnail(token, spaceId, data, name = "cover.png") {
  const form = new FormData();
  form.append("file", new Blob([data]), name);
  return client.put(`/space/${spaceId}/thumbnail`, form, auth(token));
}

function removeElement(token, id) {
  // axios sends DELETE bodies via the `data` config key
  return client.delete("/space/element", { ...auth(token), data: { id } });
}

module.exports = {
  createSpace,
  updateSpace,
  deleteSpace,
  getSpace,
  getAllSpaces,
  getJoinedSpaces,
  getPublicSpaces,
  visitSpace,
  leaveSpace,
  getInvite,
  acceptInvite,
  resetInvite,
  getAllElements,
  addElement,
  removeElement,
  createCustomSpace,
  saveCustomMap,
  uploadSpaceThumbnail,
};
