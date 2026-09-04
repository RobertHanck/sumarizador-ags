const { readPdf } = require("./pdfProcessor"); 
const { generateContent } = require("../services/geminiService"); 
const { parseJson } = require("../utils/jsonUtils"); 

async function extract(filePaths, promptTemplate, numeroUnicoImovel) {
    const pdfParts = filePaths.map(filePath => readPdf(filePath));
    
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    let promptFinal;
    if (typeof promptTemplate === 'function') {
        promptFinal = promptTemplate(numeroUnicoImovel);
    } else {
        promptFinal = promptTemplate.replace(/\{\{DATA_ATUAL\}\}/g, dataAtual);
    }

    const requestContent = [
        ...pdfParts, 
        { text: promptFinal }
    ];

    const response = await generateContent(requestContent);
    return parseJson(response); 
} 

module.exports = { extract };