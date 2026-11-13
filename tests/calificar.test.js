const {
  cargarBase, cargar, cargarHtml, simularBootstrap, simularApi, ok, estado, falloDeRed,
  congelarFecha, descongelarFecha, esperar,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("js/calificar.js");
});

const $ = (id) => document.getElementById(id);
const VENTANA_ABIERTA = [{ stage: "Calificación", start_date: "2026-11-01 00:00:00", end_date: "2026-11-30 23:59:59" }];
const PGC1 = { id_pgc: 1, id_cycle: 1, title_proposal: "Proyecto <A>", leader_name: "Ana", name_cycle: "Fundamentación" };
const PGC2 = { id_pgc: 2, id_cycle: 1, title_proposal: "Proyecto B", leader_name: "Luis", ya_calificado: true };
const FICHA = {
  id_proposal: 9, problem_proposal: "Problema", justification_proposal: "Justificación",
  objectives_proposal: "Objetivos", solution_proposal: "Solución",
  categorias: [{ name_category: "IA" }], integrantes: [{ full_name: "Ana" }],
  archivos: [{ title_file: "Avance 1", url_file: { url: "https://x/a1.pdf", expira_en_segundos: 600 } }],
};

let modal;
beforeEach(() => {
  localStorage.clear();
  Object.keys(cache_fechas_por_ciclo).forEach((k) => delete cache_fechas_por_ciclo[k]);
  cargarHtml("calificar.html");
  simularBootstrap();
  modal = { show: jest.fn(), hide: jest.fn() };
  window.modal_calificar = modal;
  window.pgc_pendientes = [];
  window.pgc_seleccionado = null;
  congelarFecha("2026-11-12T12:00:00");
});
afterEach(() => descongelarFecha());

