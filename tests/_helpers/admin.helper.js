const axios = require("./axios.client");

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

async function createAvatar(token, name, imageUrl) {
  return axios.post("/admin/avatar", { name, imageUrl }, auth(token));
}

async function createElement(token, { width = 1, height = 1, isStatic = true } = {}) {
  return axios.post(
    "/admin/element",
    {
      imageUrl: "https://example.com/element.png",
      width,
      height,
      static: isStatic,
    },
    auth(token)
  );
}

async function updateElement(token, elementId, imageUrl) {
  return axios.put(`/admin/element/${elementId}`, { imageUrl }, auth(token));
}

async function createMap(token, { dimensions = "100x200", defaultElements = [] } = {}) {
  return axios.post(
    "/admin/map",
    {
      name: "Test map",
      thumbnail: "https://example.com/thumb.png",
      dimensions,
      defaultElements,
    },
    auth(token)
  );
}

module.exports = {
  createAvatar,
  createElement,
  updateElement,
  createMap,
};
