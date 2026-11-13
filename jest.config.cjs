// ============================================================
// Configuración de Jest para el FE del PGC (HTML + JS plano).
//
// Los scripts del proyecto NO son módulos: se cargan con <script> y
// comparten funciones globales. Para poder medirlos con Jest sin tocar
// el código fuente, el transformador tests/helpers/transformadorScripts.js
// los expone en `window` al requerirlos (ver ese archivo).
//
// El umbral del 70 % NO está aquí: lo comprueba
// tests/verificarCobertura.js (npm run cobertura), que además
// imprime el detalle por archivo.
// ============================================================
module.exports = {
  testEnvironment: "jsdom",
  testEnvironmentOptions: { url: "http://localhost/" },
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  clearMocks: true,

  transform: {
    "[\\\\/](js|components)[\\\\/].+\\.js$": "<rootDir>/tests/helpers/transformadorScripts.cjs",
  },

  // Todo el código del FE cuenta, aunque todavía no tenga pruebas
  // (un archivo sin pruebas aparece con 0 % y baja el total).
  collectCoverageFrom: ["js/**/*.js", "components/**/*.js"],
  coverageDirectory: "coverage",
  coverageReporters: ["text-summary", "json-summary", "lcov"],
};
