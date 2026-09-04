const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const app = require("./app");
const config = require("./infra/config");
const { formatBrazilianDateTime } = require("./utils/utils");
const { ENVIRONMENTS } = require("./types/environments");
const { version } = require("./package.json");

const { ENV, SERVER } = config;
const PORT = SERVER.PORT || 3000;

if (ENV !== ENVIRONMENTS.development) {
  const privateKeyPath = path.join(__dirname, "ssl", "_agsdoc_com_br.key");
  const fullchainPath = path.join(__dirname, "ssl", "_agsdoc_com_br.pem");
  const privateKey = fs.readFileSync(privateKeyPath, "utf8");
  const certificate = fs.readFileSync(fullchainPath, "utf8");
  const credentials = { key: privateKey, cert: certificate };

  https.createServer(credentials, app).listen(PORT, () => {
    console.log(
      `Servidor seguro rodando em ${SERVER.URL}:${PORT} - Ambiente: ${ENV} - Versão: ${version}`
    );
  });
} else {
  http.createServer(app).listen(PORT, () => {
    console.log(
      `Servidor rodando em ${SERVER.URL}:${PORT} - ${formatBrazilianDateTime(
        new Date()
      )} - Ambiente: ${ENV} - Versão: ${version}`
    );
  });
}
