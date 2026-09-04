const config = require("../infra/config");
const AppError = require("../utils/AppError");

function requireApiKey(req, res, next) {
  const apiKey = req.header("x-api-key");

  if (!config.API_KEY) {
    return next(
      new AppError(
        "INTERNAL_ERROR",
        "API_KEY não configurada no servidor.",
        500
      )
    );
  }

  if (!apiKey || apiKey !== config.API_KEY) {
    return next(
      new AppError(
        "UNAUTHORIZED",
        "Chave de API inválida ou ausente. Envie o header 'x-api-key'.",
        401
      )
    );
  }

  next();
}

module.exports = requireApiKey;
