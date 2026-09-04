const fs = require("fs"); 
const path = require("path"); 

/**
 * Corrige uma inconsistência comum de LLM: mesmo com o número do contrato já
 * formatado corretamente em "dados_gerais.contrato" (ex: "700-0567-004373-4"),
 * a IA às vezes reescreve o MESMO número com pontuação diferente dentro de
 * textos livres (obs, análise individual, fundamentação) — ex: "700.567.4373-4"
 * ou incluindo o prefixo de sistema original "001.700.0567.00004373-4".
 * Varre recursivamente o objeto e força qualquer menção reconhecível ao
 * número do contrato (em qualquer pontuação) para o valor canônico —
 * garante consistência sempre, sem depender de a IA acertar todas as vezes.
 */
function buildContractNumberPattern(canonical) {
    const parts = canonical.split('-');
    if (parts.length !== 4) return null;

    const flexSegment = (segment) => {
        const stripped = segment.replace(/^0+(?=\d)/, '');
        if (stripped === '') return '0+';
        return `0*${stripped}`;
    };

    const sep = String.raw`[.\-\s/]?`;
    const prefix = String.raw`(?:\d{2,4}${sep})?`;

    const pattern =
        prefix +
        flexSegment(parts[0]) + sep +
        flexSegment(parts[1]) + sep +
        flexSegment(parts[2]) + sep +
        flexSegment(parts[3]) +
        String.raw`(?!\d)`;

    return new RegExp(pattern, 'g');
}

function canonicalizeContractNumbers(node, canonical, regex) {
    if (typeof node === 'string') {
        return node.replace(regex, canonical);
    }
    if (Array.isArray(node)) {
        return node.map((item) => canonicalizeContractNumbers(item, canonical, regex));
    }
    if (node && typeof node === 'object') {
        const result = {};
        for (const key of Object.keys(node)) {
            result[key] = canonicalizeContractNumbers(node[key], canonical, regex);
        }
        return result;
    }
    return node;
}

/**
 * Corrige uma inconsistência recorrente de LLM: quando a Certidão de Óbito
 * própria não foi recebida ("recebido": "Não" no checklist), o campo
 * "obito_nome" às vezes acaba preenchido com o nome de SOLTEIRA da pessoa
 * (extraído indevidamente de uma menção incidental em outra certidão, como
 * uma averbação de divórcio), quando o correto — na ausência de uma
 * certidão de óbito própria — é usar o nome de CASADA (o mesmo valor já
 * calculado em "cas_X_cas"). Isso já foi reforçado várias vezes só via
 * prompt sem sucesso consistente, então aqui é corrigido de forma
 * determinística, sempre, depois que o JSON já veio da IA.
 */
function normalizeObitoNomeInReport(data) {
    try {
        const relatorio = data?.relatorio;
        if (!relatorio) return data;

        const checklist = relatorio.checklist;
        if (!Array.isArray(checklist)) return data;

        const itemObito = checklist.find((i) => i && i.documento === 'Certidão de Óbito');
        const certidaoObitoRecebida = itemObito && String(itemObito.recebido).trim().toLowerCase() === 'sim';

        if (certidaoObitoRecebida) return data;

        const requerentes = relatorio.requerentes;
        if (!Array.isArray(requerentes)) return data;

        const normalizar = (texto) =>
            typeof texto === 'string' ? texto.trim().toLowerCase() : '';

        for (const req of requerentes) {
            if (!req || typeof req.obito_nome !== 'string') continue;
            const obitoNomeNormalizado = normalizar(req.obito_nome);
            if (!obitoNomeNormalizado) continue;

            for (const n of [1, 2]) {
                const solt = req[`cas_${n}_solt`];
                const cas = req[`cas_${n}_cas`];
                if (typeof solt !== 'string' || typeof cas !== 'string') continue;
                if (normalizar(solt) === '' || normalizar(cas) === '') continue;
                if (normalizar(solt) === normalizar(cas)) continue;

                if (obitoNomeNormalizado === normalizar(solt)) {
                    req.obito_nome = cas;
                }
            }
        }

        return data;
    } catch (err) {
        console.error('[normalizeObitoNomeInReport] erro:', err.message);
        return data;
    }
}

