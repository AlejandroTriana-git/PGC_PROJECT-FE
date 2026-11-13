const {
  cargarBase, cargar, cargarHtml, iniciarSesionDePrueba, simularApi, ok, estado, falloDeRed,
  crearArchivo, asignarArchivos, enviarFormulario, esperar,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("js/mis-propuestas.js");
});

const $ = (id) => document.getElementById(id);

const PROPUESTA = {
  id_proposal: 5, titulo: "Mi <tesis>", estado: "Rechazada", comentario: "Falta justificación", leader_name: "Ana Pérez",
  resubmit_count: 1, descr_proposal: "Descripción", problem_proposal: "Problema", justification_proposal: "Justificación",
  objectives_proposal: "Objetivos", solution_proposal: "Solución",
  categorias: [{ id_category: 2, name_category: "Web" }], integrantes: [{ id_user: 7, full_name: "Luis" }],
  pdf: { url: "https://x/p.pdf", expira_en_segundos: 600 },
};
const CATEGORIAS = [{ id_category: 1, name_category: "IA" }, { id_category: 2, name_category: "Web" }];
const ESTUDIANTES = [{ id_user: 7, full_name: "Luis" }, { id_user: 8, full_name: "Marta" }];

beforeEach(() => {
  localStorage.clear();
  cargarHtml("mis-propuestas.html");
  iniciarSesionDePrueba({ rol: "Estudiante", nombre: "Ana Pérez" });
});

describe("funciones puras", () => {
  test("normalizarNombre ignora mayúsculas y espacios sobrantes", () => {
    expect(normalizarNombre("  Ana   PÉREZ ")).toBe("ana pérez");
    expect(normalizarNombre(null)).toBe("");
  });
  test.each([
    [null, "Debes adjuntar el PDF actualizado de la propuesta."],
    [crearArchivo({ tipo: "image/png" }), "El archivo debe ser un PDF."],
    [crearArchivo({ tamanoMB: 11 }), "El PDF no debe superar 10 MB."],
    [crearArchivo(), null],
  ])("validarPdfReenvio %#", (archivo, esperado) => {
    expect(validarPdfReenvio(archivo)).toBe(esperado);
  });
});

describe("pintarCategoriasReenvio / pintarIntegrantesReenvio", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="lista-categorias-reenvio"></div><div id="lista-integrantes-reenvio"></div>';
  });

  test("categorías: marca las actuales (objetos o números)", async () => {
    simularApi({ "GET /categorias": ok(CATEGORIAS) });
    await pintarCategoriasReenvio([{ id_category: 2 }]);
    expect($("rcat-2").checked).toBe(true);
    expect($("rcat-1").checked).toBe(false);
    await pintarCategoriasReenvio([1]);
    expect($("rcat-1").checked).toBe(true);
  });
  test("categorías: vacío, error y sin contenedor", async () => {
    simularApi({ "GET /categorias": ok([]) });
    await pintarCategoriasReenvio(undefined);
    expect($("lista-categorias-reenvio").textContent).toContain("No se pudieron cargar las categorías.");
    simularApi({ "GET /categorias": falloDeRed() });
    await pintarCategoriasReenvio([]);
    expect($("lista-categorias-reenvio").textContent).toContain("Error al cargar categorías.");
    document.body.innerHTML = "";
    await expect(pintarCategoriasReenvio([])).resolves.toBeUndefined();
  });

  test("integrantes: marca los seleccionados (ids u objetos)", async () => {
    simularApi({ "GET /estudiantes": ok(ESTUDIANTES) });
    await pintarIntegrantesReenvio([{ id_user: 7 }, 8]);
    expect($("ri-7").checked).toBe(true);
    expect($("ri-8").checked).toBe(true);
  });
  test("integrantes: vacío, error y sin contenedor", async () => {
    simularApi({ "GET /estudiantes": ok([]) });
    await pintarIntegrantesReenvio([]);
    expect($("lista-integrantes-reenvio").textContent).toContain("No hay otros estudiantes disponibles");
    simularApi({ "GET /estudiantes": falloDeRed() });
    await pintarIntegrantesReenvio([]);
    expect($("lista-integrantes-reenvio").textContent).toContain("No fue posible cargar los integrantes.");
    document.body.innerHTML = "";
    await expect(pintarIntegrantesReenvio([])).resolves.toBeUndefined();
  });
});

