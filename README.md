# AGS IA

API para interpretação de arquivos PDF via IA, com contrato HTTP padronizado.

Recebe um ou mais PDFs em base64, processa o conteúdo e devolve **relatório** e **minuta** em JSON, HTML e Word (base64).

> **Status atual:** a rota de interpretação já valida autenticação, body e formato de resposta. O processamento com IA ainda está em implementação (resposta mock).

---

## Requisitos

- Node.js 18+
- Arquivo `.env` na raiz do projeto
- Em `homolog` / `production`: certificados SSL em `ssl/`

---

## Configuração

Crie um `.env` com:

```env
ENV=development
# ENV=homolog
# ENV=production

SERVER_HOST=localhost
SERVER_PORT=2207
SERVER_URL=http://localhost

API_KEY=sua-chave-secreta

# Limite do body JSON (PDFs em base64). Padrão: 50mb
BODY_LIMIT=50mb
```

| Variável       | Descrição                                              |
|----------------|--------------------------------------------------------|
| `ENV`          | `development`, `homolog` ou `production`               |
| `SERVER_PORT`  | Porta do servidor                                      |
| `SERVER_URL`   | URL base usada nos logs                                |
| `API_KEY`      | Chave exigida no header `x-api-key`                    |
| `BODY_LIMIT`   | Limite do payload JSON (ex.: `50mb`, `100mb`)          |

### Ambientes e SSL

| Ambiente       | Protocolo | Certificados                          |
|----------------|-----------|---------------------------------------|
| `development`  | HTTP      | Não usa                               |
| `homolog`      | HTTPS     | `ssl/_agsdoc_com_br.key` e `.pem`     |
| `production`   | HTTPS     | `ssl/_agsdoc_com_br.key` e `.pem`     |

---

## Como rodar

```bash
npm install
npm run server   # com nodemon
# ou
npm run dev      # node server.js
```

Por padrão: `http://localhost:2207`

---

## Autenticação

Rotas sob `/api` exigem o header:

```http
x-api-key: <API_KEY do .env>
```

Sem a chave ou com chave inválida → `401 UNAUTHORIZED`.

---

## Endpoints

### `GET /`

Health check da API.

```json
{
  "message": "API AGS IA",
  "version": "1.0.0",
  "timestamp": "31/07/2026 15:00:00",
  "status": "OK"
}
```

### `GET /ping`

```json
{
  "message": "pong",
  "timestamp": "31/07/2026 15:00:00",
  "status": "OK"
}
```

### `POST /api/documents/interpret`

Interpreta PDFs e retorna relatório + minuta.

**Headers**

| Header         | Obrigatório | Descrição        |
|----------------|-------------|------------------|
| `Content-Type` | Sim         | `application/json` |
| `x-api-key`    | Sim         | Chave da API     |

**Body**

```json
{
  "nomeDocumento": "Diomar Cangussu",
  "pdfs": [
    "JVBERi0xLjQK...",
    "JVBERi0xLjQK..."
  ]
}
```

| Campo            | Tipo       | Regras                                                                 |
|------------------|------------|------------------------------------------------------------------------|
| `nomeDocumento`  | `string`   | Obrigatório, não vazio                                                 |
| `pdfs`           | `string[]` | Ao menos 1 item; cada um deve ser PDF em base64 válido                 |

Aceita base64 puro, com quebras de linha ou prefixo `data:application/pdf;base64,`.  
Campos extras no body são rejeitados.

**Resposta de sucesso (`200`)**

```json
{
  "sucesso": true,
  "nomeDocumento": "Diomar Cangussu",
  "relatorio": {
    "dadosJson": {},
    "html": "<!DOCTYPE html>...",
    "wordBase64": "UEsDBBQABgAI..."
  },
  "minuta": {
    "dadosJson": {},
    "html": "<!DOCTYPE html>...",
    "wordBase64": "UEsDBBQABgAI..."
  }
}
```

| Campo                     | Descrição                                      |
|---------------------------|------------------------------------------------|
| `relatorio.dadosJson`     | Dados estruturados extraídos do relatório      |
| `relatorio.html`          | Relatório em HTML                              |
| `relatorio.wordBase64`    | Arquivo Word (.docx) em base64                 |
| `minuta.*`                | Mesma estrutura para a minuta                  |

**Exemplo (cURL)**

```bash
curl -X POST http://localhost:2207/api/documents/interpret \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_API_KEY" \
  -d @payload.json
```

---

## Contrato de erro

Erros seguem o envelope:

```json
{
  "sucesso": false,
  "erro": {
    "codigo": "VALIDATION_ERROR",
    "mensagem": "Body da requisição inválido.",
    "detalhes": [
      {
        "campo": "pdfs.0",
        "mensagem": "Cada item de pdfs deve ser um PDF em base64 válido."
      }
    ]
  }
}
```

| Código               | HTTP | Quando                                              |
|----------------------|------|-----------------------------------------------------|
| `UNAUTHORIZED`       | 401  | `x-api-key` ausente ou inválida                     |
| `VALIDATION_ERROR`   | 400  | Body inválido (Zod)                                 |
| `PAYLOAD_TOO_LARGE`  | 413  | Body maior que `BODY_LIMIT`                         |
| `INTERNAL_ERROR`     | 500  | Erro interno / resposta inválida gerada pelo servidor |

---

## Estrutura do projeto

```text
ags-ia/
├── app.js                 # Express, middlewares globais, rotas públicas
├── server.js              # Bootstrap HTTP/HTTPS
├── controllers/           # Handlers das rotas
├── middleware/            # Auth, validação Zod, error handler
├── schemas/               # Schemas Zod (request/response)
├── routes/                # Rotas /api
├── infra/config.js        # Variáveis de ambiente
├── types/                 # Tipos/constantes (ex.: environments)
├── utils/                 # Envelope de resposta, AppError, helpers
└── ssl/                   # Certificados (homolog/production)
```

---

## Observações

- O limite de tamanho vale para o **JSON inteiro** (base64 aumenta ~33% o tamanho do PDF original).
- Ajuste `BODY_LIMIT` se for enviar vários PDFs grandes.
- Não versionar `.env` nem expor a `API_KEY`.