/**
 * Corrige uma inconsistência recorrente de LLM (já confirmada em 2 casos
 * reais diferentes, mesmo depois de reforçada só via prompt): quando a
 * MESMA pessoa e o MESMO número de RG aparecem tanto em "partes[]"/
 * "cessionarios[]" quanto em "requerentes[]", os campos "orgao" e
 * "data_exp" às vezes saem divergentes entre os dois objetos. Aqui,
 * depois que o JSON já veio da IA, identifica-se o mesmo número de RG
 * (normalizado, ignorando pontuação) repetido entre "partes"/
 * "cessionarios" e "requerentes", e força "orgao"/"data_exp" a baterem —
 * quando ambos estão preenchidos e divergentes, mantém o valor de
 * "partes"/"cessionarios" e REGISTRA UM AVISO no checklist para
 * conferência manual, em vez de escolher um lado silenciosamente.
 */
function normalizeRgId(identidade) {
    return typeof identidade === 'string'
        ? identidade.replace(/[.\-\s]/g, '').toUpperCase()
        : '';
}

function isEmptyRgField(value) {
    if (typeof value !== 'string') return true;
    const v = value.trim().toLowerCase();
    return v === '' || v === 'n/a' || v === 'não localizado';
}

function canonicalizeRgFieldsInReport(data) {
    try {
        const relatorio = data?.relatorio;
        if (!relatorio) return data;

        const fontes = [];
        for (const grupo of ['partes', 'cessionarios']) {
            const arr = relatorio[grupo];
            if (Array.isArray(arr)) {
                for (const obj of arr) {
                    if (obj && typeof obj.identidade === 'string') fontes.push(obj);
                }
            }
        }
        if (!fontes.length) return data;

        const requerentes = relatorio.requerentes;
        if (!Array.isArray(requerentes)) return data;

        const avisos = [];

        for (const req of requerentes) {
            if (!req || typeof req.identidade !== 'string') continue;
            const chaveReq = normalizeRgId(req.identidade);
            if (!chaveReq) continue;

            const fonte = fontes.find((f) => normalizeRgId(f.identidade) === chaveReq);
            if (!fonte) continue;

            for (const campo of ['orgao', 'data_exp']) {
                const valorFonte = fonte[campo];
                const valorReq = req[campo];
                const fonteVazia = isEmptyRgField(valorFonte);
                const reqVazio = isEmptyRgField(valorReq);

                if (fonteVazia && !reqVazio) {
                    fonte[campo] = valorReq;
                } else if (!fonteVazia && !reqVazio && normalizeRgId(valorFonte) !== normalizeRgId(valorReq)) {
                    req[campo] = valorFonte;
                    avisos.push(
                        `Divergência não resolvida automaticamente no campo "${campo}" do RG ${fonte.identidade || req.identidade} (${fonte.nome || fonte.mutuario || req.nome || 'pessoa não identificada'}): "${valorFonte}" (partes/cessionarios) x "${valorReq}" (requerentes). Confirmar manualmente contra o documento físico.`
                    );
                } else {
                    req[campo] = valorFonte;
                }
            }
        }

        if (avisos.length) {
            const checklist = relatorio.checklist;
            if (Array.isArray(checklist)) {
                const itemIdentidade = checklist.find((i) => i && i.documento === 'CNH / Identidade');
                if (itemIdentidade && typeof itemIdentidade.obs === 'string') {
                    itemIdentidade.obs = itemIdentidade.obs.trim() + '\n\n⚠️ ' + avisos.join('\n⚠️ ');
                }
            }
        }

        return data;
    } catch (err) {
        console.error('[canonicalizeRgFieldsInReport] erro:', err.message);
        return data;
    }
}

