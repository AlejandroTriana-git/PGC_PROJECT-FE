const {
  cargarBase, cargar, iniciarSesionDePrueba, simularApi, ok, estado, falloDeRed,
  congelarFecha, descongelarFecha,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("components/pancartaFecha.js");
});

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="pancarta"></div>';
  congelarFecha("2026-11-12T12:00:00");
});
afterEach(() => descongelarFecha());

const fila = (stage, inicio, fin) => ({ stage, start_date: `${inicio} 00:00:00`, end_date: `${fin} 23:59:59` });
const contenido = () => document.getElementById("pancarta");

describe("funciones puras", () => {
  test("pancartaLeerFecha", () => {
    expect(pancartaLeerFecha("2026-11-01 10:00:00")).toBeInstanceOf(Date);
    expect(pancartaLeerFecha("")).toBeNull();
    expect(pancartaLeerFecha("xx")).toBeNull();
  });

  test("pancartaFormatear incluye el año", () => {
    expect(pancartaFormatear(new Date("2026-11-30T12:00:00"))).toMatch(/2026/);
  });

  describe("pancartaClasificar", () => {
    const hoy = new Date("2026-11-12T12:00:00");
    test("habilitada: hoy está dentro del rango", () => {
      expect(pancartaClasificar(fila("Radicación", "2026-11-01", "2026-11-30"), hoy).tipo).toBe("habilitada");
    });
    test("próxima: empieza dentro de los 15 días de aviso", () => {
      expect(pancartaClasificar(fila("Radicación", "2026-11-20", "2026-12-15"), hoy).tipo).toBe("proxima");
    });
    test("null si empieza dentro de más de 15 días", () => {
      expect(pancartaClasificar(fila("Radicación", "2026-12-30", "2027-01-15"), hoy)).toBeNull();
    });
    test("null si ya terminó", () => {
      expect(pancartaClasificar(fila("Radicación", "2026-09-01", "2026-10-01"), hoy)).toBeNull();
    });
    test("null si las fechas son ilegibles", () => {
      expect(pancartaClasificar({ start_date: null, end_date: null }, hoy)).toBeNull();
    });
  });

  describe("pancartaTexto", () => {
    test("habilitada: dice hasta cuándo", () => {
      const t = pancartaTexto({ stage: "Radicación", tipo: "habilitada", fin: new Date("2026-11-30T12:00:00") });
      expect(t).toContain("La radicación de propuestas ya está habilitada");
      expect(t).toMatch(/Tienes hasta el .*2026/);
    });
    test("próxima: dice cuándo se habilita y hasta cuándo", () => {
      const t = pancartaTexto({
        stage: "Registro PGC", tipo: "proxima",
        inicio: new Date("2026-11-20T12:00:00"), fin: new Date("2026-12-15T12:00:00"),
      });
      expect(t).toContain("El registro del PGC se habilitará el");
      expect(t).toContain("estará disponible hasta el");
    });
  });
});

describe("pancartaNombresCiclo", () => {
  test("arma el mapa id → nombre", async () => {
    simularApi({ "GET /ciclos": ok([{ id: 1, subject_cycle: "Fundamentación" }]) });
    expect(await pancartaNombresCiclo()).toEqual({ 1: "Fundamentación" });
  });
  test("devuelve {} si la API falla", async () => {
    simularApi({ "GET /ciclos": estado(500) });
    expect(await pancartaNombresCiclo()).toEqual({});
    simularApi({ "GET /ciclos": falloDeRed() });
    expect(await pancartaNombresCiclo()).toEqual({});
  });
});

describe("pancartaObtenerObjetivos", () => {
  test("estudiante: etapas de su ciclo (sin Calificación)", async () => {
    const m = await pancartaObtenerObjetivos({ rol: "estudiante", id_cycle: 3 });
    expect([...m.get(3)]).toEqual(["Radicación", "Registro PGC", "Sustentación"]);
  });
  test("estudiante sin ciclo: sin objetivos", async () => {
    expect((await pancartaObtenerObjetivos({ rol: "estudiante" })).size).toBe(0);
  });

  describe("profesor", () => {
    const profe = { rol: "profesor", encargado_de: [1], jurado_de: [2] };
    test("contexto profesor: ve ambos sombreros", async () => {
      const m = await pancartaObtenerObjetivos(profe);
      expect([...m.keys()]).toEqual([1, 2]);
      expect([...m.get(1)]).toHaveLength(4);
      expect([...m.get(2)]).toEqual(["Sustentación", "Calificación"]);
    });
    test("contexto encargado: solo sus ciclos de encargado", async () => {
      establecerContextoActivo("encargado");
      expect([...(await pancartaObtenerObjetivos(profe)).keys()]).toEqual([1]);
    });
    test("contexto jurado: solo sus ciclos de jurado", async () => {
      establecerContextoActivo("jurado");
      expect([...(await pancartaObtenerObjetivos(profe)).keys()]).toEqual([2]);
    });
    test("si es encargado y jurado del mismo ciclo, junta las etapas", async () => {
      const m = await pancartaObtenerObjetivos({ rol: "profesor", encargado_de: [1], jurado_de: [1] });
      expect(m.get(1).size).toBe(4);
    });
  });

  test("administrador: todos los ciclos que devuelve la API", async () => {
    simularApi({ "GET /ciclos": ok([{ id: 1 }, { id: 2 }]) });
    const m = await pancartaObtenerObjetivos({ rol: "administrador" });
    expect([...m.keys()]).toEqual([1, 2]);
  });
  test("administrador: si la API responde error, sin objetivos", async () => {
    simularApi({ "GET /ciclos": estado(500) });
    expect((await pancartaObtenerObjetivos({ rol: "administrador" })).size).toBe(0);
  });
});

