const {
  cargarBase, cargar, cargarHtml, simularBootstrap, simularApi, ok, estado, falloDeRed,
  simularUbicacion, esperar,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("js/propuestaAprobada.js");
});

const $ = (id) => document.getElementById(id);
const PROP = {
  id_proposal: 3, title_proposal: "Propuesta <X>", name_cycle: "Fundamentación",
  problem_proposal: "Problema", justification_proposal: "Justificación", objectives_proposal: "Objetivos",
  solution_proposal: "Solución", categorias: [{ name_category: "IA" }], integrantes: [{ full_name: "Ana" }],
};

let modal;
let ubicacion;
beforeEach(() => {
  localStorage.clear();
  cargarHtml("propuestaAprobada.html");
  simularBootstrap();
  ubicacion = simularUbicacion();
  modal = { show: jest.fn(), hide: jest.fn() };
  window.modal_registro = modal;
  window.propuestas_aprobadas = [];
  window.propuesta_seleccionada = null;
});

test("nombresCategorias y nombresIntegrantes", () => {
  expect(nombresCategorias([])).toBe("Sin categorías");
  expect(nombresCategorias([{ name_category: "IA" }, "Web"])).toBe("IA, Web");
  expect(nombresIntegrantes(undefined)).toBe("Solo el líder");
  expect(nombresIntegrantes([{ full_name: "Ana" }, "Luis"])).toBe("Ana, Luis");
});

describe("pintarPropuestasAprobadas", () => {
  test("sin propuestas", () => {
    pintarPropuestasAprobadas();
    expect($("contenedor-propuesta-aprobada").textContent).toContain("No tienes propuestas aprobadas pendientes");
  });
  test("una fila por propuesta", () => {
    window.propuestas_aprobadas = [PROP, { id_proposal: 4, title_proposal: "Otra", id_cycle: 2 }];
    pintarPropuestasAprobadas();
    const filas = $("contenedor-propuesta-aprobada").querySelectorAll("tbody tr");
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain("Propuesta <X>");
    expect(filas[1].textContent).toContain("2");
  });
});

describe("abrirRegistroPgc", () => {
  beforeEach(() => {
    window.propuestas_aprobadas = [PROP];
  });
  test("un id desconocido no abre nada", () => {
    abrirRegistroPgc(99);
    expect(modal.show).not.toHaveBeenCalled();
  });
  test("muestra los datos heredados y abre el modal", () => {
    abrirRegistroPgc(3);
    expect($("cuerpo-modal-registro").textContent).toContain("Propuesta <X>");
    expect($("cuerpo-modal-registro").textContent).toContain("Solución");
    expect($("banner-modal-registro")).not.toBeNull();
    expect(modal.show).toHaveBeenCalled();
  });
});

describe("confirmarRegistroPgc", () => {
  beforeEach(() => {
    window.propuestas_aprobadas = [PROP];
    abrirRegistroPgc(3);
  });

  test("sin propuesta seleccionada no hace nada", async () => {
    window.propuesta_seleccionada = null;
    const fetchMock = simularApi();
    await confirmarRegistroPgc();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("registro correcto: manda el id y va a 'Mi PGC'", async () => {
    const fetchMock = simularApi({ "POST /pgc": ok({}) });
    await confirmarRegistroPgc();
    expect(JSON.parse(fetchMock.llamadas[0].opciones.body)).toEqual({ id_proposal: 3 });
    expect(ubicacion.href).toBe("miPgc.html");
    expect($("btn-confirmar-registro").disabled).toBe(false);
  });

  test("fuera de fecha: el mensaje incluye el rango habilitado", async () => {
    simularApi({
      "POST /pgc": estado(400, { mensaje: "Registro cerrado.", fecha_inicio_registro_pgc: "2026-10-01", fecha_fin_registro_pgc: "2026-10-31" }),
    });
    await confirmarRegistroPgc();
    expect($("banner-modal-registro").textContent).toContain("Registro cerrado. (habilitado del 2026-10-01 al 2026-10-31)");
    expect(ubicacion.href).toBe("http://localhost/");
  });

  test("error sin mensaje ni fechas, y sin conexión", async () => {
    simularApi({ "POST /pgc": estado(500) });
    await confirmarRegistroPgc();
    expect($("banner-modal-registro").textContent).toBe("No fue posible registrar el PGC.");

    simularApi({ "POST /pgc": falloDeRed() });
    await confirmarRegistroPgc();
    expect($("banner-modal-registro").textContent).toContain("No fue posible conectar con el servidor.");
  });
});

describe("inicializarPropuestaAprobada", () => {
  test("si ya tiene un PGC lo avisa, oculta la tabla y no pide propuestas", async () => {
    const fetchMock = simularApi({ "GET /pgc/mine": ok([{ id_pgc: 1 }]) });
    await inicializarPropuestaAprobada();
    expect($("banner").textContent).toContain("Ya tienes un PGC registrado.");
    expect($("banner").querySelector("a").getAttribute("href")).toBe("miPgc.html");
    expect($("contenedor-propuesta-aprobada").classList.contains("hidden")).toBe(true);
    expect(fetchMock.llamadas.some((l) => l.ruta === "/propuestas/aprobadas-sin-pgc")).toBe(false);
  });

  test("sin PGC: carga y pinta las propuestas aprobadas", async () => {
    simularApi({ "GET /pgc/mine": ok([]), "GET /propuestas/aprobadas-sin-pgc": ok([PROP]) });
    await inicializarPropuestaAprobada();
    expect($("contenedor-propuesta-aprobada").textContent).toContain("Propuesta <X>");
  });

  test("si falla la consulta previa de PGC sigue el flujo normal", async () => {
    simularApi({ "GET /pgc/mine": falloDeRed(), "GET /propuestas/aprobadas-sin-pgc": ok([PROP]) });
    await inicializarPropuestaAprobada();
    expect($("contenedor-propuesta-aprobada").textContent).toContain("Propuesta <X>");
  });

  test("si falla la carga de propuestas lo avisa", async () => {
    simularApi({ "GET /pgc/mine": estado(404), "GET /propuestas/aprobadas-sin-pgc": estado(500) });
    await inicializarPropuestaAprobada();
    expect($("banner").textContent).toContain("No fue posible cargar tus propuestas aprobadas");
    expect($("contenedor-propuesta-aprobada").textContent).toContain("No tienes propuestas aprobadas");
  });

  test("el botón 'Confirmar registro' queda conectado", async () => {
    const fetchMock = simularApi({
      "GET /pgc/mine": ok([]), "GET /propuestas/aprobadas-sin-pgc": ok([PROP]), "POST /pgc": ok({}),
    });
    await inicializarPropuestaAprobada();
    abrirRegistroPgc(3);
    $("btn-confirmar-registro").click();
    await esperar();
    expect(fetchMock.llamadas.some((l) => l.metodo === "POST" && l.ruta === "/pgc")).toBe(true);
  });
});