describe("inicializarMiPropuesta", () => {
  test("404: todavía no radicó", async () => {
    simularApi({ "GET /propuestas/mia": estado(404) });
    await inicializarMiPropuesta();
    expect($("contenedor-propuesta").textContent).toContain("Todavía no has radicado ninguna propuesta.");
  });
  test("error del servidor o de red", async () => {
    simularApi({ "GET /propuestas/mia": estado(500) });
    await inicializarMiPropuesta();
    expect($("contenedor-propuesta").textContent).toContain("No fue posible cargar tu propuesta");
    simularApi({ "GET /propuestas/mia": falloDeRed() });
    await inicializarMiPropuesta();
    expect($("contenedor-propuesta").textContent).toContain("No fue posible cargar tu propuesta");
  });

  test("propuesta pendiente: datos, enlace al PDF y sin formulario de reenvío", async () => {
    simularApi({ "GET /propuestas/mia": ok({ ...PROPUESTA, estado: "Pendiente de validación", integrantes: [7], resubmit_count: 0 }) });
    await inicializarMiPropuesta();
    const c = $("contenedor-propuesta");
    expect(c.querySelector("h2").textContent).toBe("Mi <tesis>");
    expect(c.querySelector(".badge-estado").classList.contains("pendiente")).toBe(true);
    expect(c.textContent).toContain("#7"); // integrante sin nombre
    expect(c.textContent).not.toContain("Reenvíos realizados");
    expect(c.querySelector("#mis-pdf-contenedor a").getAttribute("href")).toBe("https://x/p.pdf");
    expect($("form-reenvio")).toBeNull();
  });

  test("propuesta aprobada: muestra quién la aprobó y cuándo", async () => {
    simularApi({ "GET /propuestas/mia": ok({ ...PROPUESTA, estado: "Aprobada", reviewer_name: "Pedro", reviewed_at: "2026-10-05T10:00:00Z" }) });
    await inicializarMiPropuesta();
    const c = $("contenedor-propuesta");
    expect(c.querySelector(".badge-estado").classList.contains("aprobada")).toBe(true);
    expect(c.textContent).toContain("Aprobada por Pedro el");
    expect($("form-reenvio")).toBeNull();
  });

  test("propuesta rechazada: muestra el motivo, los reenvíos y el formulario si es el líder", async () => {
    simularApi({ "GET /propuestas/mia": ok(PROPUESTA), "GET /categorias": ok(CATEGORIAS), "GET /estudiantes": ok(ESTUDIANTES) });
    await inicializarMiPropuesta();
    await esperar();
    const c = $("contenedor-propuesta");
    expect(c.textContent).toContain("Motivo del rechazo:");
    expect(c.textContent).toContain("Falta justificación");
    expect(c.textContent).toContain("Reenvíos realizados: 1 de 3");
    expect($("form-reenvio")).not.toBeNull();
    expect($("re-titulo").value).toBe("Mi <tesis>");
    expect($("rcat-2").checked).toBe(true);
    expect($("ri-7").checked).toBe(true);
    expect(c.textContent).toContain("Reenvíos restantes: 2 de 3");
  });

  test("si no es el líder (otro nombre) no ve el formulario aunque esté rechazada", async () => {
    iniciarSesionDePrueba({ rol: "Estudiante", nombre: "Otra Persona" });
    simularApi({ "GET /propuestas/mia": ok(PROPUESTA) });
    await inicializarMiPropuesta();
    expect($("form-reenvio")).toBeNull();
  });

  test("sin nombre en la sesión tampoco se considera líder", async () => {
    iniciarSesionDePrueba({ rol: "Estudiante", nombre: undefined });
    simularApi({ "GET /propuestas/mia": ok({ ...PROPUESTA, leader_name: undefined }) });
    await inicializarMiPropuesta();
    expect($("form-reenvio")).toBeNull();
  });

  test("con mensaje de éxito lo muestra y le da el foco", async () => {
    simularApi({ "GET /propuestas/mia": ok({ ...PROPUESTA, estado: "Pendiente de validación" }) });
    await inicializarMiPropuesta("Reenviada.");
    expect($("banner-propuesta").className).toContain("success");
    expect($("banner-propuesta").textContent).toContain("Reenviada.");
    expect(document.activeElement).toBe($("banner-propuesta"));
  });
});

