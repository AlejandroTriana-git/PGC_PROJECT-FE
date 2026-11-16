const {
  cargarBase, cargar, iniciarSesionDePrueba, simularApi, ok, estado, falloDeRed,
  simularUbicacion, congelarFecha, descongelarFecha,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("components/sidebar.js");
});

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  simularUbicacion();
});
afterEach(() => descongelarFecha());

const ids = (menu) => aplanarOpciones(menu).map((o) => o.id);

describe("construirMenu", () => {
  test("estudiante y administrador usan su menú base", () => {
    expect(ids(construirMenu({ rol: "estudiante" }))).toContain("radicar-propuesta");
    expect(ids(construirMenu({ rol: "administrador" }))).toContain("usuarios");
  });
  test("un rol desconocido no tiene menú", () => {
    expect(construirMenu({ rol: "otro" })).toEqual([]);
  });
  test("profesor: el menú depende del contexto activo", () => {
    expect(ids(construirMenu({ rol: "profesor" }))).not.toContain("aprobaciones");
    establecerContextoActivo("encargado");
    expect(ids(construirMenu({ rol: "profesor" }))).toContain("aprobaciones");
    establecerContextoActivo("jurado");
    expect(ids(construirMenu({ rol: "profesor" }))).toContain("calificar");
  });
  test("un contexto inválido cae al menú de profesor", () => {
    establecerContextoActivo("inventado");
    expect(construirMenu({ rol: "profesor" })).toBe(MENU_POR_CONTEXTO.profesor);
  });
});

describe("filtrarMenu", () => {
  const menu = [
    { id: "a", label: "A", href: "a.html" },
    { grupo: "G", opciones: [{ id: "b", label: "B", href: "b.html" }, { id: "c", label: "C", href: "c.html" }] },
    { grupo: "Vacío", opciones: [{ id: "d", label: "D", href: "d.html" }] },
  ];
  test("quita opciones sueltas y opciones dentro de grupos", () => {
    const r = filtrarMenu(menu, new Set(["a", "b"]));
    expect(ids(r)).toEqual(["c", "d"]);
  });
  test("un grupo sin opciones desaparece", () => {
    const r = filtrarMenu(menu, new Set(["d"]));
    expect(r.map((e) => e.grupo || e.id)).toEqual(["a", "G"]);
  });
});

describe("construcción de enlaces y grupos", () => {
  test("el enlace activo lleva aria-current", () => {
    const cont = document.createElement("div");
    cont.innerHTML = construirEnlaceMenu({ id: "x", label: "X", href: "x.html" }, "x");
    expect(cont.querySelector("a").classList.contains("active")).toBe(true);
    expect(cont.querySelector("a").getAttribute("aria-current")).toBe("page");
  });
  test("el enlace inactivo no lleva aria-current", () => {
    const cont = document.createElement("div");
    cont.innerHTML = construirEnlaceMenu({ id: "x", label: "X", href: "x.html" }, "otra");
    expect(cont.querySelector("a").hasAttribute("aria-current")).toBe(false);
  });
  test("un grupo con una sola opción se muestra como enlace suelto", () => {
    const cont = document.createElement("div");
    cont.innerHTML = construirGrupoMenu({ grupo: "PGC", opciones: [{ id: "m", label: "Mi PGC", href: "m.html" }] }, "z");
    expect(cont.querySelector("details")).toBeNull();
    expect(cont.querySelector("a").textContent.trim()).toBe("Mi PGC");
  });
  test("un grupo con varias opciones es un <details>, abierto si contiene la página activa", () => {
    const grupo = { grupo: "Cfg", opciones: [{ id: "p", label: "P", href: "p.html" }, { id: "q", label: "Q", href: "q.html" }] };
    const cerrado = document.createElement("div");
    cerrado.innerHTML = construirItemMenu(grupo, "otra");
    expect(cerrado.querySelector("details").hasAttribute("open")).toBe(false);
    const abierto = document.createElement("div");
    abierto.innerHTML = construirItemMenu(grupo, "q");
    expect(abierto.querySelector("details").hasAttribute("open")).toBe(true);
    expect(abierto.querySelectorAll("a")).toHaveLength(2);
  });
});

