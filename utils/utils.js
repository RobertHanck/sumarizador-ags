function formatBrazilianDateTime(date) {
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

module.exports = { formatBrazilianDateTime };
