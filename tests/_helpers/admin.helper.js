const axios = require("./axios.client");

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

async function createAvatar(token, name, imageUrl) {
  return axios.post("/admin/avatar", { name, imageUrl }, auth(token));
}

async function createElement(token, { width = 1, height = 1, isStatic = true } = {}) {
  return axios.post(
    "/admin/element",
    {
      // A real sprite, so furniture created by tests still renders if someone opens those spaces
      imageUrl: "/assets/elements/chair.png",
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



// Multipart uploads use Node's built-in FormData/Blob, which axios sends as multipart/form-data
function fileForm(fields, files) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  for (const { field, name, data } of files) form.append(field, new Blob([data]), name);
  return form;
}

async function uploadImage(token, kind, data, name = "image.png") {
  return axios.post("/admin/upload/image", fileForm({ kind }, [{ field: "file", name, data }]), auth(token));
}

async function uploadMap(token, tmj, tilesets) {
  const files = [
    { field: "map", name: "map.tmj", data: tmj },
    ...tilesets.map(({ name, data }) => ({ field: "tilesets", name, data })),
  ];
  return axios.post("/admin/upload/map", fileForm({}, files), auth(token));
}

module.exports = {
  createAvatar,
  createElement,
  updateElement,
  createMap,
  uploadImage,
  uploadMap,
};