describe("toggleFormularioReenvio", () => {
  test("abre el formulario moviendo el foco al título y lo cierra devolviendo el foco al botón", async () => {
    simularApi({ "GET /propuestas/mia": ok(PROPUESTA), "GET /categorias": ok([]), "GET /estudiantes": ok([]) });
    await inicializarMiPropuesta();
    toggleFormularioReenvio(true);
    expect($("form-reenvio").classList.contains("hidden")).toBe(false);
    expect($("btn-abrir-reenvio").classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe($("re-titulo"));
    toggleFormularioReenvio(false);
    expect($("form-reenvio").classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe($("btn-abrir-reenvio"));
  });
  test("sin formulario no hace nada", () => {
    expect(() => toggleFormularioReenvio(true)).not.toThrow();
  });
});

describe("manejarReenvio", () => {
  async function abrirFormulario(rutas = {}) {
    let llamadasMia = 0;
    const fetchMock = simularApi({
      "GET /propuestas/mia": () => {
        llamadasMia += 1;
        return ok(llamadasMia === 1 ? PROPUESTA : { ...PROPUESTA, estado: "Pendiente de validación" });
      },
      "GET /categorias": ok(CATEGORIAS),
      "GET /estudiantes": ok(ESTUDIANTES),
      ...rutas,
    });
    await inicializarMiPropuesta();
    await esperar();
    return fetchMock;
  }
  const enviar = async () => {
    enviarFormulario($("form-reenvio"));
    await esperar();
  };

  test("campos vacíos o sin PDF: no envía y señala los errores", async () => {
    const fetchMock = await abrirFormulario();
    $("re-titulo").value = "  ";
    $("rcat-2").checked = false;
    await enviar();
    const texto = $("banner-reenvio").textContent;
    expect(texto).toContain("El título es obligatorio.");
    expect(texto).toContain("Selecciona al menos una categoría.");
    expect(texto).toContain("Debes adjuntar el PDF actualizado");
    expect($("re-titulo").getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock.llamadas.some((l) => l.metodo === "PATCH")).toBe(false);
  });

  test("reenvío correcto: manda el FormData, repinta la propuesta y muestra el mensaje", async () => {
    const fetchMock = await abrirFormulario({ "PATCH /propuestas/5/reenviar": ok({ mensaje: "Reenviada con éxito." }) });
    asignarArchivos($("re-pdf"), [crearArchivo()]);
    $("re-titulo").value = " Título nuevo ";
    await enviar();

    const patch = fetchMock.llamadas.find((l) => l.metodo === "PATCH");
    const fd = patch.opciones.body;
    expect(fd.get("title_proposal")).toBe("Título nuevo");
    expect(fd.get("categorias")).toBe("[2]");
    expect(fd.get("integrantes")).toBe("[7]");
    expect(fd.get("pdf").name).toBe("doc.pdf");
    expect($("banner-propuesta").textContent).toContain("Reenviada con éxito.");
    expect($("contenedor-propuesta").querySelector(".badge-estado").classList.contains("pendiente")).toBe(true);
  });

  test("reenvío correcto sin mensaje usa el texto por defecto", async () => {
    await abrirFormulario({ "PATCH /propuestas/5/reenviar": ok({}) });
    asignarArchivos($("re-pdf"), [crearArchivo()]);
    await enviar();
    expect($("banner-propuesta").textContent).toContain("Propuesta reenviada correctamente.");
  });

  test("rechazo del backend (con y sin mensaje) y falta de conexión", async () => {
    await abrirFormulario({ "PATCH /propuestas/5/reenviar": estado(400, { mensaje: "Sin reenvíos disponibles." }) });
    asignarArchivos($("re-pdf"), [crearArchivo()]);
    await enviar();
    expect($("banner-reenvio").textContent).toContain("Sin reenvíos disponibles.");
    expect($("btn-reenviar").disabled).toBe(false);

    simularApi({ "PATCH /propuestas/5/reenviar": estado(500) });
    await enviar();
    expect($("banner-reenvio").textContent).toContain("No fue posible reenviar la propuesta.");

    simularApi({ "PATCH /propuestas/5/reenviar": falloDeRed() });
    await enviar();
    expect($("banner-reenvio").textContent).toContain("No fue posible conectar con el servidor.");
  });
});