describe("fechas del menú", () => {
  test("leerFechaMenu acepta 'YYYY-MM-DD HH:mm:ss', ISO y descarta lo inválido", () => {
    expect(leerFechaMenu("2026-11-01 10:00:00")).toBeInstanceOf(Date);
    expect(leerFechaMenu("2026-11-01T10:00:00")).toBeInstanceOf(Date);
    expect(leerFechaMenu(null)).toBeNull();
    expect(leerFechaMenu("no es fecha")).toBeNull();
  });

  describe("menuVentanaAbierta", () => {
    const filas = [{ stage: "Radicación", start_date: "2026-11-01 00:00:00", end_date: "2026-11-30 23:59:59" }];
    test("true dentro del rango", () => {
      congelarFecha("2026-11-12T12:00:00");
      expect(menuVentanaAbierta(filas, "Radicación")).toBe(true);
    });
    test("false fuera del rango", () => {
      congelarFecha("2026-12-15T12:00:00");
      expect(menuVentanaAbierta(filas, "Radicación")).toBe(false);
    });
    test("false si la etapa no está configurada o no hay filas", () => {
      expect(menuVentanaAbierta(filas, "Sustentación")).toBe(false);
      expect(menuVentanaAbierta(null, "Radicación")).toBe(false);
    });
    test("false si las fechas son ilegibles", () => {
      expect(menuVentanaAbierta([{ stage: "Radicación", start_date: null, end_date: "x" }], "Radicación")).toBe(false);
    });
  });

  test("obtenerFechasMenu devuelve las filas, o null si falla", async () => {
    simularApi({ "GET /ciclos/3/fechas": ok([{ stage: "Radicación" }]) });
    expect(await obtenerFechasMenu(3)).toEqual([{ stage: "Radicación" }]);
    simularApi({ "GET /ciclos/3/fechas": estado(500) });
    expect(await obtenerFechasMenu(3)).toBeNull();
    simularApi({ "GET /ciclos/3/fechas": falloDeRed() });
    expect(await obtenerFechasMenu(3)).toBeNull();
  });

  test("estudianteTienePropuesta: true con 200, false con 404 o error de red", async () => {
    simularApi({ "GET /propuestas/mia": ok({ id: 1 }) });
    expect(await estudianteTienePropuesta()).toBe(true);
    simularApi({ "GET /propuestas/mia": estado(404) });
    expect(await estudianteTienePropuesta()).toBe(false);
    simularApi({ "GET /propuestas/mia": falloDeRed() });
    expect(await estudianteTienePropuesta()).toBe(false);
  });
});

describe("obtenerOpcionesOcultas", () => {
  const opcionesEstudiante = () => aplanarOpciones(MENU_BASE_POR_ROL.estudiante);
  const filasAbiertas = [
    { stage: "Radicación", start_date: "2026-11-01 00:00:00", end_date: "2026-11-30 23:59:59" },
    { stage: "Registro PGC", start_date: "2026-11-01 00:00:00", end_date: "2026-11-30 23:59:59" },
  ];

  test("solo aplica a estudiantes", async () => {
    expect((await obtenerOpcionesOcultas(null, [])).size).toBe(0);
    expect((await obtenerOpcionesOcultas({ rol: "profesor" }, [])).size).toBe(0);
  });

  test("oculta 'radicar' si ya tiene propuesta", async () => {
    congelarFecha("2026-11-12T12:00:00");
    simularApi({ "GET /propuestas/mia": ok({}), "GET /ciclos/3/fechas": ok(filasAbiertas) });
    const r = await obtenerOpcionesOcultas({ rol: "estudiante", id_cycle: 3 }, opcionesEstudiante());
    expect([...r]).toEqual(["radicar-propuesta"]);
  });

  test("oculta las opciones cuyas etapas no están abiertas", async () => {
    congelarFecha("2026-12-20T12:00:00");
    simularApi({ "GET /propuestas/mia": estado(404), "GET /ciclos/3/fechas": ok(filasAbiertas) });
    const r = await obtenerOpcionesOcultas({ rol: "estudiante", id_cycle: 3 }, opcionesEstudiante());
    expect(new Set(r)).toEqual(new Set(["radicar-propuesta", "propuestaAprobada"]));
  });

  test("si la consulta de fechas falla, no oculta nada por error", async () => {
    simularApi({ "GET /propuestas/mia": estado(404), "GET /ciclos/3/fechas": estado(500) });
    const r = await obtenerOpcionesOcultas({ rol: "estudiante", id_cycle: 3 }, opcionesEstudiante());
    expect(r.size).toBe(0);
  });

  test("sin id_cycle no consulta fechas", async () => {
    const fetchMock = simularApi({ "GET /propuestas/mia": estado(404) });
    await obtenerOpcionesOcultas({ rol: "estudiante" }, opcionesEstudiante());
    expect(fetchMock.llamadas.map((l) => l.ruta)).toEqual(["/propuestas/mia"]);
  });
});

