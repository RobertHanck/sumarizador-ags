const fs = require("fs");
const path = require("path");

/**
 * Reads a PDF file and prepares it for Gemini.
 * @param {string} filePath
 * @returns {{inlineData: {mimeType: string, data: string}}}
 */
function readPdf(filePath) {
    const absolutePath = path.resolve(filePath);

    const buffer = fs.readFileSync(absolutePath);

    return {
        inlineData: {
            mimeType: "application/pdf",
            data: buffer.toString("base64"),
        },
    };
}

module.exports = {
    readPdf,
};