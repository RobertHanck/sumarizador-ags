const AppError = require("../utils/AppError");
const { errorEnvelope } = require("../utils/responseEnvelope");
const { isZodError, formatZodDetails } = require("./validate");

function errorHandler(err, req, res, next) {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      errorEnvelope({
        codigo: err.code,
        mensagem: err.message,
        detalhes: err.details,
      })
    );
  }

  if (isZodError(err)) {
    return res.status(400).json(
      errorEnvelope({
        codigo: "VALIDATION_ERROR",
        mensagem: "Dados inválidos.",
        detalhes: formatZodDetails(err),
      })
    );
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json(
      errorEnvelope({
        codigo: "PAYLOAD_TOO_LARGE",
        mensagem:
          "Body da requisição excede o limite permitido (PDFs em base64).",
        detalhes: {
          limite: err.limit,
          recebido: err.length,
        },
      })
    );
  }

  console.error(`[${requestId}] Erro não tratado:`, err);
  return res.status(500).json(
    errorEnvelope({
      codigo: "INTERNAL_ERROR",
      mensagem: "Erro interno ao processar a requisição.",
    })
  );
}

module.exports = errorHandler;