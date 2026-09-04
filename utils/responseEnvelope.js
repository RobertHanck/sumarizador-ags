
function successEnvelope({ nomeDocumento, imovelUnico, relatorio, minuta }) {
  return {
    sucesso: true,
    nomeDocumento,
    imovelUnico,
    relatorio,
    minuta,
  };
}

function errorEnvelope({ codigo, mensagem, detalhes }) {
  return {
    sucesso: false,
    erro: {
      codigo,
      mensagem,
      ...(detalhes ? { detalhes } : {}),
    },
  };
}

module.exports = { successEnvelope, errorEnvelope };
