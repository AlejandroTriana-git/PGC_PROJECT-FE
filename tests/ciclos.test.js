const {
  cargarBase, cargar, cargarHtml, simularBootstrap, simularApi, ok, estado, falloDeRed, esperar,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("js/ciclos.js");
});

const PROFES = [{ id: 1, nombre: "Ana" }, { id: 2, nombre: "Beto" }];
const CICLO = { id: 10, subject_cycle: "Fundamentación", max_members: 3, id_encargado: 1, jurados: [2] };
const $ = (id) => document.getElementById(id);

let modal;
beforeEach(() => {
  localStorage.clear();
  cargarHtml("ciclos.html");
  simularBootstrap();
  modal = { show: jest.fn(), hide: jest.fn() };
  window.modalCiclo = modal;
  window.profesores = PROFES;
  window.ciclos = [{ ...CICLO }];
  window.cicloSeleccionado = null;
});

describe("helpers", () => {
  test("nombreProfesor devuelve el nombre o 'Sin asignar'", () => {
    expect(nombreProfesor(1)).toBe("Ana");
    expect(nombreProfesor(99)).toBe("Sin asignar");
  });
  test("nombreCiclo usa subject_cycle o 'Ciclo N'", () => {
    expect(nombreCiclo({ id: 3, subject_cycle: "Transición" })).toBe("Transición");
    expect(nombreCiclo({ id: 3 })).toBe("Ciclo 3");
  });
});

describe("pintarTablaCiclos", () => {
  test("sin ciclos muestra el mensaje de vacío", () => {
    window.ciclos = [];
    pintarTablaCiclos();
    expect($("tabla-ciclos").textContent).toContain("No hay ciclos disponibles.");
  });
  test("una fila por ciclo con encargado y jurados", () => {
    pintarTablaCiclos();
    const celdas = $("tabla-ciclos").querySelectorAll("td");
    expect(celdas[0].textContent).toBe("Fundamentación");
    expect(celdas[1].textContent).toBe("3");
    expect(celdas[2].textContent).toBe("Ana");
    expect(celdas[3].textContent).toBe("Beto");
  });
  test("sin jurados muestra 'Sin asignar'", () => {
    window.ciclos = [{ ...CICLO, jurados: [] }];
    pintarTablaCiclos();
    expect($("tabla-ciclos").querySelectorAll("td")[3].textContent).toBe("Sin asignar");
  });
});

describe("abrirEdicionCiclo", () => {
  test("un id inexistente no abre nada", () => {
    abrirEdicionCiclo(999);
    expect(modal.show).not.toHaveBeenCalled();
  });
  test("carga el formulario con los datos del ciclo", () => {
    abrirEdicionCiclo(10);
    expect($("ciclo-titulo").textContent).toBe("Fundamentación");
    expect($("input-max-integrantes").value).toBe("3");
    expect($("select-encargado").value).toBe("1");
    expect($("jurado-2").checked).toBe(true);
    expect($("jurado-1").checked).toBe(false);
    expect(modal.show).toHaveBeenCalled();
  });
  test("un ciclo sin jurados deja todas las casillas libres", () => {
    window.ciclos = [{ ...CICLO, jurados: undefined }];
    abrirEdicionCiclo(10);
    expect($("jurado-1").checked).toBe(false);
    expect($("jurado-2").checked).toBe(false);
  });
});

describe("cargarJuradosDeCiclos", () => {
  test("guarda los jurados de cada ciclo; si falla uno, ese queda vacío", async () => {
    window.ciclos = [{ id: 1 }, { id: 2 }, { id: 3 }];
    simularApi({
      "GET /ciclos/1/jurados": ok([5, 6]),
      "GET /ciclos/2/jurados": estado(500),
      "GET /ciclos/3/jurados": falloDeRed(),
    });
    await cargarJuradosDeCiclos();
    expect(window.ciclos.map((c) => c.jurados)).toEqual([[5, 6], [], []]);
  });
});

