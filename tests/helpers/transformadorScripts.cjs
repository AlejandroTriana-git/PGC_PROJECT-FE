// ============================================================
// Transformador de Jest para los scripts "clásicos" del navegador.
//
// Problema: js/*.js y components/*.js declaran funciones y constantes
// en el ámbito global (se cargan con <script>) y no exportan nada.
// Con `require()` esas declaraciones quedarían encerradas en el módulo
// y los demás archivos (que llaman a escaparHtml, peticionApi, etc.
// "a secas") no las verían.
//
// Solución: al final de cada archivo se añade código que publica en
// `window` cada declaración de nivel superior:
//   - function / const  → solo lectura
//   - let               → lectura y escritura (los tests pueden
//                          preparar el estado, p. ej. `pgc_actual`)
// El código fuente del proyecto NO se modifica. Las líneas añadidas
// llevan `istanbul ignore next` para no inflar la cobertura.
// ============================================================
const NIVEL_SUPERIOR = /^(?:(async\s+)?function\s+([A-Za-z_$][\w$]*)|(const|let|var)\s+([A-Za-z_$][\w$]*))/gm;

function publicar(nombre, escribible) {
  const setter = escribible ? `, set(v) { ${nombre} = v; }` : "";
  return (
    `/* istanbul ignore next */\n` +
    `Object.defineProperty(globalThis, ${JSON.stringify(nombre)}, ` +
    `{ configurable: true, get() { return ${nombre}; }${setter} });\n`
  );
}

module.exports = {
  process(codigo) {
    let extra = "\n";
    let coincidencia;
    while ((coincidencia = NIVEL_SUPERIOR.exec(codigo)) !== null) {
      const [, , nombreFuncion, tipo, nombreVariable] = coincidencia;
      if (nombreFuncion) extra += publicar(nombreFuncion, false);
      else extra += publicar(nombreVariable, tipo !== "const");
    }
    return { code: codigo + extra };
  },
};
