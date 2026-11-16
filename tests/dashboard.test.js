const {
  cargarBase, cargar, cargarHtml, iniciarSesionDePrueba, simularApi, ok, estado, falloDeRed, esperar,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("components/sidebar.js", "js/dashboard.js");
});

const $ = (id) => document.getElementById(id);
const unir = (tarjetas) => tarjetas.join("");

beforeEach(() => {
  localStorage.clear();
  cargarHtml("dashboard.html");
});

describe("utilidades del panel", () => {
  test("contextoPanel: el rol, o el sombrero activo si es profesor", () => {
    expect(contextoPanel({ rol: "estudiante" })).toBe("estudiante");
    expect(contextoPanel({ rol: "profesor" })).toBe("profesor");
    establecerContextoActivo("jurado");
    expect(contextoPanel({ rol: "profesor" })).toBe("jurado");
  });

  test("pedirDatoPanel: JSON, o null si falla (HTTP o red)", async () => {
    simularApi({ "GET /a": ok([1]), "GET /b": estado(500), "GET /c": falloDeRed() });
    expect(await pedirDatoPanel("/a")).toEqual([1]);
    expect(await pedirDatoPanel("/b")).toBeNull();
    expect(await pedirDatoPanel("/c")).toBeNull();
  });

  test("nombresCiclosPanel y listarNombresCiclo", async () => {
    simularApi({ "GET /ciclos": ok([{ id: 1, subject_cycle: "Fundamentación" }]) });
    const nombres = await nombresCiclosPanel();
    expect(nombres).toEqual({ 1: "Fundamentación" });
    expect(listarNombresCiclo([1, 2], nombres)).toBe("Fundamentación, Ciclo 2");

    simularApi({ "GET /ciclos": estado(500) });
    expect(await nombresCiclosPanel()).toEqual({});
  });

  test("formatearNotaPanel", () => {
    expect(formatearNotaPanel(null)).toBeNull();
    expect(formatearNotaPanel(undefined)).toBeNull();
    expect(formatearNotaPanel("x")).toBeNull();
    expect(formatearNotaPanel(4)).toBe("4.0");
  });
});

describe("tarjetaResumen", () => {
  test("con href es un enlace; sin href es un div", () => {
    const con = tarjetaResumen({ etiqueta: "E", valor: "1", href: "x.html" });
    const sin = tarjetaResumen({ etiqueta: "E", valor: "1" });
    expect(con).toContain('<a class="card-resumen card-enlace" href="x.html"');
    expect(sin).not.toContain("<a ");
    expect(sin).toContain('<div class="card-resumen">');
  });
  test("con estado usa la clase del estado (o 'pendiente' si es desconocido)", () => {
    expect(tarjetaResumen({ etiqueta: "E", valor: "Aprobada", estado: true })).toContain("badge-estado aprobada");
    expect(tarjetaResumen({ etiqueta: "E", valor: "Rarísimo", estado: true })).toContain("badge-estado pendiente");
  });
  test("el detalle es opcional y todo se escapa", () => {
    expect(tarjetaResumen({ etiqueta: "E", valor: "1" })).not.toContain('class="detalle"');
    expect(tarjetaResumen({ etiqueta: "<b>", valor: "<i>", detalle: "<u>" })).not.toContain("<b>");
  });
});

