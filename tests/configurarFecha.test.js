const {
  cargarBase, cargar, cargarHtml, simularBootstrap, iniciarSesionDePrueba,
  simularApi, ok, estado, falloDeRed, esperar,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("js/configurarFecha.js");
});

const $ = (id) => document.getElementById(id);
let modal;

beforeEach(() => {
  localStorage.clear();
  cargarHtml("configurarFecha.html");
  simularBootstrap();
  modal = { show: jest.fn(), hide: jest.fn() };
  window.modal_fechas = modal;
  window.ciclos_a_cargo = [];
  window.seleccion = null;
});

describe("formato de fechas", () => {
  test("cortarFecha", () => {
    expect(cortarFecha("2026-10-24 00:00:00")).toBe("2026-10-24");
    expect(cortarFecha("2026-10-24T23:59:59")).toBe("2026-10-24");
    expect(cortarFecha(null)).toBe("");
  });
  test("textoFecha pasa a dd/mm/aaaa", () => {
    expect(textoFecha("2026-10-24 00:00:00")).toBe("24/10/2026");
    expect(textoFecha("")).toBe("");
  });
  test("textoRango", () => {
    expect(textoRango(null)).toBe("Sin definir");
    expect(textoRango({ start_date: "2026-10-01", end_date: "2026-10-31" })).toBe("01/10/2026 al 31/10/2026");
  });
});

describe("pintarTablaFechas", () => {
  test("sin ciclos a cargo", () => {
    pintarTablaFechas();
    expect($("tabla-fechas").textContent).toContain("No tienes ciclos a cargo.");
  });
  test("cuatro filas (una por etapa) por cada ciclo", () => {
    window.ciclos_a_cargo = [
      { id_cycle: 1, fechas: { "Radicación": { start_date: "2026-10-01", end_date: "2026-10-31" }, "Registro PGC": null, "Sustentación": null, "Calificación": null } },
    ];
    pintarTablaFechas();
    const filas = $("tabla-fechas").querySelectorAll("tr");
    expect(filas).toHaveLength(4);
    expect(filas[0].textContent).toContain("01/10/2026 al 31/10/2026");
    expect(filas[1].textContent).toContain("Sin definir");
  });
});

describe("abrirEdicion", () => {
  beforeEach(() => {
    window.ciclos_a_cargo = [
      { id_cycle: 1, fechas: { "Radicación": { start_date: "2026-10-01 00:00:00", end_date: "2026-10-31 23:59:59" }, "Registro PGC": null } },
    ];
  });
  test("un ciclo desconocido no abre nada", () => {
    abrirEdicion(99, "Radicación");
    expect(modal.show).not.toHaveBeenCalled();
  });
  test("precarga las fechas existentes", () => {
    abrirEdicion("1", "Radicación");
    expect($("fechas-titulo").textContent).toBe("Ciclo 1 — Radicación");
    expect($("input-fecha-inicio").value).toBe("2026-10-01");
    expect($("input-fecha-fin").value).toBe("2026-10-31");
    expect(modal.show).toHaveBeenCalled();
  });
  test("una etapa sin definir deja los campos vacíos", () => {
    abrirEdicion(1, "Registro PGC");
    expect($("input-fecha-inicio").value).toBe("");
  });
});

