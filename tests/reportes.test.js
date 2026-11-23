const { cargarBase, cargar, cargarHtml, iniciarSesionDePrueba, simularApi, ok, estado, falloDeRed } = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("js/reportes.js");
});

beforeEach(() => {
  localStorage.clear();
  iniciarSesionDePrueba({ rol: "Profesor" });
  cargarHtml("reportes.html");

  // jsdom no implementa de verdad la descarga de archivos: se simulan
  // los dos métodos que usa reportes.js para disparar la descarga.
  global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = jest.fn();
  HTMLAnchorElement.prototype.click = jest.fn();

  inicializarReportes();
});

describe("reportes.js", () => {
  test("botón 'General' pide el PDF general y dispara la descarga", async () => {
    const fetch = simularApi({ "GET /pgc/informe/general/pdf*": ok({}) });

    document.getElementById("btn-informe-general").click();
    await new Promise((r) => setTimeout(r, 0));

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/pgc/informe/general/pdf"), expect.any(Object));
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  test("botón 'Por ciclos' pide el PDF por ciclos y dispara la descarga", async () => {
    simularApi({ "GET /pgc/informe/ciclos/pdf*": ok({}) });

    document.getElementById("btn-informe-ciclos").click();
    await new Promise((r) => setTimeout(r, 0));

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  test("muestra un banner de error si el backend responde con error", async () => {
    simularApi({ "GET /pgc/informe/general/pdf*": estado(500, {}) });

    document.getElementById("btn-informe-general").click();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById("banner").classList.contains("error")).toBe(true);
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  test("muestra un banner de error si falla la red", async () => {
    simularApi({ "GET /pgc/informe/general/pdf*": falloDeRed() });

    document.getElementById("btn-informe-general").click();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById("banner").classList.contains("error")).toBe(true);
  });
});