describe("tarjetasEstudiante", () => {
  test("sin propuesta ni PGC", async () => {
    simularApi({ "GET /propuestas/mia": estado(404), "GET /pgc/mine": ok([]) });
    const html = unir(await tarjetasEstudiante());
    expect(html).toContain("Sin radicar");
    expect(html).toContain("radicar-propuesta.html");
    expect(html).toContain("Sin registrar");
    expect(html).toContain("Se habilita cuando tu propuesta sea aprobada.");
  });

  test("propuesta aprobada sin PGC: invita a registrarlo", async () => {
    simularApi({ "GET /propuestas/mia": ok({ estado: "Aprobada", title_proposal: "T" }), "GET /pgc/mine": ok([]) });
    const html = unir(await tarjetasEstudiante());
    expect(html).toContain("Tu propuesta ya fue aprobada");
    expect(html).toContain("propuestaAprobada.html");
  });

  test("con propuesta, PGC y calificaciones", async () => {
    simularApi({
      "GET /propuestas/mia": ok({ estado: "Pendiente de validación", title_proposal: "Mi tesis" }),
      "GET /pgc/mine": ok([{ id_pgc: 5, state_pgc: "En Proceso", name_cycle: "Fundamentación" }]),
      "GET /pgc/5/calificaciones": ok({ nota_global: 4, calificaciones: [{}, {}] }),
    });
    const tarjetas = await tarjetasEstudiante();
    expect(tarjetas).toHaveLength(3);
    const html = unir(tarjetas);
    expect(html).toContain("mis-propuestas.html");
    expect(html).toContain("Mi tesis");
    expect(html).toContain("4.0 / 5.0");
    expect(html).toContain("2 jurado(s) ya calificaron");
  });

  test("con PGC pero sin calificaciones todavía", async () => {
    simularApi({
      "GET /propuestas/mia": falloDeRed(),
      "GET /pgc/mine": ok([{ id_pgc: 5, state_pgc: "En Proceso", name_cycle: "F" }]),
      "GET /pgc/5/calificaciones": estado(404),
    });
    const html = unir(await tarjetasEstudiante());
    expect(html).toContain("Pendiente");
    expect(html).toContain("Aún no hay calificaciones de jurado.");
  });
});

describe("tarjetasProfesor", () => {
  test("catálogo, ciclos como encargado y como jurado", async () => {
    simularApi({ "GET /ciclos": ok([{ id: 1, subject_cycle: "Fundamentación" }]), "GET /pgc/search?pagina=1": ok({ total_resultados: 42 }) });
    const html = unir(await tarjetasProfesor({ encargado_de: [1], jurado_de: [] }));
    expect(html).toContain("42");
    expect(html).toContain("Fundamentación");
    expect(html).toContain("No eres jurado de ningún ciclo.");
  });
  test("sin datos del catálogo muestra '—' y sin capacidades lo explica", async () => {
    simularApi({ "GET /pgc/search?pagina=1": estado(500) });
    const html = unir(await tarjetasProfesor({ encargado_de: [], jurado_de: [] }));
    expect(html).toContain("—");
    expect(html).toContain("No eres encargado de ningún ciclo.");
  });
});

describe("tarjetasEncargado", () => {
  const usuario = { encargado_de: [1, 2] };
  test("suma pendientes y rúbricas de todos sus ciclos", async () => {
    simularApi({
      "GET /ciclos": ok([{ id: 1, subject_cycle: "Fundamentación" }]),
      "GET /propuestas*": ({ ruta }) => (ruta.includes("cycle=1") ? ok([{}, {}]) : ok([{}])),
      "GET /ciclos/1/documentos*": ok([{}]),
      "GET /ciclos/2/documentos*": ok([]),
    });
    const html = unir(await tarjetasEncargado(usuario));
    expect(html).toContain('<span class="valor">3</span>');
    expect(html).toContain("Revísalas en Aprobaciones.");
    expect(html).toContain('<span class="valor">1</span>');
    expect(html).toContain("Publicadas para tus jurados y estudiantes.");
    expect(html).toContain("Fundamentación, Ciclo 2");
  });
  test("si una consulta falla muestra '—'", async () => {
    simularApi({ "GET /ciclos": ok([]), "GET /propuestas*": estado(500), "GET /ciclos/1/documentos*": ok([]), "GET /ciclos/2/documentos*": ok([]) });
    const html = unir(await tarjetasEncargado(usuario));
    expect(html).toContain('<span class="valor">—</span>');
  });
  test("sin propuestas ni rúbricas usa los textos de 'nada pendiente'", async () => {
    simularApi({ "GET /ciclos": ok([]), "GET /propuestas*": ok([]), "GET /ciclos/1/documentos*": ok([]), "GET /ciclos/2/documentos*": ok([]) });
    const html = unir(await tarjetasEncargado(usuario));
    expect(html).toContain("No tienes propuestas pendientes.");
    expect(html).toContain("Aún no has publicado rúbricas.");
  });
});

describe("tarjetasJurado", () => {
  test("pendientes, calificados y promedio de las notas", async () => {
    simularApi({
      "GET /ciclos": ok([{ id: 3, subject_cycle: "Transición" }]),
      "GET /pgc/pendientes-calificacion": ok([{}, {}, {}]),
      "GET /pgc/calificados-por-mi": ok([{ grade: 4 }, { grade: 5 }, { grade: "x" }]),
    });
    const html = unir(await tarjetasJurado({ jurado_de: [3] }));
    expect(html).toContain('<span class="valor">3</span>');
    expect(html).toContain("Promedio de las notas que diste: 4.5");
    expect(html).toContain("Transición");
  });
  test("sin datos", async () => {
    simularApi({});
    const html = unir(await tarjetasJurado({ jurado_de: [] }));
    expect(html).toContain("—");
    expect(html).toContain("Todavía no has calificado ningún PGC.");
  });
});

