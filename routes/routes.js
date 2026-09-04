const express = require("express");
const requireApiKey = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { interpretPdfBodySchema } = require("../schemas/documentSchemas");
const documentController = require("../controllers/documentController");

const router = express.Router();

router.post(
  "/documents/interpret",
  requireApiKey,
  validateBody(interpretPdfBodySchema),
  documentController.interpretPdf
);

module.exports = router;
