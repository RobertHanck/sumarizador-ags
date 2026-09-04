const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const config = require("./infra/config.js");
const routes = require("./routes/routes.js");
const errorHandler = require("./middleware/errorHandler.js");
const { formatBrazilianDateTime } = require("./utils/utils.js");
const { version } = require("./package.json");

const app = express();

app.use(cors());

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  next();
});

app.use(express.json({ limit: config.BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: config.BODY_LIMIT }));

app.get("/", (req, res) => {
  res.status(200).json({
    message: "API AGS IA",
    version: version,
    timestamp: formatBrazilianDateTime(new Date()),
    status: "OK",
  });
});

app.get("/ping", (req, res) => {
  res.status(200).json({
    message: "pong",
    timestamp: formatBrazilianDateTime(new Date()),
    status: "OK",
  });
});

app.use("/api", routes);

app.use(errorHandler);

module.exports = app;