describe("renderizarBarraLateral", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="sidebar"></div>';
  });

  test("no falla si el contenedor no existe", async () => {
    await expect(renderizarBarraLateral("fantasma", "dashboard")).resolves.toBeUndefined();
  });

  test("sin sesión pinta una barra vacía", async () => {
    await renderizarBarraLateral("sidebar", "dashboard");
    const nav = document.querySelector("#sidebar nav");
    expect(nav).not.toBeNull();
    expect(nav.querySelectorAll("a")).toHaveLength(0);
  });

  test("administrador: menú completo con la página activa resaltada", async () => {
    iniciarSesionDePrueba({ rol: "Administrador" });
    await renderizarBarraLateral("sidebar", "ciclos");
    const activo = document.querySelector("#sidebar a.active");
    expect(activo.textContent.trim()).toBe("Ciclos");
    expect(document.querySelector("#sidebar nav").hasAttribute("aria-busy")).toBe(false);
  });

  test("estudiante con propuesta: no ve 'Radicar propuesta'", async () => {
    congelarFecha("2026-11-12T12:00:00");
    iniciarSesionDePrueba({ rol: "Estudiante", id_cycle: 3 });
    simularApi({
      "GET /propuestas/mia": ok({}),
      "GET /ciclos/3/fechas": ok([
        { stage: "Radicación", start_date: "2026-11-01 00:00:00", end_date: "2026-11-30 23:59:59" },
        { stage: "Registro PGC", start_date: "2026-11-01 00:00:00", end_date: "2026-11-30 23:59:59" },
      ]),
    });
    await renderizarBarraLateral("sidebar", "dashboard");
    const textos = [...document.querySelectorAll("#sidebar a")].map((a) => a.textContent.trim());
    expect(textos).not.toContain("Radicar propuesta");
    expect(textos).toContain("Propuestas aprobadas");
  });
});

describe("renderizarBarraLateralOpcional", () => {
  test("con sesión pinta el menú y devuelve true", () => {
    document.body.innerHTML = '<div id="sidebar"></div>';
    iniciarSesionDePrueba({ rol: "Administrador" });
    expect(renderizarBarraLateralOpcional("sidebar", "buscarPgc")).toBe(true);
    expect(document.getElementById("sidebar")).not.toBeNull();
  });

  test("sin sesión quita la columna del menú y devuelve false", () => {
    document.body.innerHTML = '<div class="app-shell"><div id="sidebar"></div></div>';
    expect(renderizarBarraLateralOpcional("sidebar", "buscarPgc")).toBe(false);
    expect(document.getElementById("sidebar")).toBeNull();
    expect(document.querySelector(".app-shell").classList.contains("sin-sidebar")).toBe(true);
  });

  test("sin sesión y sin contenedor tampoco falla", () => {
    expect(renderizarBarraLateralOpcional("fantasma", "x")).toBe(false);
  });
});