describe("obtenerFechasCiclo", () => {
  test("pide las fechas una sola vez por ciclo (caché)", async () => {
    const fetchMock = simularApi({ "GET /ciclos/1/fechas": ok(VENTANA_ABIERTA) });
    expect(await obtenerFechasCiclo(1)).toEqual(VENTANA_ABIERTA);
    await obtenerFechasCiclo(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  test("si falla devuelve []", async () => {
    simularApi({ "GET /ciclos/1/fechas": estado(500), "GET /ciclos/2/fechas": falloDeRed() });
    expect(await obtenerFechasCiclo(1)).toEqual([]);
    expect(await obtenerFechasCiclo(2)).toEqual([]);
  });
});

describe("obtenerBloqueoCalificacion", () => {
  test("ya calificado", async () => {
    expect(await obtenerBloqueoCalificacion({ ya_calificado: true })).toBe("Ya calificaste este PGC.");
  });
  test("periodo sin configurar", async () => {
    simularApi({ "GET /ciclos/1/fechas": ok([]) });
    expect(await obtenerBloqueoCalificacion({ id_cycle: 1 })).toContain("todavía no ha sido configurado");
  });
  test("fuera del periodo", async () => {
    congelarFecha("2026-12-20T12:00:00");
    simularApi({ "GET /ciclos/1/fechas": ok(VENTANA_ABIERTA) });
    expect(await obtenerBloqueoCalificacion({ id_cycle: 1 })).toContain("Fuera del periodo de calificación");
  });
  test("antes de que abra también bloquea", async () => {
    congelarFecha("2026-10-01T12:00:00");
    simularApi({ "GET /ciclos/1/fechas": ok(VENTANA_ABIERTA) });
    expect(await obtenerBloqueoCalificacion({ id_cycle: 1 })).toContain("Fuera del periodo");
  });
  test("dentro del periodo se puede calificar (null)", async () => {
    simularApi({ "GET /ciclos/1/fechas": ok(VENTANA_ABIERTA) });
    expect(await obtenerBloqueoCalificacion({ id_cycle: 1 })).toBeNull();
  });
});

describe("pintarTablaCalificar", () => {
  test("sin pendientes", async () => {
    await pintarTablaCalificar();
    expect($("tabla-calificar").textContent).toContain("No tienes PGC pendientes por calificar.");
  });

  test("deshabilita 'Calificar' en los PGC bloqueados y explica el motivo", async () => {
    simularApi({ "GET /ciclos/1/fechas": ok(VENTANA_ABIERTA) });
    window.pgc_pendientes = [PGC1, PGC2];
    await pintarTablaCalificar();
    const botones = $("tabla-calificar").querySelectorAll("button");
    expect(botones[0].disabled).toBe(false);
    expect(botones[0].textContent).toBe("Calificar");
    expect(botones[1].disabled).toBe(true);
    expect(botones[1].textContent).toBe("No disponible");
    expect(botones[1].title).toBe("Ya calificaste este PGC.");
    expect($("tabla-calificar").textContent).toContain("Proyecto <A>");
  });
});

describe("textos de categorías e integrantes", () => {
  test("nombresCategoriasCalificar", () => {
    expect(nombresCategoriasCalificar([])).toBe("Sin categorías");
    expect(nombresCategoriasCalificar(undefined)).toBe("Sin categorías");
    expect(nombresCategoriasCalificar([{ name_category: "IA" }, "Web"])).toBe("IA, Web");
  });
  test("nombresIntegrantesCalificar", () => {
    expect(nombresIntegrantesCalificar([])).toBe("Solo el líder");
    expect(nombresIntegrantesCalificar([{ full_name: "Ana" }, "Luis"])).toBe("Ana, Luis");
  });
});

describe("pintarDetallePgc", () => {
  test("pinta la propuesta, las evidencias y el PDF original", async () => {
    simularApi({ "GET /propuestas/9/pdf": ok({ url: "https://x/p.pdf", expira_en_segundos: 600 }) });
    pintarDetallePgc(FICHA, FICHA.archivos);
    const c = $("cuerpo-detalle-pgc");
    expect(c.textContent).toContain("Problema");
    expect(c.textContent).toContain("IA");
    expect(c.querySelector("#calificar-archivo-0 a").getAttribute("href")).toBe("https://x/a1.pdf");
    await esperar();
    expect(c.querySelector("#calificar-pdf-propuesta a").getAttribute("href")).toBe("https://x/p.pdf");
  });
  test("sin evidencias lo dice, y sin id_proposal no pide el PDF", () => {
    const fetchMock = simularApi();
    pintarDetallePgc({ ...FICHA, id_proposal: undefined }, []);
    expect($("cuerpo-detalle-pgc").textContent).toContain("No se han subido evidencias.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("si el PDF de la propuesta falla, la sección queda en 'No disponible'", async () => {
    simularApi({ "GET /propuestas/9/pdf": estado(500) });
    pintarDetallePgc(FICHA, []);
    await esperar();
    expect($("calificar-pdf-propuesta").textContent).toContain("No disponible");

    simularApi({ "GET /propuestas/9/pdf": falloDeRed() });
    pintarDetallePgc(FICHA, []);
    await esperar();
    expect($("calificar-pdf-propuesta").textContent).toContain("No disponible");
  });
});

describe("abrirCalificacion", () => {
  beforeEach(() => {
    window.pgc_pendientes = [PGC1];
  });
  test("un id desconocido no abre nada", async () => {
    await abrirCalificacion(99);
    expect(modal.show).not.toHaveBeenCalled();
  });
  test("abre el modal, limpia el formulario y pinta la ficha", async () => {
    simularApi({ "GET /pgc/1": ok(FICHA), "GET /propuestas/9/pdf": estado(404) });
    $("input-nota").value = "3";
    await abrirCalificacion(1);
    expect(modal.show).toHaveBeenCalled();
    expect($("calificar-titulo").textContent).toBe("Proyecto <A>");
    expect($("input-nota").value).toBe("");
    expect($("cuerpo-detalle-pgc").textContent).toContain("Solución");
  });
  test("si la ficha no se puede cargar lo avisa (HTTP o red)", async () => {
    simularApi({ "GET /pgc/1": estado(500) });
    await abrirCalificacion(1);
    expect($("cuerpo-detalle-pgc").textContent).toContain("No fue posible cargar la información del PGC.");

    simularApi({ "GET /pgc/1": falloDeRed() });
    await abrirCalificacion(1);
    expect($("cuerpo-detalle-pgc").textContent).toContain("No fue posible cargar la información del PGC.");
  });
});

describe("inicializarCalificar", () => {
  test("carga los pendientes y pinta la tabla", async () => {
    simularApi({ "GET /pgc/pendientes-calificacion": ok([PGC1]), "GET /ciclos/1/fechas": ok(VENTANA_ABIERTA) });
    await inicializarCalificar();
    expect($("tabla-calificar").textContent).toContain("Proyecto <A>");
  });

  test("si falla la carga lo avisa y deja la tabla vacía", async () => {
    simularApi({ "GET /pgc/pendientes-calificacion": estado(500) });
    await inicializarCalificar();
    expect($("banner").textContent).toContain("No fue posible cargar los PGC pendientes");
    expect($("tabla-calificar").textContent).toContain("No tienes PGC pendientes");
  });

  describe("guardar la calificación", () => {
    async function prepararAbierto(rutas = {}) {
      const fetchMock = simularApi({
        "GET /pgc/pendientes-calificacion": ok([PGC1]),
        "GET /ciclos/1/fechas": ok(VENTANA_ABIERTA),
        "GET /pgc/1": ok({ ...FICHA, id_proposal: undefined }),
        ...rutas,
      });
      await inicializarCalificar();
      await abrirCalificacion(1);
      return fetchMock;
    }
    const guardar = async (nota, comentario) => {
      $("input-nota").value = nota;
      $("input-comentario").value = comentario;
      $("btn-guardar-nota").click();
      await esperar();
    };
    const errorModal = () => $("banner-modal-calificar").textContent;

    test.each([
      ["", "Bien", "entre 0.0 y 5.0"],
      ["6", "Bien", "entre 0.0 y 5.0"],
      ["-1", "Bien", "entre 0.0 y 5.0"],
      ["4", "   ", "Debes escribir un comentario"],
    ])("nota %p / comentario %p → error de validación", async (nota, comentario, mensaje) => {
      const fetchMock = await prepararAbierto();
      await guardar(nota, comentario);
      expect(errorModal()).toContain(mensaje);
      expect(fetchMock.llamadas.some((l) => l.metodo === "POST")).toBe(false);
    });

    test("guardar correctamente: envía nota y comentario, quita el PGC y cierra el modal", async () => {
      const fetchMock = await prepararAbierto({ "POST /pgc/1/calificar": ok({ mensaje: "Calificación registrada." }) });
      await guardar("4.5", "  Excelente trabajo  ");
      const post = fetchMock.llamadas.find((l) => l.metodo === "POST");
      expect(JSON.parse(post.opciones.body)).toEqual({ grade: 4.5, comment: "Excelente trabajo" });
      expect($("banner").className).toContain("success");
      expect($("banner").textContent).toContain("Calificación registrada.");
      expect(window.pgc_pendientes).toHaveLength(0);
      expect(global.bootstrap.instancias[0].hide).toHaveBeenCalled();
      expect($("btn-guardar-nota").disabled).toBe(false);
    });

    test("si el backend rechaza, muestra su mensaje en el modal", async () => {
      await prepararAbierto({ "POST /pgc/1/calificar": estado(403, { mensaje: "No eres jurado de este ciclo." }) });
      await guardar("4", "Bien");
      expect(errorModal()).toContain("No eres jurado de este ciclo.");
      expect(window.pgc_pendientes).toHaveLength(1);
    });

    test("rechazo sin mensaje y sin conexión", async () => {
      await prepararAbierto({ "POST /pgc/1/calificar": estado(500) });
      await guardar("4", "Bien");
      expect(errorModal()).toContain("No fue posible guardar la calificación.");

      simularApi({ "POST /pgc/1/calificar": falloDeRed() });
      await guardar("4", "Bien");
      expect(errorModal()).toContain("No fue posible conectar con el servidor.");
    });
  });
});