describe("inicializarCiclos", () => {
  const rutasBase = (extra = {}) => ({
    "GET /ciclos/profesores": ok(PROFES),
    "GET /ciclos/10/jurados": ok([2]),
    ...extra,
    "GET /ciclos": ok([{ id: 10, subject_cycle: "Fundamentación", max_members: 3, id_encargado: 1 }]),
  });

  test("carga profesores, ciclos y jurados y pinta la tabla", async () => {
    simularApi(rutasBase());
    await inicializarCiclos();
    expect($("tabla-ciclos").textContent).toContain("Fundamentación");
    expect(window.ciclos[0].jurados).toEqual([2]);
  });

  test.each([
    ["profesores", { "GET /ciclos/profesores": estado(500) }],
    ["ciclos", { "GET /ciclos": estado(500) }],
  ])("si falla %s muestra el error", async (_nombre, fallo) => {
    simularApi({ ...rutasBase(), ...fallo });
    window.ciclos = [];
    await inicializarCiclos();
    expect($("banner").textContent).toContain("No fue posible cargar los datos");
  });

  describe("guardar cambios", () => {
    async function abrirYGuardar({ jurados = ["jurado-1"], max = "4", encargado = "2", rutas = {} } = {}) {
      const fetchMock = simularApi(rutasBase(rutas));
      await inicializarCiclos();
      abrirEdicionCiclo(10);
      $("input-max-integrantes").value = max;
      $("select-encargado").value = encargado;
      ["jurado-1", "jurado-2"].forEach((id) => ($(id).checked = jurados.includes(id)));
      $("btn-guardar-ciclo").click();
      await esperar();
      return fetchMock;
    }

    test("PUT del ciclo, POST de jurados nuevos y DELETE de los quitados", async () => {
      const fetchMock = await abrirYGuardar({
        rutas: {
          "PUT /ciclos/10": ok({}),
          "POST /ciclos/10/jurados": ok({}),
          "DELETE /ciclos/10/jurados/2": ok({}),
        },
      });
      const put = fetchMock.llamadas.find((l) => l.metodo === "PUT");
      expect(JSON.parse(put.opciones.body)).toEqual({ subject_cycle: "Fundamentación", max_members: 4, id_encargado: 2 });
      const post = fetchMock.llamadas.find((l) => l.metodo === "POST");
      expect(JSON.parse(post.opciones.body)).toEqual({ id_jurados: [1] });
      expect(fetchMock.llamadas.some((l) => l.metodo === "DELETE" && l.ruta === "/ciclos/10/jurados/2")).toBe(true);
      expect($("banner").className).toContain("success");
      expect($("banner").textContent).toContain("Fundamentación actualizado.");
      expect(window.ciclos[0]).toMatchObject({ max_members: 4, id_encargado: 2, jurados: [1] });
      expect(global.bootstrap.instancias[0].hide).toHaveBeenCalled();
      expect($("btn-guardar-ciclo").disabled).toBe(false);
    });

    test("si no queda ningún jurado marcado no hace POST", async () => {
      const fetchMock = await abrirYGuardar({
        jurados: [],
        rutas: { "PUT /ciclos/10": ok({}), "DELETE /ciclos/10/jurados/2": ok({}) },
      });
      expect(fetchMock.llamadas.some((l) => l.metodo === "POST")).toBe(false);
    });

    test("si el servidor devuelve el ciclo actualizado, se usa ese dato", async () => {
      await abrirYGuardar({
        rutas: {
          "PUT /ciclos/10": ok({ id: 10, subject_cycle: "Fundamentación", max_members: 4, id_encargado: 2 }),
          "POST /ciclos/10/jurados": ok({}),
          "DELETE /ciclos/10/jurados/2": ok({}),
        },
      });
      expect(window.ciclos[0].max_members).toBe(4);
    });

    test("falla el PUT: muestra el mensaje y no sigue", async () => {
      const fetchMock = await abrirYGuardar({ rutas: { "PUT /ciclos/10": estado(400, { mensaje: "Máximo inválido." }) } });
      expect($("banner").textContent).toContain("Máximo inválido.");
      expect(fetchMock.llamadas.some((l) => l.metodo === "POST")).toBe(false);
      expect(global.bootstrap.instancias[0].hide).not.toHaveBeenCalled();
    });

    test("falla el PUT sin mensaje: texto genérico", async () => {
      await abrirYGuardar({ rutas: { "PUT /ciclos/10": estado(500) } });
      expect($("banner").textContent).toContain("No fue posible guardar los cambios del ciclo.");
    });

    test("falla la asignación de jurados", async () => {
      await abrirYGuardar({ rutas: { "PUT /ciclos/10": ok({}), "POST /ciclos/10/jurados": estado(500) } });
      expect($("banner").textContent).toContain("no se pudieron asignar los jurados");
    });

    test("falla al quitar un jurado", async () => {
      await abrirYGuardar({
        rutas: { "PUT /ciclos/10": ok({}), "POST /ciclos/10/jurados": ok({}), "DELETE /ciclos/10/jurados/2": estado(500) },
      });
      expect($("banner").textContent).toContain("no se pudo quitar un jurado");
    });

    test("sin conexión", async () => {
      await abrirYGuardar({ rutas: { "PUT /ciclos/10": falloDeRed() } });
      expect($("banner").textContent).toContain("No fue posible conectar con el servidor.");
    });
  });
});
