// fichaPgc.js y buscarPgc.js (páginas públicas)
const {
  cargarBase, cargar, cargarHtml, simularApi, ok, estado, falloDeRed, esperar,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("js/fichaPgc.js", "js/buscarPgc.js");
});

const $ = (id) => document.getElementById(id);
const irA = (url) => window.history.pushState({}, "", url);

beforeEach(() => {
  localStorage.clear();
  irA("/");
  Object.defineProperty(document, "referrer", { value: "", configurable: true });
});

// ───────────────────────── fichaPgc.js ─────────────────────────
describe("fichaPgc.js", () => {
  const PGC = {
    title_proposal: "Plataforma <PGC>", name_cycle: "Fundamentación", estado: "Terminado",
    problem_proposal: "Problema", justification_proposal: "Justificación",
    objectives_proposal: "Objetivos", solution_proposal: "Solución",
    categorias: [{ name_category: "IA" }, "Web"], integrantes: [{ full_name: "Ana" }, "Luis"],
    archivos: [{ id_file: 1, title_file: "Informe", desc_file: "Final", url_file: { url: "https://x/i.pdf", expira_en_segundos: 600 } }],
  };

  beforeEach(() => cargarHtml("fichaPgc.html"));

  test("textosCategoriasFicha y textosIntegrantesFicha aceptan objetos o texto", () => {
    expect(textosCategoriasFicha([{ name_category: "IA" }, "Web"])).toEqual(["IA", "Web"]);
    expect(textosCategoriasFicha(undefined)).toEqual([]);
    expect(textosIntegrantesFicha([{ full_name: "Ana" }, "Luis"])).toEqual(["Ana", "Luis"]);
    expect(textosIntegrantesFicha(null)).toEqual([]);
  });

  test("seccionArchivosFicha: sin archivos y con archivos", () => {
    expect(seccionArchivosFicha([])).toContain("no tiene archivos cargados");
    expect(seccionArchivosFicha(undefined)).toContain("no tiene archivos cargados");
    const html = seccionArchivosFicha([{ id_file: 9, title_file: "<b>x</b>", desc_file: "" }]);
    expect(html).toContain('id="enlace-archivo-9"');
    expect(html).toContain("&lt;b&gt;");
  });

  test("pintarEnlacesArchivos tolera que no haya archivos", () => {
    expect(() => pintarEnlacesArchivos(undefined)).not.toThrow();
  });

  describe("pintarFicha", () => {
    test("pinta cabecera, descripción, datos generales y enlaces de archivos", () => {
      pintarFicha(PGC);
      const c = $("contenedor-ficha");
      expect(document.title).toBe("UDEC PGC — Plataforma <PGC>");
      expect(c.querySelector("h2").textContent).toBe("Plataforma <PGC>");
      expect(c.textContent).toContain("Fundamentación");
      expect(c.querySelector(".badge-estado").classList.contains("aprobada")).toBe(true);
      expect(c.textContent).toContain("Problema");
      expect(c.querySelectorAll(".chip-dato").length).toBeGreaterThanOrEqual(5); // ciclo + 2 categorías + 2 integrantes
      expect(c.querySelector('#enlace-archivo-1 a').getAttribute("href")).toBe("https://x/i.pdf");
    });

    test("estado distinto de 'Terminado' usa el estilo pendiente", () => {
      pintarFicha({ ...PGC, estado: "En Proceso" });
      expect($("contenedor-ficha").querySelector(".badge-estado").classList.contains("pendiente")).toBe(true);
    });

    test("ciclo numérico se muestra como 'Ciclo N' y sin ciclo no hay chip de ciclo", () => {
      pintarFicha({ ...PGC, name_cycle: undefined, id_cycle: 3 });
      expect($("contenedor-ficha").querySelector(".pgc-cabecera-meta").textContent).toContain("Ciclo 3");
      pintarFicha({ title_proposal: "Solo título" });
      expect($("contenedor-ficha").querySelector(".pgc-cabecera-meta").textContent.trim()).toBe("");
    });

    test("sin título usa 'Ficha de proyecto' en el <title>", () => {
      pintarFicha({});
      expect(document.title).toBe("UDEC PGC — Ficha de proyecto");
    });

    test("enlaza al PGC anterior cuando hay continuidad", () => {
      pintarFicha({ ...PGC, id_pgc_previous: 12 });
      expect($("contenedor-ficha").querySelector('a[href="fichaPgc.html?id=12"]')).not.toBeNull();
    });

    test("textos por defecto si faltan categorías e integrantes", () => {
      pintarFicha({ title_proposal: "X" });
      expect($("contenedor-ficha").textContent).toContain("Sin categorías");
      expect($("contenedor-ficha").textContent).toContain("Solo el líder");
    });
  });

  describe("prepararEnlaceVolver", () => {
    test("si venimos de la búsqueda conserva sus filtros", () => {
      Object.defineProperty(document, "referrer", { value: "http://localhost/buscarPgc.html?q=ia&pagina=2", configurable: true });
      prepararEnlaceVolver();
      expect($("enlace-volver").getAttribute("href")).toBe("buscarPgc.html?q=ia&pagina=2");
    });
    test("sin referrer o de otro origen no cambia el enlace", () => {
      const original = $("enlace-volver").getAttribute("href");
      prepararEnlaceVolver();
      Object.defineProperty(document, "referrer", { value: "https://otro.com/buscarPgc.html?q=x", configurable: true });
      prepararEnlaceVolver();
      expect($("enlace-volver").getAttribute("href")).toBe(original);
    });
    test("no falla si el enlace no existe", () => {
      document.body.innerHTML = "";
      expect(() => prepararEnlaceVolver()).not.toThrow();
    });
  });

  describe("inicializarFichaPgc", () => {
    test("sin id en la URL lo avisa", async () => {
      await inicializarFichaPgc();
      expect($("contenedor-ficha").textContent).toContain("No se indicó qué proyecto mostrar.");
    });
    test("pide el PGC por id y lo pinta", async () => {
      irA("/fichaPgc.html?id=7");
      const fetchMock = simularApi({ "GET /pgc/7": ok(PGC) });
      await inicializarFichaPgc();
      expect(fetchMock.llamadas[0].ruta).toBe("/pgc/7");
      expect($("contenedor-ficha").querySelector("h2").textContent).toBe("Plataforma <PGC>");
    });
    test("404: el proyecto no existe", async () => {
      irA("/fichaPgc.html?id=99");
      simularApi({ "GET /pgc/99": estado(404) });
      await inicializarFichaPgc();
      expect($("contenedor-ficha").textContent).toContain("Ese proyecto no existe.");
    });
    test("otro error o sin conexión", async () => {
      irA("/fichaPgc.html?id=7");
      simularApi({ "GET /pgc/7": estado(500) });
      await inicializarFichaPgc();
      expect($("contenedor-ficha").textContent).toContain("No fue posible cargar la ficha");
      simularApi({ "GET /pgc/7": falloDeRed() });
      await inicializarFichaPgc();
      expect($("contenedor-ficha").textContent).toContain("No fue posible cargar la ficha");
    });
  });
});

