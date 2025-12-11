const axios = require("axios");

const client = axios.create({
  baseURL: "http://localhost:3000/api/v1",
  validateStatus: () => true, // prevents axios rejecting non-2xx
  timeout: 10000,
});

module.exports = client;
