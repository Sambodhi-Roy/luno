const axios = require("./axios.client");

async function createAvatar(token, name, imageUrl) {
  return axios.post(
    "/admin/avatar",
    { name, imageUrl },
    {
      headers: {
        Authorization: `Bearer ${token}`, 
      },
    }
  );
}

module.exports = {
  createAvatar,
};
