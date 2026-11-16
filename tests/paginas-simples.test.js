// calificado.js, lineamiento.js, rubrica.js, reportes.js, usuarios.js
const {
  cargarBase, cargar, cargarHtml, simularBootstrap, iniciarSesionDePrueba,
  simularApi, ok, estado, falloDeRed, esperar,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("components/listaDocumento.js", "js/calificado.js", "js/lineamiento.js", "js/rubrica.js", "js/reportes.js", "js/usuarios.js");
});

const $ = (id) => document.getElementById(id);

beforeEach(() => {
  localStorage.clear();
  simularBootstrap();
});

describe("calificado.js", () => {
  beforeEach(() => {
    cargarHtml("calificado.html");
    window.pgc_calificados = [];
  });

  test("formatearNotaCalificado", () => {
    expect(formatearNotaCalificado(4)).toBe("4.0");
    expect(formatearNotaCalificado("3.5")).toBe("3.5");
    expect(formatearNotaCalificado("abc")).toBe("—");
    expect(formatearNotaCalificado(undefined)).toBe("—");
  });

  test("formatearFechaCalificado", () => {
    expect(formatearFechaCalificado("")).toBe("");
    expect(formatearFechaCalificado("no-es-fecha")).toBe("");
    expect(formatearFechaCalificado("2026-10-12 08:30:00")).toMatch(/2026/);
  });

  test("pintarTablaCalificados sin datos", () => {
    pintarTablaCalificados();
    expect($("tabla-calificados").textContent).toContain("Todavía no has calificado ningún PGC.");
  });

  test("pintarTablaCalificados con datos: enlace a la ficha, nota y comentario", () => {
    window.pgc_calificados = [
      { id_pgc: 7, title_proposal: "Proyecto <X>", leader_name: "Ana", name_cycle: "Fundamentación", grade: 4.5, comment: "Muy bien", graded_at: "2026-10-12 08:30:00" },
      { id_pgc: 8, title_proposal: "Sin extras", id_cycle: 2, grade: "x" },
    ];
    pintarTablaCalificados();
    const filas = $("tabla-calificados").querySelectorAll("tr");
    expect(filas).toHaveLength(2);
    expect(filas[0].querySelector("a").getAttribute("href")).toBe("fichaPgc.html?id=7");
    expect(filas[0].textContent).toContain("Proyecto <X>");
    expect(filas[0].textContent).toContain("4.5 / 5.0");
    expect(filas[0].textContent).toContain("Muy bien");
    expect(filas[0].textContent).toContain("Calificado el");
    // fila con datos faltantes
    expect(filas[1].textContent).toContain("— / 5.0");
    expect(filas[1].textContent).not.toContain("Calificado el");
    expect(filas[1].querySelectorAll("td")[1].textContent).toBe("—");
    expect(filas[1].querySelectorAll("td")[2].textContent).toBe("2");
  });

  test("inicializarCalificados carga y pinta la lista", async () => {
    simularApi({ "GET /pgc/calificados-por-mi": ok([{ id_pgc: 1, title_proposal: "T", grade: 5 }]) });
    await inicializarCalificados();
    expect($("tabla-calificados").textContent).toContain("5.0 / 5.0");
  });

  test("si la respuesta no es un arreglo queda vacía", async () => {
    simularApi({ "GET /pgc/calificados-por-mi": ok({}) });
    await inicializarCalificados();
    expect($("tabla-calificados").textContent).toContain("Todavía no has calificado");
  });

  test("si falla (HTTP o red) muestra el error", async () => {
    simularApi({ "GET /pgc/calificados-por-mi": estado(500) });
    await inicializarCalificados();
    expect($("banner").textContent).toContain("No fue posible cargar los PGC calificados");

    simularApi({ "GET /pgc/calificados-por-mi": falloDeRed() });
    await inicializarCalificados();
    expect($("banner").textContent).toContain("No fue posible cargar los PGC calificados");
  });
});

describe("lineamiento.js", () => {
  beforeEach(() => cargarHtml("lineamiento.html"));

  test("carga los lineamientos; el administrador puede agregar documentos", async () => {
    iniciarSesionDePrueba({ rol: "Administrador" });
    const fetchMock = simularApi({ "GET /lineamientos": ok([{ id_document: 1, title_file: "Guía", version_label: "V1", url: "https://x/g.pdf", expira_en_segundos: 600 }]) });
    inicializarLineamiento();
    await esperar();
    expect(fetchMock.llamadas[0].ruta).toBe("/lineamientos");
    expect(document.querySelector("[data-doc]").textContent).toContain("Guía");
    expect(document.querySelector('[data-accion="mostrar-agregar"]')).not.toBeNull();
  });

  test("un estudiante solo puede leer", async () => {
    iniciarSesionDePrueba({ rol: "Estudiante" });
    simularApi({ "GET /lineamientos": ok([]) });
    inicializarLineamiento();
    await esperar();
    expect(document.querySelector('[data-accion="mostrar-agregar"]')).toBeNull();
    expect(document.body.textContent).toContain("Todavía no hay lineamientos publicados.");
  });
});

