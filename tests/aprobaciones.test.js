const {
  cargarBase, cargar, cargarHtml, simularBootstrap, iniciarSesionDePrueba,
  simularApi, ok, estado, falloDeRed, esperar,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("js/aprobaciones.js");
});

const P1 = {
  id_proposal: 5, title_proposal: "Sistema <PGC>", leader_name: "Ana", num_integrantes: 2, ciclo: "Fundamentación",
  nombres_integrantes: "Ana, Luis", categorias: "IA, Web", descr_proposal: "Descripción",
  problem_proposal: "Problema", justification_proposal: "Justificación",
  objectives_proposal: "Objetivos", solution_proposal: "Solución",
};
const P2 = { id_proposal: 6, title_proposal: "Otra", leader_name: "", ciclo: "Transición" };

const $ = (id) => document.getElementById(id);
let bootstrapMock;

beforeEach(() => {
  localStorage.clear();
  cargarHtml("aprobaciones.html");
  bootstrapMock = simularBootstrap();
  window.modalDetalle = { show: jest.fn(), hide: jest.fn() };
  window.propuestas = [];
  window.propuestaSeleccionada = null;
});

describe("pintarTabla", () => {
  test("sin propuestas muestra el mensaje de vacío", () => {
    pintarTabla();
    expect($("tabla-propuestas").textContent).toContain("No hay propuestas pendientes.");
  });
  test("una fila por propuesta, con el texto escapado", () => {
    window.propuestas = [P1, P2];
    pintarTabla();
    const filas = $("tabla-propuestas").querySelectorAll("tr");
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain("Sistema <PGC>");
    expect(filas[0].querySelector("button").getAttribute("onclick")).toBe("abrirDetalle(5)");
  });
});

describe("abrirDetalle", () => {
  beforeEach(() => {
    window.propuestas = [P1, P2];
  });

  test("si el id no existe no hace nada", async () => {
    await abrirDetalle(999);
    expect(window.modalDetalle.show).not.toHaveBeenCalled();
  });

  test("llena el detalle, pide el PDF y abre el modal", async () => {
    simularApi({ "GET /propuestas/5/pdf": ok({ url: "https://x/p.pdf", expira_en_segundos: 600 }) });
    await abrirDetalle(5);
    expect($("detalle-titulo").textContent).toBe("Sistema <PGC>");
    expect($("detalle-lider").textContent).toBe("Ana");
    expect($("detalle-integrantes").textContent).toBe("Ana, Luis");
    expect($("detalle-problema").textContent).toBe("Problema");
    expect($("detalle-pdf-contenedor").querySelector("a").getAttribute("href")).toBe("https://x/p.pdf");
    expect(window.modalDetalle.show).toHaveBeenCalled();
  });

  test("usa textos por defecto cuando faltan datos", async () => {
    simularApi({ "GET /propuestas/6/pdf": estado(404) });
    await abrirDetalle(6);
    expect($("detalle-lider").textContent).toBe("—");
    expect($("detalle-integrantes").textContent).toBe("Solo el líder");
    expect($("detalle-categorias").textContent).toBe("Sin categorías");
    expect($("detalle-descripcion").textContent).toBe("—");
  });

  test("si el PDF no se puede obtener (error HTTP o de red) lo indica", async () => {
    simularApi({ "GET /propuestas/5/pdf": estado(500) });
    await abrirDetalle(5);
    expect($("detalle-pdf-contenedor").textContent).toContain("Sin documento adjunto");

    simularApi({ "GET /propuestas/5/pdf": falloDeRed() });
    await abrirDetalle(5);
    expect($("detalle-pdf-contenedor").textContent).toContain("Sin documento adjunto");
  });

  test("deja el modal en su estado inicial (sin rechazo ni confirmación abiertos)", async () => {
    simularApi({ "GET /propuestas/5/pdf": estado(404) });
    $("comentario-rechazo").value = "texto viejo";
    await abrirDetalle(5);
    expect($("comentario-rechazo").value).toBe("");
    expect($("zona-rechazo").classList.contains("hidden")).toBe(true);
    expect($("zona-confirmar-aprobacion").classList.contains("hidden")).toBe(true);
    expect($("btn-aprobar").classList.contains("d-none")).toBe(false);
  });
});

describe("mostrarConfirmacionAprobacion", () => {
  test("al confirmar esconde Aprobar/Rechazar, muestra la confirmación y enfoca el botón", () => {
    mostrarConfirmacionAprobacion(true);
    expect($("btn-aprobar").classList.contains("d-none")).toBe(true);
    expect($("btn-mostrar-rechazo").classList.contains("d-none")).toBe(true);
    expect($("btn-confirmar-aprobacion").classList.contains("d-none")).toBe(false);
    expect($("zona-confirmar-aprobacion").classList.contains("hidden")).toBe(false);
    expect(document.activeElement).toBe($("btn-confirmar-aprobacion"));
  });
  test("al cancelar restaura los botones", () => {
    mostrarConfirmacionAprobacion(true);
    mostrarConfirmacionAprobacion(false);
    expect($("btn-aprobar").classList.contains("d-none")).toBe(false);
    expect($("btn-confirmar-aprobacion").classList.contains("d-none")).toBe(true);
  });
});

test("quitarDeLaLista saca la propuesta, repinta y cierra el modal", () => {
  window.propuestas = [P1, P2];
  quitarDeLaLista(5);
  expect(window.propuestas).toEqual([P2]);
  expect($("tabla-propuestas").querySelectorAll("tr")).toHaveLength(1);
  expect(window.modalDetalle.hide).toHaveBeenCalled();
});

