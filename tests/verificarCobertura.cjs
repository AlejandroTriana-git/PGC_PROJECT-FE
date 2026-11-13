#!/usr/bin/env node
// ============================================================
// verificarCobertura.js — comprueba que las pruebas unitarias cubren,
// como mínimo, el 70 % del código del FE (js/ y components/).
//
// Uso:
//   npm run cobertura            → corre las pruebas y luego este análisis
//   npm run verificar-cobertura  → solo el análisis (usa el último reporte)
//
// Lee coverage/coverage-summary.json (lo genera Jest) y:
//   1. calcula el total y el detalle por archivo,
//   2. exige que líneas, sentencias y funciones lleguen al umbral
//      (las ramas se muestran, pero no bloquean),
//   3. exige que TODO archivo del FE aparezca en el reporte: un archivo
//      que se agregue y nadie mida no puede "esconderse" del cálculo,
//   4. termina con código 1 si algo falla (sirve para CI / pre-push).
// ============================================================
const fs = require("fs");
const path = require("path");

const UMBRAL = 70;
const METRICAS_QUE_BLOQUEAN = ["lines", "statements", "functions"];
const METRICAS_INFORMATIVAS = ["branches"];
const CARPETAS_FE = ["js", "components"];

/** Lista los .js del FE (rutas relativas a la raíz, con "/"). */
function listarArchivosFE(raiz) {
  const archivos = [];
  const recorrer = (carpeta) => {
    for (const entrada of fs.readdirSync(path.join(raiz, carpeta), { withFileTypes: true })) {
      const relativa = `${carpeta}/${entrada.name}`;
      if (entrada.isDirectory()) recorrer(relativa);
      else if (entrada.name.endsWith(".js")) archivos.push(relativa);
    }
  };
  CARPETAS_FE.forEach((c) => fs.existsSync(path.join(raiz, c)) && recorrer(c));
  
  // Solución para SonarQube: función de comparación explícita
  return archivos.sort((a, b) => a.localeCompare(b));
}

const aPorcentaje = (metrica) => (metrica && typeof metrica.pct === "number" ? metrica.pct : null);

/**
 * Analiza un coverage-summary.json ya leído.
 * @param {object} resumen - contenido de coverage-summary.json
 * @param {{umbral?: number, raiz?: string, archivosFE?: string[]}} opciones
 * @returns {{aprobado: boolean, umbral: number, total: object, porArchivo: object[], noMedidos: string[], fallos: string[]}}
 */
function analizarCobertura(resumen, opciones = {}) {
  const { umbral = UMBRAL, raiz = process.cwd(), archivosFE = [] } = opciones;
  const total = resumen.total || {};

  const porArchivo = Object.entries(resumen)
    .filter(([clave]) => clave !== "total")
    .map(([clave, datos]) => ({
      archivo: path.relative(raiz, clave).split(path.sep).join("/"),
      lines: aPorcentaje(datos.lines),
      statements: aPorcentaje(datos.statements),
      functions: aPorcentaje(datos.functions),
      branches: aPorcentaje(datos.branches),
    }))
    .sort((a, b) => (a.lines ?? 100) - (b.lines ?? 100));

  const medidos = new Set(porArchivo.map((f) => f.archivo));
  const noMedidos = archivosFE.filter((archivo) => !medidos.has(archivo));

  const fallos = [];
  for (const metrica of METRICAS_QUE_BLOQUEAN) {
    const pct = aPorcentaje(total[metrica]);
    if (pct === null) fallos.push(`No hay datos de cobertura de ${metrica}.`);
    else if (pct < umbral) fallos.push(`Cobertura de ${metrica}: ${pct}% (mínimo ${umbral}%).`);
  }
  noMedidos.forEach((archivo) => fallos.push(`El archivo ${archivo} no aparece en el reporte de cobertura.`));

  return { aprobado: fallos.length === 0, umbral, total: resumirTotal(total), porArchivo, noMedidos, fallos };
}

function resumirTotal(total) {
  const salida = {};
  [...METRICAS_QUE_BLOQUEAN, ...METRICAS_INFORMATIVAS].forEach((m) => {
    salida[m] = aPorcentaje(total[m]);
  });
  return salida;
}

const fmt = (valor) => (valor === null ? "  n/a" : `${valor.toFixed(1)}%`.padStart(6));

function imprimirInforme(resultado, escribir = console.log) {
  escribir("\nCobertura de las pruebas unitarias del FE\n");
  escribir("Archivo".padEnd(34) + "Líneas".padStart(8) + "Sentenc.".padStart(9) + "Funcion.".padStart(9) + "Ramas".padStart(8));
  resultado.porArchivo.forEach((f) => {
    const marca = f.lines !== null && f.lines < resultado.umbral ? " ←" : "";
    escribir(f.archivo.padEnd(34) + fmt(f.lines).padStart(8) + fmt(f.statements).padStart(9) + fmt(f.functions).padStart(9) + fmt(f.branches).padStart(8) + marca);
  });
  escribir("-".repeat(68));
  const t = resultado.total;
  escribir("TOTAL".padEnd(34) + fmt(t.lines).padStart(8) + fmt(t.statements).padStart(9) + fmt(t.functions).padStart(9) + fmt(t.branches).padStart(8));
  escribir("");
  if (resultado.aprobado) {
    escribir(`✔ Se cumple el mínimo de ${resultado.umbral}% de cobertura (líneas, sentencias y funciones).`);
  } else {
    escribir(`✘ No se cumple el mínimo de ${resultado.umbral}%:`);
    resultado.fallos.forEach((f) => escribir(`  - ${f}`));
    escribir("  Los archivos marcados con ← son los que más ayudan a subir el total.");
  }
}

function main() {
  const raiz = path.resolve(__dirname, "..");
  const ruta = path.join(raiz, "coverage", "coverage-summary.json");
  if (!fs.existsSync(ruta)) {
    console.error("No existe coverage/coverage-summary.json. Ejecuta primero: npm run cobertura");
    process.exit(1);
  }
  const resumen = JSON.parse(fs.readFileSync(ruta, "utf8"));
  const resultado = analizarCobertura(resumen, { raiz, archivosFE: listarArchivosFE(raiz) });
  imprimirInforme(resultado);
  process.exit(resultado.aprobado ? 0 : 1);
}

if (require.main === module) main();

module.exports = { analizarCobertura, listarArchivosFE, imprimirInforme, UMBRAL };
