const fs = require("fs"); 
const path = require("path"); 
const crypto = require("crypto"); 
const { successEnvelope } = require("../utils/responseEnvelope"); 
const { parseWithSchema } = require("../middleware/validate"); 
const { interpretPdfSuccessSchema } = require("../schemas/documentSchemas"); 
const { extract } = require("../processors/extractionProcessor"); 
const { generateHtml } = require("../processors/documentGenerator"); 
const { generateDocx } = require("../utils/docxGenerator"); 
const relatorioPrompt = require("../prompts/extractionPrompt_v3");
const minutaPrompt = require("../prompts/minutaPrompt"); 

exports.interpretPdf = async (req, res, next) => {       
    let savedFilePaths = [];       
    try {          
        const { nomeDocumento, imovelUnico, pdfs } = req.body;          
        if (!nomeDocumento || !imovelUnico || !pdfs || !Array.isArray(pdfs) || pdfs.length === 0) {                  
            return res.status(400).json({                          
                error: "Parâmetros inválidos. Envie 'nomeDocumento', 'imovelUnico' e 'pdfs' (array em base64)."                  
            });          
        }               
         
        const tempDir = path.join(__dirname, "../temp");          
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });               

        console.log(`\n====================================`);          
        console.log(`[API] Processando: ${nomeDocumento} (${pdfs.length} arquivo(s)) - Imóvel: ${imovelUnico}`);               

        // ========================================================          
        // SALVAR PDFs TEMPORÁRIOS NA MÁQUINA          
        // ========================================================          
        for (let i = 0; i < pdfs.length; i++) {                  
            const base64Data = pdfs[i].replace(/^data:.*?;base64,/, "");                  
            const buffer = Buffer.from(base64Data, "base64");                  
            const tempFileName = `temp_${crypto.randomBytes(8).toString("hex")}_${i}.pdf`;                  
            const tempFilePath = path.join(tempDir, tempFileName);                  
            fs.writeFileSync(tempFilePath, buffer);                  
            savedFilePaths.push(tempFilePath);          
        }               

        // ========================================================          
        // EXTRAIR E GERAR RELATÓRIO          
        // ========================================================          
        console.log(`[API] IA Trabalhando: Gerando Relatório...`);          
        
        const promptGerado = relatorioPrompt(imovelUnico); 
        const extractedRelatorio = await extract(savedFilePaths, promptGerado);               
        
        const htmlRelatorio = generateHtml(extractedRelatorio, "formTemplate_v2.html");          
        const docxRelatorioBuffer = await generateDocx(htmlRelatorio);               

        // ========================================================          
        // MINUTA — TEMPORARIAMENTE DESATIVADA (14/08/2026)
        //
        // PARA REATIVAR: comente/apague o bloco "MINUTA DESATIVADA" abaixo e
        // descomente o bloco "CÓDIGO ORIGINAL DA MINUTA" logo em seguida.
        // ========================================================
        console.log(`[API] Minuta temporariamente desativada — pulando geração via IA.`);

        const avisoMinutaDesativada = "Minuta temporariamente indisponível (em manutenção). Consulte o setor responsável para mais informações.";
        const extractedMinuta = { sucesso: false, aviso: avisoMinutaDesativada };
        const htmlMinuta = `<p>${avisoMinutaDesativada}</p>`;
        const docxMinutaBuffer = await generateDocx(htmlMinuta);

        /* ============ CÓDIGO ORIGINAL DA MINUTA (reative quando corrigir) ============
        console.log(`[API] IA Trabalhando: Gerando Minuta...`);          
        await new Promise(resolve => setTimeout(resolve, 3000)); // Pausa de segurança          
        const extractedMinuta = await extract(savedFilePaths, minutaPrompt);               
        
        const htmlMinuta = generateHtml(extractedMinuta, "minutaTemplate.html");          
        const docxMinutaBuffer = await generateDocx(htmlMinuta);               
        ================================================================================ */

        console.log(`[API] Conversões finalizadas. Empacotando resposta...`);               

        // ========================================================          
        // PREENCHER OS OBJETOS COM DADOS REAIS          
        // ========================================================          
        const relatorio = {              
            dadosJson: extractedRelatorio,          
            html: htmlRelatorio,              
            wordBase64: docxRelatorioBuffer.toString("base64"),          
        };               

        const minuta = {              
            dadosJson: extractedMinuta,              
            html: htmlMinuta,              
            wordBase64: docxMinutaBuffer.toString("base64"),          
        };               

        const payload = parseWithSchema(              
            interpretPdfSuccessSchema,              
            successEnvelope({                  
                nomeDocumento,
                imovelUnico,
                relatorio,                  
                minuta,              
            }),              
            {                  
                code: "INTERNAL_ERROR",                  
                message: "Resposta inválida gerada pelo servidor.",                  
                statusCode: 500,              
            }          
        );               

        return res.status(200).json(payload);       
    } catch (error) {          
        console.error("[ERRO NA IA]:", error);          
        next(error);       
    } finally {          
        savedFilePaths.forEach(filePath => {                  
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);          
        });       
    } 
};