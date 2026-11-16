const {
  cargarBase, cargar, cargarHtml, iniciarSesionDePrueba, simularApi, ok, estado, falloDeRed,
  crearArchivo, asignarArchivos, enviarFormulario, simularUbicacion, congelarFecha, descongelarFecha, esperar,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("js/radicar-propuesta.js");
});

const $ = (id) => document.getElementById(id);
const VENTANA = (inicio, fin) => [{ stage: "Radicación", start_date: inicio, end_date: fin }];

let ubicacion;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  cargarHtml("radicar-propuesta.html");
  ubicacion = simularUbicacion();
  congelarFecha("2026-11-12T12:00:00");
});
afterEach(() => descongelarFecha());

test("formatearRangoFechas", () => {
  expect(formatearRangoFechas("2026-10-01", "2026-10-31")).toBe(" (habilitado del 2026-10-01 al 2026-10-31)");
  expect(formatearRangoFechas(null, "2026-10-31")).toBe("");
});

describe("pintarCategorias", () => {
  test("pinta un checkbox por categoría y guarda la lista", async () => {
    simularApi({ "GET /categorias": ok([{ id_category: 1, name_category: "IA" }, { id_category: 2, name_category: "Web" }]) });
    await pintarCategorias();
    expect($("lista-categorias").querySelectorAll("input[type=checkbox]")).toHaveLength(2);
    expect(JSON.parse($("lista-categorias").dataset.categorias)).toHaveLength(2);
  });
  test("lista vacía, error HTTP o de red", async () => {
    simularApi({ "GET /categorias": ok([]) });
    await pintarCategorias();
    expect($("lista-categorias").textContent).toContain("No se pudieron cargar las categorías.");

    simularApi({ "GET /categorias": estado(500) });
    await pintarCategorias();
    expect($("lista-categorias").textContent).toContain("No se pudieron cargar las categorías.");

    simularApi({ "GET /categorias": falloDeRed() });
    await pintarCategorias();
    expect($("lista-categorias").textContent).toContain("Error al cargar categorías.");
  });
  test("sin contenedor no hace nada", async () => {
    document.body.innerHTML = "";
    await expect(pintarCategorias()).resolves.toBeUndefined();
  });
});

describe("pintarIntegrantes", () => {
  test("pinta un checkbox por estudiante del ciclo", async () => {
    simularApi({ "GET /estudiantes": ok([{ id_user: 7, full_name: "Luis <Gómez>" }]) });
    await pintarIntegrantes();
    expect($("integrante-7")).not.toBeNull();
    expect($("lista-integrantes").textContent).toContain("Luis <Gómez>");
  });
  test("sin estudiantes, error HTTP o de red", async () => {
    simularApi({ "GET /estudiantes": ok([]) });
    await pintarIntegrantes();
    expect($("lista-integrantes").textContent).toContain("No hay otros estudiantes disponibles");

    simularApi({ "GET /estudiantes": estado(500) });
    await pintarIntegrantes();
    expect($("lista-integrantes").textContent).toContain("No hay otros estudiantes disponibles");

    simularApi({ "GET /estudiantes": falloDeRed() });
    await pintarIntegrantes();
    expect($("lista-integrantes").textContent).toContain("No fue posible cargar los integrantes.");
  });
});

describe("validarPdf", () => {
  test.each([
    [null, "Debes adjuntar el PDF de la propuesta."],
    [crearArchivo({ tipo: "text/plain" }), "El archivo debe ser un PDF."],
    [crearArchivo({ tamanoMB: 10.5 }), "El PDF no debe superar 10 MB."],
    [crearArchivo({ tamanoMB: 10 }), null],
    [crearArchivo({ tamanoMB: 1 }), null],
  ])("archivo %#", (archivo, esperado) => {
    expect(validarPdf(archivo)).toBe(esperado);
  });
});