describe("inicializarAprobaciones", () => {
  test("sin ciclos asignados avisa y no pide nada", async () => {
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [] });
    const fetchMock = simularApi();
    await inicializarAprobaciones();
    expect($("banner").textContent).toContain("No tienes un ciclo asignado");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("junta las propuestas pendientes de todos sus ciclos", async () => {
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [1, 2] });
    const fetchMock = simularApi({
      "GET /propuestas*": ({ ruta }) => (ruta.includes("cycle=1") ? ok([P1]) : ok([P2])),
    });
    await inicializarAprobaciones();
    expect(fetchMock.llamadas.map((l) => l.ruta)).toEqual([
      "/propuestas?cycle=1&estado=Pendiente%20de%20validaci%C3%B3n",
      "/propuestas?cycle=2&estado=Pendiente%20de%20validaci%C3%B3n",
    ]);
    expect($("tabla-propuestas").querySelectorAll("tr")).toHaveLength(2);
  });

  test("si falla la carga muestra el error y la tabla vacía", async () => {
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [1] });
    simularApi({ "GET /propuestas*": estado(500) });
    await inicializarAprobaciones();
    expect($("banner").textContent).toContain("No fue posible cargar las propuestas");
    expect($("tabla-propuestas").textContent).toContain("No hay propuestas pendientes.");
  });

  describe("acciones del modal", () => {
    // Deja la pantalla inicializada y con la propuesta 5 abierta.
    async function prepararConPropuesta(rutasExtra = {}) {
      iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [1] });
      const fetchMock = simularApi({
        "GET /propuestas/5/pdf": estado(404),
        ...rutasExtra,
        "GET /propuestas*": ok([P1, P2]),
      });
      await inicializarAprobaciones();
      await abrirDetalle(5);
      return fetchMock;
    }

    test("Aprobar pide confirmación y Cancelar la retira", async () => {
      await prepararConPropuesta();
      $("btn-aprobar").click();
      expect($("zona-confirmar-aprobacion").classList.contains("hidden")).toBe(false);
      $("btn-cancelar-aprobacion").click();
      expect($("zona-confirmar-aprobacion").classList.contains("hidden")).toBe(true);
    });

    test("confirmar la aprobación llama al backend, avisa y quita la propuesta", async () => {
      const fetchMock = await prepararConPropuesta({ "PATCH /propuestas/5/aprobar": ok({}) });
      $("btn-confirmar-aprobacion").click();
      await esperar();
      expect(fetchMock.llamadas.some((l) => l.metodo === "PATCH" && l.ruta === "/propuestas/5/aprobar")).toBe(true);
      expect($("banner").className).toContain("success");
      expect($("banner").textContent).toContain("aprobada");
      expect(window.propuestas.map((p) => p.id_proposal)).toEqual([6]);
      expect($("btn-confirmar-aprobacion").disabled).toBe(false);
    });

    test("si el backend rechaza la aprobación muestra su mensaje y conserva la propuesta", async () => {
      await prepararConPropuesta({ "PATCH /propuestas/5/aprobar": estado(409, { mensaje: "Ya fue aprobada." }) });
      $("btn-confirmar-aprobacion").click();
      await esperar();
      expect($("banner").className).toContain("error");
      expect($("banner").textContent).toContain("Ya fue aprobada.");
      expect(window.propuestas).toHaveLength(2);
    });

    test("sin conexión al aprobar avisa que no se pudo conectar", async () => {
      await prepararConPropuesta({ "PATCH /propuestas/5/aprobar": falloDeRed() });
      $("btn-confirmar-aprobacion").click();
      await esperar();
      expect($("banner").textContent).toContain("No fue posible conectar con el servidor.");
    });

    test("'Rechazar' abre la zona de comentario", async () => {
      await prepararConPropuesta();
      $("btn-mostrar-rechazo").click();
      expect($("zona-rechazo").classList.contains("hidden")).toBe(false);
      expect($("btn-confirmar-rechazo").classList.contains("d-none")).toBe(false);
      expect($("btn-mostrar-rechazo").classList.contains("d-none")).toBe(true);
    });

    test("rechazar exige un comentario", async () => {
      const fetchMock = await prepararConPropuesta();
      $("btn-mostrar-rechazo").click();
      $("comentario-rechazo").value = "   ";
      $("btn-confirmar-rechazo").click();
      await esperar();
      expect($("comentario-rechazo").classList.contains("is-invalid")).toBe(true);
      expect(fetchMock.llamadas.some((l) => l.metodo === "PATCH")).toBe(false);
    });

    test("rechazar con comentario lo envía y quita la propuesta", async () => {
      const fetchMock = await prepararConPropuesta({ "PATCH /propuestas/5/rechazar": ok({ mensaje: "Rechazada." }) });
      $("btn-mostrar-rechazo").click();
      $("comentario-rechazo").value = "  Falta justificación  ";
      $("btn-confirmar-rechazo").click();
      await esperar();
      const llamada = fetchMock.llamadas.find((l) => l.ruta === "/propuestas/5/rechazar");
      expect(JSON.parse(llamada.opciones.body)).toEqual({ comentario: "Falta justificación" });
      expect($("banner").textContent).toContain("Rechazada.");
      expect(window.propuestas.map((p) => p.id_proposal)).toEqual([6]);
    });

    test("errores al rechazar (HTTP y red)", async () => {
      await prepararConPropuesta({ "PATCH /propuestas/5/rechazar": estado(500) });
      $("btn-mostrar-rechazo").click();
      $("comentario-rechazo").value = "motivo";
      $("btn-confirmar-rechazo").click();
      await esperar();
      expect($("banner").textContent).toContain("No fue posible rechazar la propuesta.");

      simularApi({ "PATCH /propuestas/5/rechazar": falloDeRed() });
      $("btn-confirmar-rechazo").click();
      await esperar();
      expect($("banner").textContent).toContain("No fue posible conectar con el servidor.");
    });
  });
});