/*
 * NOTA: uma função "enforceProfessionFromProfessionalId" (que tentava corrigir
 * a profissão a partir de carteiras profissionais como OAB/CRM citadas no
 * checklist) foi AVALIADA e REMOVIDA por decisão do usuário: ela sobrescrevia
 * incondicionalmente a profissão, inclusive quando já estava correta e mais
 * específica (ex: trocava "Advogado Tributarista" por "Advogado(a)"), e podia
 * atribuir a profissão à pessoa errada quando a carteira profissional
 * pertencia a um procurador/representante, não ao mutuário. A correção desse
 * bug de profissão fica só a cargo do prompt (regra 5), não de código.
 */

function normalizeContractNumberInReport(data) {
    try {
        const canonical = data?.relatorio?.dados_gerais?.contrato;
        if (!canonical || typeof canonical !== 'string') return data;

        const regex = buildContractNumberPattern(canonical);
        if (!regex) return data;

        return canonicalizeContractNumbers(data, canonical, regex);
    } catch (err) {
        console.error('[normalizeContractNumberInReport] erro:', err.message);
        return data;
    }
}

/**
 * Corrige uma inconsistência recorrente de LLM: quando o processo tem
 * cláusula de irrevogabilidade/irretratabilidade comprovada (campos
 * "procuracao.poder_irrevogavel" ou "poder_irretratavel" = "☒"), a menção a
 * essa cláusula às vezes só sai no campo "obs" da linha "CONTRATO" em
 * "analise_ind", mas não é copiada para o campo "obs" do item "Contrato" do
 * checklist — mesmo com o prompt exigindo isso explicitamente. Corrigido
 * aqui de forma determinística, reaproveitando a identificação exata da
 * cláusula (ex: "(Cláusula Nona)") que a própria IA já escreveu em
 * "analise_ind", quando disponível, para nunca inventar uma referência que
 * não está no texto já extraído pela IA.
 */
function ensureIrrevogabilidadeClauseInChecklist(data) {
    try {
        const relatorio = data?.relatorio;
        if (!relatorio) return data;

        const procuracao = relatorio.procuracao;
        const irrevogavel = procuracao?.poder_irrevogavel === '☒';
        const irretratavel = procuracao?.poder_irretratavel === '☒';
        if (!irrevogavel && !irretratavel) return data;

        const checklist = relatorio.checklist;
        if (!Array.isArray(checklist)) return data;

        const itemContrato = checklist.find((i) => i && i.documento === 'Contrato');
        if (!itemContrato || typeof itemContrato.obs !== 'string') return data;

        const jaMenciona = /irrevogabilidade|irretratabilidade/i.test(itemContrato.obs);
        if (jaMenciona) return data;

        let identificacao = '';
        const analiseInd = relatorio.analise_ind;
        if (Array.isArray(analiseInd)) {
            const itemAnaliseContrato = analiseInd.find((i) => i && i.documento === 'CONTRATO');
            if (itemAnaliseContrato && typeof itemAnaliseContrato.obs === 'string') {
                const match = itemAnaliseContrato.obs.match(/\(Cláusula[^)]*\)/i);
                if (match) identificacao = ' ' + match[0];
            }
        }

        const frase = `O contrato contém cláusula de irrevogabilidade e irretratabilidade${identificacao}, vedando direito de arrependimento ou desistência.`;

        itemContrato.obs = itemContrato.obs.trim() + '\n\n' + frase;

        return data;
    } catch (err) {
        console.error('[ensureIrrevogabilidadeClauseInChecklist] erro:', err.message);
        return data;
    }
}