// ───────────────────────── buscarPgc.js ─────────────────────────
describe("buscarPgc.js", () => {
  const RESULTADO = (extra = {}) => ({
    id_pgc: 1, title_proposal: "Proyecto <A>", name_cycle: "Fundamentación",
    categorias: [{ name_category: "IA" }], estado: "Terminado", ...extra,
  });

  beforeEach(() => {
    cargarHtml("buscarPgc.html");
    window.pagina_actual = 1;
  });

  test("chipsCategoriasBusqueda", () => {
    expect(chipsCategoriasBusqueda([{ name_category: "IA" }, "Web"])).toContain("IA");
    expect(chipsCategoriasBusqueda(undefined)).toContain("Sin categorías");
  });

  describe("cargarFiltros", () => {
    test("llena categorías y ciclos con datos reales", async () => {
      simularApi({
        "GET /categorias": ok([{ id_category: 1, name_category: "IA" }]),
        "GET /ciclos": ok([{ id: 2, subject_cycle: "Fundamentación" }, { id: 3 }]),
      });
      await cargarFiltros();
      expect([...$("filtro-categoria").options].map((o) => o.textContent)).toContain("IA");
      expect([...$("filtro-ciclo").options].map((o) => o.textContent)).toEqual(expect.arrayContaining(["Fundamentación", "Ciclo 3"]));
    });
    test("si una de las dos listas falla, la otra se llena igual", async () => {
      simularApi({ "GET /categorias": falloDeRed(), "GET /ciclos": ok([{ id: 2, subject_cycle: "Fundamentación" }]) });
      await cargarFiltros();
      expect($("filtro-categoria").options).toHaveLength(1); // solo "Todas"
      expect([...$("filtro-ciclo").options].map((o) => o.textContent)).toContain("Fundamentación");
    });
    test("respuestas no OK dejan los filtros con su opción por defecto", async () => {
      simularApi({ "GET /categorias": estado(500), "GET /ciclos": estado(500) });
      await cargarFiltros();
      expect($("filtro-categoria").options).toHaveLength(1);
    });
  });

  describe("armarQueryBusqueda", () => {
    test("sin filtros solo manda la página", () => {
      expect(armarQueryBusqueda()).toBe("pagina=1");
    });
    test("incluye los filtros con valor (el texto va sin espacios sobrantes)", () => {
      $("filtro-texto").value = "  inteligencia  ";
      $("filtro-estado").value = "Terminado";
      window.pagina_actual = 3;
      const q = new URLSearchParams(armarQueryBusqueda());
      expect(q.get("q")).toBe("inteligencia");
      expect(q.get("estado")).toBe("Terminado");
      expect(q.get("pagina")).toBe("3");
      expect(q.has("categoria")).toBe(false);
    });
  });

  describe("pintarPaginacion", () => {
    test("una sola página: sin controles", () => {
      pintarPaginacion(1, 1);
      expect($("paginacion").innerHTML).toBe("");
      pintarPaginacion(1, 0);
      expect($("paginacion").innerHTML).toBe("");
    });
    test("deshabilita 'Anterior' en la primera y 'Siguiente' en la última", () => {
      pintarPaginacion(1, 3);
      expect($("btn-pagina-anterior").disabled).toBe(true);
      expect($("btn-pagina-siguiente").disabled).toBe(false);
      expect($("paginacion").textContent).toContain("Página 1 de 3");
      pintarPaginacion(3, 3);
      expect($("btn-pagina-siguiente").disabled).toBe(true);
    });
    test("'Siguiente' y 'Anterior' cambian de página y buscan de nuevo", async () => {
      const fetchMock = simularApi({ "GET /pgc/search*": ok({ resultados: [RESULTADO()], pagina_actual: 2, total_paginas: 3 }) });
      window.pagina_actual = 2;
      pintarPaginacion(2, 3);
      $("btn-pagina-siguiente").click();
      await esperar();
      expect(fetchMock.llamadas.at(-1).ruta).toContain("pagina=3");
      $("btn-pagina-anterior").click();
      await esperar();
      expect(fetchMock.llamadas.at(-1).ruta).toContain("pagina=2");
    });
  });

  describe("ejecutarBusqueda", () => {
    test("pinta resultados, resumen y paginación; guarda la búsqueda en la URL", async () => {
      simularApi({ "GET /pgc/search*": ok({ resultados: [RESULTADO(), RESULTADO({ id_pgc: 2, estado: "En Proceso" })], total_resultados: 20, pagina_actual: 1, total_paginas: 2 }) });
      await ejecutarBusqueda();
      expect($("tabla-resultados").querySelectorAll("tr")).toHaveLength(2);
      expect($("tabla-resultados").textContent).toContain("Proyecto <A>");
      expect($("tabla-resultados").querySelector("a").getAttribute("href")).toBe("fichaPgc.html?id=1");
      expect($("resumen-resultados").textContent).toBe("20 proyectos encontrados");
      expect($("paginacion").textContent).toContain("Página 1 de 2");
      expect(window.location.search).toBe("?pagina=1");
    });
    test("singular cuando hay un solo resultado", async () => {
      simularApi({ "GET /pgc/search*": ok({ resultados: [RESULTADO()] }) });
      await ejecutarBusqueda();
      expect($("resumen-resultados").textContent).toBe("1 proyecto encontrado");
    });
    test("sin resultados", async () => {
      simularApi({ "GET /pgc/search*": ok({ resultados: [] }) });
      await ejecutarBusqueda();
      expect($("tabla-resultados").textContent).toContain("No se encontraron proyectos con esos filtros.");
      expect($("paginacion").innerHTML).toBe("");
    });
    test("respuesta sin 'resultados' se trata como vacía", async () => {
      simularApi({ "GET /pgc/search*": ok({}) });
      await ejecutarBusqueda();
      expect($("tabla-resultados").textContent).toContain("No se encontraron proyectos");
    });
    test("error HTTP o de red", async () => {
      simularApi({ "GET /pgc/search*": estado(500) });
      await ejecutarBusqueda();
      expect($("tabla-resultados").textContent).toContain("No fue posible cargar los resultados.");
      expect($("banner").textContent).toContain("No fue posible conectar con el servidor.");
      simularApi({ "GET /pgc/search*": falloDeRed() });
      await ejecutarBusqueda();
      expect($("banner").className).toContain("error");
    });
  });

  describe("aplicarFiltrosDeUrl", () => {
    test("rellena el formulario con lo que traiga la URL", () => {
      irA("/buscarPgc.html?q=ia&estado=Terminado&pagina=4");
      aplicarFiltrosDeUrl();
      expect($("filtro-texto").value).toBe("ia");
      expect($("filtro-estado").value).toBe("Terminado");
      expect(window.pagina_actual).toBe(4);
    });
    test("sin parámetros no cambia nada", () => {
      aplicarFiltrosDeUrl();
      expect($("filtro-texto").value).toBe("");
      expect(window.pagina_actual).toBe(1);
    });
  });

  describe("inicializarBuscarPgc", () => {
    test("carga filtros, busca y reinicia la página al enviar el formulario", async () => {
      irA("/buscarPgc.html?pagina=3");
      const fetchMock = simularApi({
        "GET /categorias": ok([]),
        "GET /ciclos": ok([]),
        "GET /pgc/search*": ok({ resultados: [RESULTADO()] }),
      });
      await inicializarBuscarPgc();
      await esperar();
      expect(fetchMock.llamadas.find((l) => l.ruta.startsWith("/pgc/search")).ruta).toContain("pagina=3");

      $("form-busqueda").dispatchEvent(new Event("submit", { cancelable: true }));
      await esperar();
      expect(window.pagina_actual).toBe(1);
      expect(fetchMock.llamadas.at(-1).ruta).toContain("pagina=1");
    });
  });
});
