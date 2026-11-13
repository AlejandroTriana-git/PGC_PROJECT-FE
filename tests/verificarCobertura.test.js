const path = require("path");
const { analizarCobertura, listarArchivosFE, imprimirInforme, UMBRAL } = require("./verificarCobertura");
const { RAIZ } = require("./helpers/entorno");

const metrica = (pct) => ({ total: 100, covered: pct, skipped: 0, pct });
const archivo = (pct) => ({ lines: metrica(pct), statements: metrica(pct), functions: metrica(pct), branches: metrica(pct) });
const abs = (rel) => path.join(RAIZ, rel);

const resumen = (porcentajes) => ({
  total: archivo(porcentajes.total),
  [abs("js/auth.js")]: archivo(porcentajes.auth ?? 90),
  [abs("js/utils.js")]: archivo(porcentajes.utils ?? 80),
});

describe("analizarCobertura", () => {
  test("el umbral por defecto es 70", () => {
    expect(UMBRAL).toBe(70);
  });

  test("aprueba cuando el total llega al umbral", () => {
    const r = analizarCobertura(resumen({ total: 70 }), { raiz: RAIZ });
    expect(r.aprobado).toBe(true);
    expect(r.fallos).toEqual([]);
  });

  test("reprueba y explica qué métrica falla", () => {
    const r = analizarCobertura(resumen({ total: 69.9 }), { raiz: RAIZ });
    expect(r.aprobado).toBe(false);
    expect(r.fallos).toHaveLength(3);
    expect(r.fallos[0]).toContain("lines: 69.9% (mínimo 70%)");
  });

  test("las ramas se muestran pero no bloquean", () => {
    const datos = resumen({ total: 80 });
    datos.total.branches = metrica(10);
    expect(analizarCobertura(datos, { raiz: RAIZ }).aprobado).toBe(true);
  });

  test("acepta otro umbral", () => {
    expect(analizarCobertura(resumen({ total: 75 }), { raiz: RAIZ, umbral: 80 }).aprobado).toBe(false);
  });

  test("ordena los archivos de menor a mayor cobertura y usa rutas relativas", () => {
    const r = analizarCobertura(resumen({ total: 85, auth: 95, utils: 60 }), { raiz: RAIZ });
    expect(r.porArchivo.map((f) => f.archivo)).toEqual(["js/utils.js", "js/auth.js"]);
  });

  test("falla si un archivo del FE no aparece en el reporte", () => {
    const r = analizarCobertura(resumen({ total: 90 }), { raiz: RAIZ, archivosFE: ["js/auth.js", "js/nuevo.js"] });
    expect(r.aprobado).toBe(false);
    expect(r.noMedidos).toEqual(["js/nuevo.js"]);
    expect(r.fallos.join(" ")).toContain("js/nuevo.js");
  });

  test("falla si el reporte no trae datos de una métrica", () => {
    const r = analizarCobertura({ total: { lines: { pct: "Unknown" } } }, { raiz: RAIZ });
    expect(r.aprobado).toBe(false);
    expect(r.fallos.join(" ")).toContain("No hay datos de cobertura de lines");
  });

  test("un archivo sin datos de líneas (p. ej. vacío) no rompe el análisis", () => {
    const datos = resumen({ total: 90 });
    datos[abs("js/reportes.js")] = { lines: { pct: "Unknown" } };
    expect(() => analizarCobertura(datos, { raiz: RAIZ })).not.toThrow();
  });
});

describe("listarArchivosFE", () => {
  test("lista los .js de js/ y components/ del proyecto", () => {
    const lista = listarArchivosFE(RAIZ);
    expect(lista).toContain("js/auth.js");
    expect(lista).toContain("components/sidebar.js");
    expect(lista.every((f) => f.endsWith(".js"))).toBe(true);
  });
  test("una carpeta inexistente se ignora", () => {
    expect(listarArchivosFE(path.join(RAIZ, "no-existe"))).toEqual([]);
  });
});

describe("imprimirInforme", () => {
  test("informa éxito o los fallos", () => {
    const salida = [];
    const escribir = (t) => salida.push(t);
    imprimirInforme(analizarCobertura(resumen({ total: 80 }), { raiz: RAIZ }), escribir);
    expect(salida.join("\n")).toContain("Se cumple el mínimo de 70%");

    salida.length = 0;
    imprimirInforme(analizarCobertura(resumen({ total: 50, utils: 40 }), { raiz: RAIZ }), escribir);
    const texto = salida.join("\n");
    expect(texto).toContain("No se cumple el mínimo de 70%");
    expect(texto).toContain("js/utils.js");
    expect(texto).toContain("←");
  });
});
