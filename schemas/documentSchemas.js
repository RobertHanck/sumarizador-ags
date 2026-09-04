const { z } = require("zod");

function normalizePdfBase64(value) {
  return value
    .replace(/^data:application\/pdf;base64,/i, "")
    .replace(/\s+/g, "");
}

function isPdfBase64(value) {
  if (!value || value.length % 4 !== 0) return false;

  try {
    const bytes = Buffer.from(value, "base64");
    return bytes.length > 4 && bytes.subarray(0, 4).toString() === "%PDF";
  } catch {
    return false;
  }
}

const pdfBase64Schema = z
  .string({ error: "Cada item de pdfs deve ser uma string." })
  .min(1, "PDF base64 não pode ser vazio.")
  .transform(normalizePdfBase64)
  .refine(isPdfBase64, {
    message: "Cada item de pdfs deve ser um PDF em base64 válido.",
  });

const interpretPdfBodySchema = z
  .object({
    nomeDocumento: z
      .string({ error: "nomeDocumento deve ser uma string." })
      .trim()
      .min(1, "nomeDocumento é obrigatório."),
    imovelUnico: z
      .string({ error: "imovelUnico deve ser uma string." })
      .trim()
      .min(1, "imovelUnico é obrigatório."),
    pdfs: z
      .array(pdfBase64Schema, { error: "pdfs deve ser um array." })
      .min(1, "Envie ao menos um PDF em base64."),
  })
  .strict();

const documentoGeradoSchema = z.object({
  dadosJson: z.record(z.string(), z.unknown()),
  html: z.string().min(1),
  wordBase64: z.string().min(1),
});

const interpretPdfSuccessSchema = z.object({
  sucesso: z.literal(true),
  nomeDocumento: z.string().min(1),
  imovelUnico: z.string().min(1),
  relatorio: documentoGeradoSchema,
  minuta: documentoGeradoSchema,
});

module.exports = {
  interpretPdfBodySchema,
  interpretPdfSuccessSchema,
  documentoGeradoSchema,
};
