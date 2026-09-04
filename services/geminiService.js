const { MODEL } = require("../config/gemini");
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

if (typeof globalThis.File === 'undefined') {
    const { File } = require('node:buffer');
    globalThis.File = File;
}

const { setGlobalDispatcher, Agent } = require("undici");

// ============================================================
// TIMEOUT DE REDE (CORREÇÃO — evita UND_ERR_HEADERS_TIMEOUT)
// ============================================================
// O undici (cliente HTTP usado pelo Node/@google/genai por baixo dos panos)
// tem um limite padrão de tempo esperando os CABEÇALHOS da resposta chegarem
// (headersTimeout) — não o corpo inteiro, só o começo da resposta. Para
// requisições com PDF grande + "thinking" do modelo, esse tempo pode passar
// do padrão do undici antes mesmo do Gemini começar a responder, gerando
// UND_ERR_HEADERS_TIMEOUT. Isso é diferente de um erro 429/503 da própria
// API — é o cliente desistindo de esperar antes da resposta chegar.
// Aumentamos esse limite globalmente para todas as requisições HTTP feitas
// pelo processo (10 minutos é uma margem segura para documentos grandes;
// ajuste se necessário).
setGlobalDispatcher(new Agent({
    headersTimeout: 600_000, // 10 minutos
    bodyTimeout: 600_000,    // 10 minutos (tempo para o corpo inteiro da resposta)
}));

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const LOG_DIR = path.join(__dirname, "../logs");

// ============================================================
// LOG DE CONSUMO DE TOKENS / CUSTO ESTIMADO
// ============================================================

const LOG_FILE = path.join(LOG_DIR, "token-usage.csv");

// Preço por 1 milhão de tokens (entrada / saída), em dólares.
// A saída inclui os "thinking tokens" (thoughtsTokenCount), que a Google
// cobra à taxa de saída mesmo não aparecendo no texto final.
// Ajuste esses valores se a Google mudar o preço — checar em
// https://ai.google.dev/gemini-api/docs/pricing
const PRECOS_POR_MILHAO_TOKENS = {
    "gemini-3.6-flash": { entrada: 1.50, saida: 7.50 },
    "gemini-3.1-pro-preview": { entrada: 2.00, saida: 12.00 },
    "gemini-3.5-flash-lite": { entrada: 0.30, saida: 2.50 },
    "gemini-3.1-flash-lite": { entrada: 0.10, saida: 0.40 },
    "gemini-2.5-flash-lite": { entrada: 0.10, saida: 0.40 },
};

function calcularCustoEstimado(model, promptTokenCount, saidaTotalTokens) {
    const precos = PRECOS_POR_MILHAO_TOKENS[model];
    if (!precos) return null;
    const custoEntrada = (promptTokenCount / 1_000_000) * precos.entrada;
    const custoSaida = (saidaTotalTokens / 1_000_000) * precos.saida;
    return custoEntrada + custoSaida;
}

function garantirArquivoDeLog() {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    if (!fs.existsSync(LOG_FILE)) {
        const cabecalho = "timestamp,model,prompt_tokens,thoughts_tokens,candidates_tokens,total_tokens,custo_estimado_usd\n";
        fs.writeFileSync(LOG_FILE, cabecalho, "utf8");
    }
}

function registrarUsoDeTokens(model, usageMetadata) {
    try {
        if (!usageMetadata) return;

        const promptTokenCount = usageMetadata.promptTokenCount || 0;
        const thoughtsTokenCount = usageMetadata.thoughtsTokenCount || 0;
        const candidatesTokenCount = usageMetadata.candidatesTokenCount || 0;
        const totalTokenCount = usageMetadata.totalTokenCount || 0;

        // Tokens de saída cobrados = texto de resposta + tokens de pensamento
        const saidaTotalTokens = candidatesTokenCount + thoughtsTokenCount;
        const custo = calcularCustoEstimado(model, promptTokenCount, saidaTotalTokens);

        garantirArquivoDeLog();

        const linha = [
            new Date().toISOString(),
            model,
            promptTokenCount,
            thoughtsTokenCount,
            candidatesTokenCount,
            totalTokenCount,
            custo !== null ? custo.toFixed(6) : "N/A",
        ].join(",") + "\n";

        fs.appendFileSync(LOG_FILE, linha, "utf8");

        console.log(
            `[Gemini] tokens: entrada=${promptTokenCount} pensamento=${thoughtsTokenCount} saída=${candidatesTokenCount} total=${totalTokenCount}` +
            (custo !== null ? ` | custo estimado: $${custo.toFixed(4)}` : "")
        );
    } catch (err) {
        console.error("[Gemini] falha ao registrar log de tokens:", err.message);
    }
}


function isErroTemporario(error) {
    if (error.status === 503 || error.status === 429) return true;
    if (error.message && error.message.includes('Deadline expired')) return true;

    const causeCode = error.cause?.code;
    if (causeCode === 'UND_ERR_HEADERS_TIMEOUT' || causeCode === 'UND_ERR_BODY_TIMEOUT') return true;

    if (error.message && error.message.includes('fetch failed')) return true;

    return false;
}

// ============================================================

async function generateContent(contents) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await ai.models.generateContent({
                model: MODEL,
                contents,
                config: {
                    responseMimeType: "application/json"
                }
            });

            registrarUsoDeTokens(MODEL, response.usageMetadata);

            return response.text;

        } catch (error) {
            attempt++;

            if (isErroTemporario(error)) {
                const motivo = error.cause?.code || error.status || 'Timeout';
                console.warn(`\n⏳ [Aviso] A API do Gemini demorou muito a responder (${motivo}). Tentativa ${attempt} de ${maxRetries}... Aguardando 5 segundos para tentar novamente.`);

                if (attempt >= maxRetries) {
                    console.error("❌ Esgotadas as tentativas de conexão com a API do Gemini.");
                    throw error;
                }

                await delay(5000);

            } else {
                throw error;
            }
        }
    }
}

module.exports = {
    generateContent,
};