describe("obtenerBloqueoPorFecha", () => {
  test("sin sesión o sin ciclo no bloquea", async () => {
    expect(await obtenerBloqueoPorFecha()).toBeNull();
    iniciarSesionDePrueba({ rol: "Estudiante" });
    expect(await obtenerBloqueoPorFecha()).toBeNull();
  });

  describe("con ciclo", () => {
    beforeEach(() => iniciarSesionDePrueba({ rol: "Estudiante", id_cycle: 3 }));

    test("etapa sin configurar", async () => {
      simularApi({ "GET /ciclos/3/fechas": ok([]) });
      expect(await obtenerBloqueoPorFecha()).toContain("todavía no ha sido configurado");
    });
    test("fuera de fechas, con el rango en el mensaje", async () => {
      simularApi({ "GET /ciclos/3/fechas": ok(VENTANA("2026-10-01 00:00:00", "2026-10-31 23:59:59")) });
      const motivo = await obtenerBloqueoPorFecha();
      expect(motivo).toContain("no está disponible");
      expect(motivo).toContain("2026-10-01 00:00:00");
    });
    test("antes de abrir también bloquea", async () => {
      simularApi({ "GET /ciclos/3/fechas": ok(VENTANA("2026-12-01 00:00:00", "2026-12-31 23:59:59")) });
      expect(await obtenerBloqueoPorFecha()).toContain("no está disponible");
    });
    test("dentro del periodo no bloquea", async () => {
      simularApi({ "GET /ciclos/3/fechas": ok(VENTANA("2026-11-01 00:00:00", "2026-11-30 23:59:59")) });
      expect(await obtenerBloqueoPorFecha()).toBeNull();
    });
    test("si la consulta falla no bloquea", async () => {
      simularApi({ "GET /ciclos/3/fechas": estado(500) });
      expect(await obtenerBloqueoPorFecha()).toBeNull();
      simularApi({ "GET /ciclos/3/fechas": falloDeRed() });
      expect(await obtenerBloqueoPorFecha()).toBeNull();
    });
  });
});

describe("inicializarRadicarPropuesta: bloqueos previos", () => {
  beforeEach(() => iniciarSesionDePrueba({ rol: "Estudiante" }));

  test.each([
    ["Pendiente de validación", "una propuesta pendiente de validación"],
    ["Rechazada", "una propuesta rechazada"],
    ["Anulada", "una propuesta anulada"],
    ["Rara", "una propuesta registrada"],
  ])("ya tiene una propuesta %s: bloquea el formulario", async (estadoPropuesta, texto) => {
    simularApi({ "GET /propuestas/mia": ok({ estado: estadoPropuesta }) });
    await inicializarRadicarPropuesta();
    expect($("form-propuesta").classList.contains("hidden")).toBe(true);
    expect($("banner").textContent).toContain(texto);
    expect($("banner").querySelector("a").getAttribute("href")).toBe("mis-propuestas.html");
  });

  test("si la propuesta ya fue aprobada redirige a 'Mi propuesta' con un aviso", async () => {
    simularApi({ "GET /propuestas/mia": ok({ estado: "Aprobada" }) });
    await inicializarRadicarPropuesta();
    expect(ubicacion.href).toBe("mis-propuestas.html");
    expect(sessionStorage.getItem("banner_info")).toContain("ya fue aprobada");
  });

  test("fuera del periodo de radicación el formulario no se muestra", async () => {
    iniciarSesionDePrueba({ rol: "Estudiante", id_cycle: 3 });
    simularApi({
      "GET /propuestas/mia": estado(404),
      "GET /ciclos/3/fechas": ok(VENTANA("2026-10-01 00:00:00", "2026-10-31 23:59:59")),
    });
    await inicializarRadicarPropuesta();
    expect($("form-propuesta").classList.contains("hidden")).toBe(true);
    expect($("banner").textContent).toContain("no está disponible");
  });
});

