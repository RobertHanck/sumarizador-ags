const { ZodError } = require("zod");
const AppError = require("../utils/AppError");

function formatZodDetails(error) {
  return error.issues.map((issue) => ({
    campo: issue.path.join(".") || "(root)",
    mensagem: issue.message,
  }));
}

function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(
        new AppError(
          "VALIDATION_ERROR",
          "Body da requisição inválido.",
          400,
          formatZodDetails(result.error)
        )
      );
    }

    req.body = result.data;
    next();
  };
}

function parseWithSchema(schema, data, { code, message, statusCode }) {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new AppError(
      code,
      message,
      statusCode,
      formatZodDetails(result.error)
    );
  }

  return result.data;
}

function isZodError(err) {
  return err instanceof ZodError;
}

module.exports = {
  validateBody,
  parseWithSchema,
  formatZodDetails,
  isZodError,
};