describe("tarjetasAdministrador", () => {
  test("ciclos, PGC (terminados y en proceso) y lineamientos", async () => {
    simularApi({
      "GET /ciclos": ok([{ subject_cycle: "A" }, { subject_cycle: "B" }]),
      "GET /pgc/search?pagina=1": ok({ total_resultados: 10 }),
      "GET /pgc/search?pagina=1&estado=Terminado": ok({ total_resultados: 4 }),
      "GET /lineamientos": ok([{}, {}]),
    });
    const html = unir(await tarjetasAdministrador());
    expect(html).toContain("A, B");
    expect(html).toContain("4 terminado(s) · 6 en proceso");
    expect(html).toContain('<span class="valor">2</span>');
  });
  test("si todo falla muestra '—'", async () => {
    simularApi({});
    const html = unir(await tarjetasAdministrador());
    expect(html).toContain("—");
  });
  test("total_resultados ausente cuenta como 0", async () => {
    simularApi({ "GET /pgc/search?pagina=1": ok({}), "GET /pgc/search?pagina=1&estado=Terminado": ok({}) });
    const html = unir(await tarjetasAdministrador());
    expect(html).toContain("0 terminado(s) · 0 en proceso");
  });
});

describe("pintarResumen y pintarAccesos", () => {
  test("pinta las tarjetas del contexto del usuario", async () => {
    simularApi({ "GET /ciclos": ok([]), "GET /lineamientos": ok([]) });
    await pintarResumen({ rol: "administrador" });
    expect($("contenedor-resumen").textContent).toContain("Lineamientos vigentes");
  });
  test("un rol sin panel muestra 'No hay datos'", async () => {
    await pintarResumen({ rol: "otro" });
    expect($("contenedor-resumen").textContent).toContain("No hay datos para mostrar.");
  });
  test("accesos rápidos: las opciones del menú (menos Inicio) con su descripción", async () => {
    await pintarAccesos({ rol: "administrador" });
    const titulos = [...$("contenedor-accesos").querySelectorAll(".acceso-titulo")].map((t) => t.textContent);
    expect(titulos).toEqual(["Ciclos →", "Usuarios →", "Buscar PGC →", "Lineamientos →"]);
    expect($("contenedor-accesos").textContent).toContain("Crea y edita ciclos, encargados y jurados.");
  });
});

describe("inicializarPanel", () => {
  test("sin sesión no hace nada", () => {
    const antes = $("saludo").textContent;
    expect(() => inicializarPanel()).not.toThrow();
    expect($("saludo").textContent).toBe(antes);
  });

  test("saluda por el primer nombre y pone el subtítulo del rol", async () => {
    iniciarSesionDePrueba({ rol: "Administrador", nombre: "Ana Pérez" });
    simularApi({});
    inicializarPanel();
    await esperar();
    expect($("saludo").textContent).toBe("Hola, Ana");
    expect($("subtitulo-panel").textContent).toBe(SUBTITULO_PANEL.administrador);
    expect($("contenedor-resumen").textContent).not.toContain("Cargando");
    expect($("contenedor-accesos").querySelectorAll("a").length).toBeGreaterThan(0);
  });

  test("sin nombre ni correo dice 'Bienvenido'", async () => {
    iniciarSesionDePrueba({ rol: "Administrador", nombre: undefined });
    simularApi({});
    inicializarPanel();
    await esperar();
    expect($("saludo").textContent).toBe("Bienvenido");
  });

  test("profesor con capacidades extra usa su subtítulo especial; sin ellas, el normal", async () => {
    simularApi({});
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [1] });
    inicializarPanel();
    await esperar();
    expect($("subtitulo-panel").textContent).toBe(SUBTITULO_PANEL.profesor_con_capacidades);

    iniciarSesionDePrueba({ rol: "Profesor" });
    inicializarPanel();
    await esperar();
    expect($("subtitulo-panel").textContent).toBe(SUBTITULO_PANEL.profesor);
  });
});
