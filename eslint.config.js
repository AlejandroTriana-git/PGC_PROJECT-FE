import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "coverage/**"] },
  js.configs.recommended,

  // 1) Código del navegador (js/ y components/)
  {
    files: ["js/**/*.js", "components/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        bootstrap: "readonly",
        URL_API: "readonly",
        obtenerToken: "readonly",
        obtenerUsuario: "readonly",
        obtenerContextoActivo: "readonly",
        establecerContextoActivo: "readonly",
        escaparHtml: "readonly",
        peticionApi: "readonly",
        renderEnlacePdf: "readonly",
        mostrarBanner: "readonly",
        ocultarBanner: "readonly",
        cerrarSesion: "readonly",
        decodificarJWT: "readonly",
        estaAutenticado: "readonly",
        listaChips: "readonly",
        aplanarOpciones: "readonly",
        construirMenu: "readonly",
        obtenerOpcionesOcultas: "readonly",
        bloqueTexto: "readonly",
        bloqueCampo: "readonly",
        crearListaDocumento: "readonly",
        validarCampos: "readonly",
        enfocarBanner: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-redeclare": ["error", { builtinGlobals: false }],
    },
  },

  // 2) Pruebas (Jest)
  {
    files: ["tests/**/*.js", "tests/**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.browser,
      },
    },
    rules: {
      "no-unused-vars": "off",
      // Los tests cargan los scripts de js/ dinámicamente
      "no-undef": "off",
    },
  },

  // 3) El propio archivo de configuración
  {
    files: ["eslint.config.js"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
];