/**
 * Corrige uma causa muito comum de JSON inválido vindo de respostas de LLM:
 * quebras de linha literais (\r ou \n reais) dentro de valores de string,
 * quando deveriam ter sido escritas como a sequência de escape "\n".
 *
 * Percorre o texto caractere a caractere, rastreando se está dentro de uma
 * string (respeitando aspas escapadas \" e barras invertidas escapadas \\),
 * e substitui qualquer quebra de linha bruta encontrada DENTRO de uma string
 * pela sequência de escape correta. Quebras de linha FORA de strings (entre
 * chaves, colchetes, vírgulas etc.) são preservadas normalmente, pois são
 * válidas em JSON e não precisam de correção.
 */
function sanitizeJsonNewlines(rawText) {
    let result = '';
    let insideString = false;
    let escaped = false;

    for (let i = 0; i < rawText.length; i++) {
        const char = rawText[i];

        if (insideString) {
            if (escaped) {
                result += char;
                escaped = false;
                continue;
            }

            if (char === '\\') {
                result += char;
                escaped = true;
                continue;
            }

            if (char === '"') {
                result += char;
                insideString = false;
                continue;
            }

            if (char === '\n') {
                result += '\\n';
                continue;
            }
            if (char === '\r') {
                continue;
            }
            if (char === '\t') {
                result += '\\t';
                continue;
            }

            result += char;
            continue;
        }

        // Fora de uma string:
        if (char === '"') {
            insideString = true;
            result += char;
            continue;
        }

        result += char;
    }

    return result;
}

/**
 * Corrige outra causa comum de JSON inválido: a IA devolve MAIS DE UM objeto
 * JSON completo na mesma resposta, colados um no outro (ex: "{...}, {...}"
 * ou "{...}{...}" ou até "{...}\n{...}"). Isso acontece ocasionalmente e o
 * regex guloso "primeira { até a última }" juntava os dois objetos num blob
 * inválido só, quebrando o parse inteiro.
 *
 * Esta função varre o texto a partir da primeira "{" e conta profundidade de
 * chaves de verdade — ignorando chaves que apareçam DENTRO de strings (ex:
 * um texto de observação que contenha um "{" literal) e respeitando aspas/
 * barras escapadas — até encontrar a chave de fechamento que corresponde à
 * primeira abertura. Devolve só esse primeiro objeto completo, descartando
 * qualquer coisa (inclusive um segundo objeto JSON inteiro) que venha depois.
 *
 * Devolve null se não encontrar nenhuma "{" ou se o objeto nunca fechar
 * (chaves desbalanceadas) — nesses casos quem chamar deve cair para outro
 * método de recuperação.
 */
function extractFirstJsonObject(text) {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let insideString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const char = text[i];

        if (insideString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                insideString = false;
            }
            continue;
        }

        if (char === '"') {
            insideString = true;
            continue;
        }
        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) {
                return text.substring(start, i + 1);
            }
        }
    }

    // Chegou ao fim do texto sem fechar o primeiro objeto -> desbalanceado.
    return null;
}

function parseJson(text) {
    try {
        // 1. Isola apenas o PRIMEIRO objeto JSON completo (ignora qualquer
        //    coisa depois, inclusive um segundo objeto JSON inteiro colado).
        const isolado = extractFirstJsonObject(text);
        let cleaned = isolado !== null ? isolado : text;

        cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

        // 2. Corrige quebras de linha literais dentro de strings (causa comum
        //    de "Bad control character in string literal" / "Unexpected token")
        cleaned = sanitizeJsonNewlines(cleaned);

        return JSON.parse(cleaned);
    } catch (error) {
        // TENTATIVA DE RECUPERAÇÃO AUTOMÁTICA (Fallback para chaves extras no final)
        try {
            const isolado = extractFirstJsonObject(text);
            let cleaned = isolado !== null ? isolado : text;
            cleaned = cleaned.replace(/,\s*([\]}])/g, '$1').trim();
            cleaned = sanitizeJsonNewlines(cleaned);

            // Se terminar com um bloco de chaves duplicadas extra (ex: } } }), remove a última
            if (cleaned.endsWith('}}}')) {
                cleaned = cleaned.substring(0, cleaned.lastIndexOf('}'));
                return JSON.parse(cleaned);
            }

            // Mesmo sem o caso de chaves extras, tenta o parse já sanitizado
            return JSON.parse(cleaned);
        } catch (e2) {
            // Se a recuperação falhar, segue para o log de erro original abaixo
        }

        console.error("❌ Erro fatal ao fazer o parse do JSON.");

        const posMatch = error.message.match(/position (\d+)/);
        if (posMatch && posMatch[1]) {
            const pos = parseInt(posMatch[1], 10);
            const start = Math.max(0, pos - 50);
            const end = Math.min(text.length, pos + 50);
            console.log(`\nTrecho do JSON com problema (perto da posição ${pos}):`);
            console.log(text.substring(start, end));
            console.log(`${" ".repeat(pos - start)}^--- AQUI`);
        }
        throw error;
    }
}

module.exports = {
    parseJson,
    sanitizeJsonNewlines,
    extractFirstJsonObject,
};