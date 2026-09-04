const htmlDocx = require('html-docx-js');
const fs = require('fs');

async function generateDocx(htmlString, outputPath = null) {
    try {
        // Envolvemos o HTML com a tag de codificação UTF-8 para o Word ler os acentos
        const htmlCompleto = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                </head>
                <body>
                    ${htmlString}
                </body>
            </html>
        `;

        const docxData = htmlDocx.asBlob(htmlCompleto);
        
        let buffer;
        if (Buffer.isBuffer(docxData)) {
            buffer = docxData;
        } else if (typeof docxData.arrayBuffer === 'function') {
            buffer = Buffer.from(await docxData.arrayBuffer());
        } else {
            buffer = Buffer.from(docxData);
        }

        // Se tiver um caminho de saída (index.js), salva no disco
        if (outputPath) {
            fs.writeFileSync(outputPath, buffer);
            console.log(`[DOCX] Arquivo Word salvo em: ${outputPath}`);
        }

        // Retorna o buffer (usado pelo server.js para enviar a resposta da API)
        return buffer;
        
    } catch (error) {
        console.error(`[DOCX Error] Erro ao converter HTML para Word:`, error);
        throw error;
    }
}

module.exports = { generateDocx };