function escapeHtml(value) {          
    return String(value)                  
        .replace(/&/g, "&amp;")                  
        .replace(/</g, "&lt;")                  
        .replace(/>/g, "&gt;")                  
        .replace(/"/g, "&quot;")                  
        .replace(/'/g, "&#39;"); 
} 

function formatArray(array) {          
    if (!array.length) return "";          
    return `<ul>\n${array.map(item => `  <li>${escapeHtml(item)}</li>`).join("\n")}\n</ul>`; 
} 

function convertLineBreaksAndBullets(text) {
    if (text.indexOf('\n') === -1 && !text.trim().startsWith('- ')) {
        return text;
    }

    const lines = text.split('\n');
    const blocks = [];
    let currentList = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('- ')) {
            if (!currentList) currentList = [];
            currentList.push(line.slice(2));
        } else {
            if (currentList) {
                blocks.push({ type: 'list', items: currentList });
                currentList = null;
            }
            blocks.push({ type: 'line', content: line });
        }
    }
    if (currentList) blocks.push({ type: 'list', items: currentList });

    let html = '';
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.type === 'list') {
            html += '<ul>' + b.items.map(it => `<li>${it}</li>`).join('') + '</ul>';
        } else {
            html += b.content;
            if (i < blocks.length - 1) html += '<br>';
        }
    }
    return html;
}

function formatValue(value) {          
    if (value === null || value === undefined) return "";          
    if (Array.isArray(value)) return formatArray(value);          
    if (typeof value === "boolean") return value ? "Sim" : "Não";          
    if (typeof value === "number") return String(value);          
       
    let safeString = escapeHtml(value);          
      
    safeString = safeString.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');     
    safeString = convertLineBreaksAndBullets(safeString);
    return safeString; 
} 

function getValue(data, key) {          
    return key.trim().split(".").reduce((obj, property) => obj?.[property], data); 
} 


function replaceLoops(html, data) {
    const loopRegex = /{{#([\w.]+)}}([\s\S]*?){{\/\1}}/g;
    return html.replace(loopRegex, (_, key, content) => {
        const array = getValue(data, key);
        if (!Array.isArray(array)) return "";
       
        return array.map(item => replacePlaceholders(content, item)).join("\n");
    });
}

/**
 * Bloco condicional: {{?campo}}...{{/campo}} só é mantido no HTML final se
 * "campo" existir e "tiver conteúdo" (array não-vazio, string não-vazia e
 * diferente de "N/A"/"Não localizado", ou valor truthy).
 */
function hasContent(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (value === null || value === undefined) return false;
    const s = String(value).trim();
    if (s === "") return false;
    if (s === "N/A" || s === "Não localizado") return false;
    return true;
}

function replaceConditionalBlocks(html, data) {
    const condRegex = /{{\?([\w.]+)}}([\s\S]*?){{\/\1}}/g;
    return html.replace(condRegex, (_, key, content) => {
        const value = getValue(data, key);
        return hasContent(value) ? content : "";
    });
}

function replacePlaceholders(html, data) {          
    return html.replace(/{{(.*?)}}/g, (match, key) => {                  
        if (key.trim().startsWith('#') || key.trim().startsWith('/')) return match;
        
        const value = getValue(data, key);                  
        return formatValue(value);          
    }); 
} 


function generateHtml(data, templateName = "formTemplate_v2.html") {          
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) {}
    }

    data = normalizeContractNumberInReport(data);
    data = normalizeObitoNomeInReport(data);
    data = ensureIrrevogabilidadeClauseInChecklist(data);
    data = canonicalizeRgFieldsInReport(data); // sincroniza orgao/data_exp entre partes/requerentes

    let dadosReais = data;
    if (data && data.relatorio && templateName.includes("formTemplate")) {
        dadosReais = data.relatorio;
    }

    try {
        const logoPath = path.join(__dirname, "../templates/logo.png");
        if (fs.existsSync(logoPath)) {
            dadosReais.logo = "data:image/png;base64," + fs.readFileSync(logoPath).toString("base64");
        }
    } catch (err) {}

    const templatePath = path.join(__dirname, "../templates", templateName);          
    const template = fs.readFileSync(templatePath, "utf8");          
    
    let processedHtml = replaceLoops(template, dadosReais);
    processedHtml = replaceConditionalBlocks(processedHtml, dadosReais);
    processedHtml = replacePlaceholders(processedHtml, dadosReais);
    
    return processedHtml; 
}

module.exports = { generateHtml };