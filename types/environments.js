/**
 * @typedef {'development' | 'production' | 'homolog'} Environment
 */

/** @type {Readonly<Record<Environment, Environment>>} */
const ENVIRONMENTS = Object.freeze({
  development: "development",
  production: "production",
  homolog: "homolog",
});

/**
 * @param {unknown} value
 * @returns {value is Environment}
 */
function isEnvironment(value) {
  return (
    typeof value === "string" &&
    Object.values(ENVIRONMENTS).includes(/** @type {Environment} */ (value))
  );
}

module.exports = {
  ENVIRONMENTS,
  isEnvironment,
};