describe("rubrica.js", () => {
  beforeEach(() => {
    cargarHtml("rubrica.html");
    window.ciclo_actual = null;
    window.lista_rubrica = null;
  });

  describe("obtenerCiclosConsultables", () => {
    test("estudiante: su ciclo, o ninguno", () => {
      expect(obtenerCiclosConsultables({ rol: "estudiante", id_cycle: 4 })).toEqual([4]);
      expect(obtenerCiclosConsultables({ rol: "estudiante" })).toEqual([]);
    });
    test("profesor: depende del contexto activo", () => {
      const profe = { rol: "profesor", encargado_de: [1], jurado_de: [2, 3] };
      expect(obtenerCiclosConsultables(profe)).toEqual([1]);
      establecerContextoActivo("jurado");
      expect(obtenerCiclosConsultables(profe)).toEqual([2, 3]);
    });
    test("otros roles: ninguno", () => {
      expect(obtenerCiclosConsultables({ rol: "administrador" })).toEqual([]);
    });
  });

  describe("puedeEditarRubrica", () => {
    const profe = { rol: "profesor", encargado_de: [1] };
    test("solo el encargado de ese ciclo, en su contexto de encargado", () => {
      window.ciclo_actual = 1;
      establecerContextoActivo("encargado");
      expect(puedeEditarRubrica(profe)).toBe(true);
    });
    test("no en otro contexto, otro ciclo u otro rol", () => {
      window.ciclo_actual = 1;
      expect(puedeEditarRubrica(profe)).toBe(false); // contexto profesor
      establecerContextoActivo("encargado");
      window.ciclo_actual = 2;
      expect(puedeEditarRubrica(profe)).toBe(false);
      window.ciclo_actual = 1;
      expect(puedeEditarRubrica({ rol: "estudiante", encargado_de: [1] })).toBe(false);
    });
  });

  test("obtenerNombresCiclo: mapa o {} si falla", async () => {
    simularApi({ "GET /ciclos": ok([{ id: 1, subject_cycle: "Fundamentación" }]) });
    expect(await obtenerNombresCiclo()).toEqual({ 1: "Fundamentación" });
    simularApi({ "GET /ciclos": estado(500) });
    expect(await obtenerNombresCiclo()).toEqual({});
    simularApi({ "GET /ciclos": falloDeRed() });
    expect(await obtenerNombresCiclo()).toEqual({});
  });

  describe("pintarSelectorCiclo", () => {
    test("un solo ciclo: lo muestra como título", async () => {
      simularApi({ "GET /ciclos": ok([{ id: 1, subject_cycle: "Fundamentación" }]) });
      await pintarSelectorCiclo([1]);
      expect($("zona-ciclo").querySelector("strong").textContent).toBe("Fundamentación");
    });

    test("varios ciclos: selector; al cambiar actualiza el ciclo y recarga la lista", async () => {
      simularApi({ "GET /ciclos": ok([{ id: 1, subject_cycle: "Fundamentación" }]) });
      window.lista_rubrica = { recargar: jest.fn() };
      await pintarSelectorCiclo([1, 2]);
      const selector = $("selector-ciclo");
      expect([...selector.options].map((o) => o.textContent)).toEqual(["Fundamentación", "Ciclo 2"]);

      selector.value = "2";
      selector.dispatchEvent(new Event("change"));
      expect(window.ciclo_actual).toBe(2);
      expect(window.lista_rubrica.recargar).toHaveBeenCalled();
    });
  });

  describe("inicializarRubrica", () => {
    test("sin ciclos asignados lo explica", () => {
      iniciarSesionDePrueba({ rol: "Estudiante" });
      inicializarRubrica();
      expect($("contenedor-documento").textContent).toContain("No tienes un ciclo asignado");
    });

    test("estudiante: pide las rúbricas de su ciclo, solo lectura", async () => {
      iniciarSesionDePrueba({ rol: "Estudiante", id_cycle: 4 });
      const fetchMock = simularApi({
        "GET /ciclos/4/documentos*": ok([]),
        "GET /ciclos": ok([{ id: 4, subject_cycle: "Transición" }]),
      });
      inicializarRubrica();
      await esperar();
      expect(fetchMock.llamadas.some((l) => l.ruta === "/ciclos/4/documentos?tipo=R%C3%BAbrica")).toBe(true);
      expect($("zona-ciclo").textContent).toContain("Transición");
      expect(document.querySelector('[data-accion="mostrar-agregar"]')).toBeNull();
    });

    test("encargado del ciclo: puede agregar rúbricas", async () => {
      iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [4] });
      establecerContextoActivo("encargado");
      simularApi({ "GET /ciclos/4/documentos*": ok([]), "GET /ciclos": ok([]) });
      inicializarRubrica();
      await esperar();
      expect(document.querySelector('[data-accion="mostrar-agregar"]')).not.toBeNull();
      expect($("zona-ciclo").textContent).toContain("Ciclo 4");
    });
  });
});

describe("scripts vacíos (reportes.js, usuarios.js)", () => {
  test("se cargan sin errores", () => {
    expect(() => cargar("js/reportes.js", "js/usuarios.js")).not.toThrow();
  });
});
