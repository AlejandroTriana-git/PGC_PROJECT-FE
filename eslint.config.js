import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**"] },
  js.configs.recommended,
    {
    files: ["**/*.js"],
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
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-redeclare": ["error", { builtinGlobals: false }],
    },
  },
  {
    files: ["eslint.config.js"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
];