describe("guardarFechas", () => {
  beforeEach(() => {
    window.ciclos_a_cargo = [{ id_cycle: 1, fechas: { "Radicación": null } }];
    abrirEdicion(1, "Radicación");
  });
  const llenar = (inicio, fin) => {
    $("input-fecha-inicio").value = inicio;
    $("input-fecha-fin").value = fin;
  };

  test("exige las dos fechas", async () => {
    llenar("2026-10-01", "");
    await guardarFechas();
    expect($("banner-modal-fechas").textContent).toContain("Debes completar las dos fechas.");
  });

  test("la fecha de fin no puede ser anterior a la de inicio", async () => {
    llenar("2026-10-10", "2026-10-01");
    await guardarFechas();
    expect($("banner-modal-fechas").textContent).toContain("no puede ser anterior");
  });

  test("guarda, actualiza la tabla y cierra el modal", async () => {
    const fetchMock = simularApi({ "PUT /ciclos/1/fechas/*": ok({}) });
    llenar("2026-10-01", "2026-10-31");
    await guardarFechas();
    const put = fetchMock.llamadas[0];
    expect(put.ruta).toBe("/ciclos/1/fechas/Radicaci%C3%B3n");
    expect(JSON.parse(put.opciones.body)).toEqual({ start_date: "2026-10-01T00:00:00", end_date: "2026-10-31T23:59:59" });
    expect(window.ciclos_a_cargo[0].fechas["Radicación"].start_date).toBe("2026-10-01T00:00:00");
    expect($("tabla-fechas").textContent).toContain("01/10/2026 al 31/10/2026");
    expect(modal.hide).toHaveBeenCalled();
    expect($("banner").className).toContain("success");
    expect($("btn-guardar-fechas").disabled).toBe(false);
  });

  test("usa el mensaje del backend cuando lo trae", async () => {
    simularApi({ "PUT /ciclos/1/fechas/*": ok({ mensaje: "Fechas listas." }) });
    llenar("2026-10-01", "2026-10-31");
    await guardarFechas();
    expect($("banner").textContent).toContain("Fechas listas.");
  });

  test("error del backend", async () => {
    simularApi({ "PUT /ciclos/1/fechas/*": estado(400, { mensaje: "Se cruza con otra etapa." }) });
    llenar("2026-10-01", "2026-10-31");
    await guardarFechas();
    expect($("banner-modal-fechas").textContent).toContain("Se cruza con otra etapa.");
    expect(modal.hide).not.toHaveBeenCalled();
  });

  test("error sin mensaje y sin conexión", async () => {
    simularApi({ "PUT /ciclos/1/fechas/*": estado(500) });
    llenar("2026-10-01", "2026-10-31");
    await guardarFechas();
    expect($("banner-modal-fechas").textContent).toContain("No fue posible guardar las fechas.");

    simularApi({ "PUT /ciclos/1/fechas/*": falloDeRed() });
    await guardarFechas();
    expect($("banner-modal-fechas").textContent).toContain("No fue posible conectar con el servidor.");
  });
});

describe("inicializarConfigurarFecha", () => {
  test("carga las fechas de cada ciclo a cargo y pinta la tabla", async () => {
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [1] });
    simularApi({
      "GET /ciclos/1/fechas": ok([{ stage: "Radicación", start_date: "2026-10-01 00:00:00", end_date: "2026-10-31 23:59:59" }]),
    });
    await inicializarConfigurarFecha();
    expect(window.ciclos_a_cargo).toHaveLength(1);
    expect($("tabla-fechas").querySelectorAll("tr")).toHaveLength(4);
    expect($("tabla-fechas").textContent).toContain("01/10/2026 al 31/10/2026");
  });

  test("si la carga falla no pinta 'Sin definir' (evita sobrescribir fechas reales)", async () => {
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [1] });
    simularApi({ "GET /ciclos/1/fechas": estado(500) });
    await inicializarConfigurarFecha();
    expect($("banner").textContent).toContain("No fue posible cargar las fechas de tus ciclos");
    expect($("tabla-fechas").textContent).not.toContain("Sin definir");
  });

  test("el botón 'Editar' abre el modal y 'Guardar' envía el cambio", async () => {
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [1] });
    const fetchMock = simularApi({ "GET /ciclos/1/fechas": ok([]), "PUT /ciclos/1/fechas/*": ok({}) });
    await inicializarConfigurarFecha();
    const modalCreado = global.bootstrap.instancias[0];

    $("tabla-fechas").querySelector("button[data-ciclo]").click();
    expect(modalCreado.show).toHaveBeenCalled();

    $("input-fecha-inicio").value = "2026-11-01";
    $("input-fecha-fin").value = "2026-11-30";
    $("btn-guardar-fechas").click();
    await esperar();
    expect(fetchMock.llamadas.some((l) => l.metodo === "PUT")).toBe(true);
  });
});