describe("renderizarPancartaFechas", () => {
  test("sin contenedor o sin sesión no hace nada", async () => {
    await expect(renderizarPancartaFechas("fantasma")).resolves.toBeUndefined();
    await renderizarPancartaFechas("pancarta");
    expect(contenido().innerHTML).toBe("");
  });

  test("si no hay ciclo asociado lo explica", async () => {
    iniciarSesionDePrueba({ rol: "Estudiante" });
    await renderizarPancartaFechas("pancarta");
    expect(contenido().textContent).toContain("cuando estés asociado a uno");
  });

  test("si falla obtener los objetivos muestra el error", async () => {
    iniciarSesionDePrueba({ rol: "Administrador" });
    simularApi({ "GET /ciclos": falloDeRed() });
    await renderizarPancartaFechas("pancarta");
    expect(contenido().textContent).toContain("No fue posible cargar las fechas.");
  });

  test("lista primero las habilitadas y luego las próximas; ignora lejanas y etapas ajenas", async () => {
    iniciarSesionDePrueba({ rol: "Estudiante", id_cycle: 3 });
    simularApi({
      "GET /ciclos/3/fechas": ok([
        fila("Registro PGC", "2026-11-20", "2026-12-15"),
        fila("Radicación", "2026-11-01", "2026-11-30"),
        fila("Sustentación", "2027-01-10", "2027-01-20"),
        fila("Calificación", "2026-11-01", "2026-11-30"),
      ]),
    });
    await renderizarPancartaFechas("pancarta");
    const items = contenido().querySelectorAll("li.pancarta");
    expect(items).toHaveLength(2);
    expect(items[0].classList.contains("pancarta-habilitada")).toBe(true);
    expect(items[0].textContent).toContain("Disponible ahora");
    expect(items[1].classList.contains("pancarta-proxima")).toBe(true);
    expect(items[1].textContent).toContain("Próximamente");
    expect(contenido().querySelector("strong")).toBeNull();
  });

  test("si no hay etapas cercanas lo dice", async () => {
    iniciarSesionDePrueba({ rol: "Estudiante", id_cycle: 3 });
    simularApi({ "GET /ciclos/3/fechas": ok([fila("Radicación", "2027-03-01", "2027-03-30")]) });
    await renderizarPancartaFechas("pancarta");
    expect(contenido().textContent).toContain("No hay etapas habilitadas ni próximas");
  });

  test("si todas las consultas fallan lo dice", async () => {
    iniciarSesionDePrueba({ rol: "Estudiante", id_cycle: 3 });
    simularApi({ "GET /ciclos/3/fechas": estado(500) });
    await renderizarPancartaFechas("pancarta");
    expect(contenido().textContent).toContain("No fue posible cargar las fechas del ciclo");
  });

  test("con varios ciclos antepone el nombre (o 'Ciclo N' si no se conoce)", async () => {
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [1, 2] });
    establecerContextoActivo("encargado");
    simularApi({
      "GET /ciclos": ok([{ id: 1, subject_cycle: "Fundamentación" }]),
      "GET /ciclos/1/fechas": ok([fila("Radicación", "2026-11-01", "2026-11-30")]),
      "GET /ciclos/2/fechas": ok([fila("Radicación", "2026-11-01", "2026-11-30")]),
    });
    await renderizarPancartaFechas("pancarta");
    const textos = [...contenido().querySelectorAll("li")].map((li) => li.textContent);
    expect(textos.some((t) => t.includes("Fundamentación."))).toBe(true);
    expect(textos.some((t) => t.includes("Ciclo 2."))).toBe(true);
  });

  test("una consulta fallida entre varias no impide mostrar las demás", async () => {
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [1, 2] });
    establecerContextoActivo("encargado");
    simularApi({
      "GET /ciclos": ok([]),
      "GET /ciclos/1/fechas": ok([fila("Radicación", "2026-11-01", "2026-11-30")]),
      "GET /ciclos/2/fechas": estado(500),
    });
    await renderizarPancartaFechas("pancarta");
    expect(contenido().querySelectorAll("li")).toHaveLength(1);
  });
});