describe("inicializarRadicarPropuesta: envío del formulario", () => {
  const CATEGORIAS = [{ id_category: 1, name_category: "IA" }, { id_category: 2, name_category: "Web" }];
  const ESTUDIANTES = [{ id_user: 7, full_name: "Luis" }];

  async function prepararFormulario(rutas = {}) {
    iniciarSesionDePrueba({ rol: "Estudiante" });
    const fetchMock = simularApi({
      "GET /propuestas/mia": estado(404),
      "GET /categorias": ok(CATEGORIAS),
      "GET /estudiantes": ok(ESTUDIANTES),
      ...rutas,
    });
    await inicializarRadicarPropuesta();
    await esperar(); // pintarCategorias / pintarIntegrantes no se esperan dentro del init
    return fetchMock;
  }

  function llenarFormulario({ pdf = crearArchivo() } = {}) {
    $("titulo").value = " Mi proyecto ";
    $("descripcion").value = "Descripción";
    $("problema").value = "Problema";
    $("justificacion").value = "Justificación";
    $("objetivos").value = "Objetivos";
    $("solucion").value = "Solución";
    $("cat-2").checked = true;
    $("integrante-7").checked = true;
    asignarArchivos($("pdf"), pdf ? [pdf] : []);
  }

  const enviar = async () => {
    enviarFormulario($("form-propuesta"));
    await esperar();
  };

  test("pinta categorías e integrantes al abrir el formulario", async () => {
    await prepararFormulario();
    expect($("cat-1")).not.toBeNull();
    expect($("integrante-7")).not.toBeNull();
  });

  test("un formulario vacío no se envía y señala los campos con error", async () => {
    const fetchMock = await prepararFormulario();
    await enviar();
    expect($("banner").className).toContain("error");
    expect($("banner").textContent).toContain("El título es obligatorio.");
    expect($("banner").textContent).toContain("Selecciona al menos una categoría.");
    expect($("titulo").getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock.llamadas.some((l) => l.metodo === "POST")).toBe(false);
  });

  test("un PDF inválido también bloquea el envío", async () => {
    const fetchMock = await prepararFormulario();
    llenarFormulario({ pdf: crearArchivo({ tipo: "image/png" }) });
    await enviar();
    expect($("banner").textContent).toContain("El archivo debe ser un PDF.");
    expect(fetchMock.llamadas.some((l) => l.metodo === "POST")).toBe(false);
  });

  test("envío correcto: manda el FormData esperado, oculta el formulario y avisa", async () => {
    const fetchMock = await prepararFormulario({ "POST /propuestas": ok({ mensaje: "Radicada." }) });
    llenarFormulario();
    await enviar();

    const post = fetchMock.llamadas.find((l) => l.metodo === "POST");
    const fd = post.opciones.body;
    expect(fd.get("title_proposal")).toBe("Mi proyecto");
    expect(fd.get("descr_proposal")).toBe("Descripción");
    expect(fd.get("categorias")).toBe("[2]");
    expect(fd.get("integrantes")).toBe("[7]");
    expect(fd.get("pdf").name).toBe("doc.pdf");
    expect(fd.has("id_cycle")).toBe(false);

    expect($("form-propuesta").classList.contains("hidden")).toBe(true);
    expect($("banner").className).toContain("success");
    expect($("banner").textContent).toContain("Radicada.");
    expect($("btn-radicar").disabled).toBe(false);
    expect($("btn-radicar").textContent).toBe("Radicar propuesta");
  });

  test("envío correcto sin mensaje del backend usa el texto por defecto", async () => {
    await prepararFormulario({ "POST /propuestas": ok({}) });
    llenarFormulario();
    await enviar();
    expect($("banner").textContent).toContain("Propuesta radicada correctamente.");
  });

  test("rechazo del backend: mensaje + rango de fechas", async () => {
    await prepararFormulario({
      "POST /propuestas": estado(400, { mensaje: "Fuera de fecha.", fecha_inicio_radicacion: "2026-10-01", fecha_fin_radicacion: "2026-10-31" }),
    });
    llenarFormulario();
    await enviar();
    expect($("banner").className).toContain("error");
    expect($("banner").textContent).toContain("Fuera de fecha. (habilitado del 2026-10-01 al 2026-10-31)");
    expect($("form-propuesta").classList.contains("hidden")).toBe(false);
  });

  test("rechazo sin mensaje y sin conexión", async () => {
    await prepararFormulario({ "POST /propuestas": estado(500) });
    llenarFormulario();
    await enviar();
    expect($("banner").textContent).toContain("No fue posible radicar la propuesta.");

    simularApi({ "POST /propuestas": falloDeRed() });
    await enviar();
    expect($("banner").textContent).toContain("No fue posible conectar con el servidor.");
  });
});
