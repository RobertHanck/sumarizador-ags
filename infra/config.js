const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

module.exports = {
  ENV: process.env.ENV,
  SERVER: {
    HOST: process.env.SERVER_HOST,
    PORT: process.env.SERVER_PORT,
    URL: process.env.SERVER_URL,
  },
  API_KEY: process.env.API_KEY,
  
  BODY_LIMIT: process.env.BODY_LIMIT || "200mb",

  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};
