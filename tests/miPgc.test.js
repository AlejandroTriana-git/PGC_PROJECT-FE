const {
  cargarBase, cargar, cargarHtml, simularApi, ok, estado, falloDeRed,
  crearArchivo, asignarArchivos, enviarFormulario, esperar,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("js/miPgc.js");
});

const $ = (id) => document.getElementById(id);

const PGC = { id_pgc: 5, title_proposal: "Mi <PGC>", state_pgc: "En Proceso", id_proposal: 9, name_cycle: "Fundamentación",
  problem_proposal: "Problema", categorias: [{ name_category: "IA" }], integrantes: [{ full_name: "Ana" }] };
const ARCHIVO = { id_file: 1, title_file: "Avance 1", desc_file: "Primer avance", url_file: { url: "https://x/a.pdf", expira_en_segundos: 600 } };
const NOTAS = { nota_global: 4, calificaciones: [{ juror_name: "Jurado <1>", comment: "Muy bien", graded_at: "2026-10-01T10:00:00Z" }] };

const rutasPgc = (extra = {}, pgc = PGC) => ({
  "GET /pgc/mine": ok([{ ...pgc }]), // copia: las pruebas mutan el PGC (p. ej. lo marcan Terminado)
  "GET /pgc/5/files": ok([ARCHIVO]),
  "GET /pgc/5/calificaciones": ok(NOTAS),
  "GET /propuestas/9/pdf": ok({ url: "https://x/p.pdf", expira_en_segundos: 600 }),
  ...extra,
});

beforeEach(() => {
  localStorage.clear();
  cargarHtml("miPgc.html");
  window.pgc_actual = null;
  window.pestana_activa = "resumen";
  window.confirm = jest.fn(() => true);
});

describe("funciones puras", () => {
  test("pgcTerminado mira 'estado' o 'state_pgc'", () => {
    expect(pgcTerminado()).toBe(false);
    window.pgc_actual = { state_pgc: "Terminado" };
    expect(pgcTerminado()).toBe(true);
    window.pgc_actual = { estado: "Terminado", state_pgc: "En Proceso" };
    expect(pgcTerminado()).toBe(true);
    window.pgc_actual = { estado: "En Proceso" };
    expect(pgcTerminado()).toBe(false);
  });

  test("textosCategorias y textosIntegrantes", () => {
    expect(textosCategorias([{ name_category: "IA" }, "Web"])).toEqual(["IA", "Web"]);
    expect(textosCategorias(null)).toEqual([]);
    expect(textosIntegrantes([{ full_name: "Ana" }, "Luis"])).toEqual(["Ana", "Luis"]);
    expect(textosIntegrantes(null)).toEqual([]);
  });

  test.each([
    [null, "Debes seleccionar un archivo."],
    [crearArchivo({ tipo: "text/plain" }), "Formato no permitido"],
    [crearArchivo({ tamanoMB: 11 }), "no debe superar 10 MB"],
    [crearArchivo({ tipo: "image/png" }), null],
    [crearArchivo({ tipo: "application/msword" }), null],
  ])("validarArchivoPgc %#", (archivo, esperado) => {
    const r = validarArchivoPgc(archivo);
    if (esperado === null) expect(r).toBeNull();
    else expect(r).toContain(esperado);
  });

  test("formatearNota", () => {
    expect(formatearNota(4)).toBe("4.0");
    expect(formatearNota("3.5")).toBe("3.5");
    expect(formatearNota(null)).toBe("—");
    expect(formatearNota(undefined)).toBe("—");
    expect(formatearNota("")).toBe("—");
    expect(formatearNota("abc")).toBe("—");
  });

  test("contadorPestana", () => {
    window.pgc_actual = { archivos: [{}, {}], notas: NOTAS };
    expect(contadorPestana("archivos")).toBe("2");
    expect(contadorPestana("calificacion")).toBe("4.0");
    expect(contadorPestana("resumen")).toBe("");
    window.pgc_actual = { archivos: [], notas: null };
    expect(contadorPestana("archivos")).toBe("");
    expect(contadorPestana("calificacion")).toBe("");
  });
});

describe("pintarPgc", () => {
  const pintar = (extra = {}) => {
    window.pgc_actual = { ...PGC, archivos: [ARCHIVO], notas: NOTAS, pdf_propuesta: { url: "https://x/p.pdf", expira_en_segundos: 600 }, ...extra };
    pintarPgc();
  };

  test("cabecera, pestañas con contadores y PDF de la propuesta", () => {
    pintar();
    const c = $("contenedor-pgc");
    expect(c.querySelector("h2").textContent).toBe("Mi <PGC>");
    expect(c.querySelector(".pgc-cabecera").textContent).toContain("Fundamentación");
    expect(c.querySelector(".pgc-cabecera").textContent).toContain("En Proceso");
    expect(c.querySelectorAll("[data-pestana]")).toHaveLength(3);
    expect($("pestana-archivos").textContent).toContain("1");
    expect($("pestana-calificacion").textContent).toContain("4.0");
    expect($("pestana-resumen").classList.contains("active")).toBe(true);
    expect($("pdf-propuesta").querySelector("a").getAttribute("href")).toBe("https://x/p.pdf");
    expect($("form-subir-archivo")).not.toBeNull();
  });

  test("ciclo numérico se muestra como 'Ciclo N'; sin ciclo ni estado no hay chips", () => {
    pintar({ name_cycle: undefined, id_cycle: 2 });
    expect($("contenedor-pgc").querySelector(".pgc-cabecera").textContent).toContain("Ciclo 2");
    pintar({ name_cycle: undefined, id_cycle: undefined, state_pgc: undefined });
    expect($("contenedor-pgc").querySelector(".pgc-cabecera .chip-dato")).toBeNull();
  });

  test("la pestaña activa se recuerda al repintar y al mostrarse otra se actualiza", () => {
    window.pestana_activa = "archivos";
    pintar();
    expect($("pestana-archivos").classList.contains("active")).toBe(true);
    $("pestana-calificacion").dispatchEvent(new Event("shown.bs.tab"));
    expect(window.pestana_activa).toBe("calificacion");
  });

  test("con el PGC terminado no hay formulario de subida y se avisa", () => {
    pintar({ state_pgc: "Terminado" });
    expect($("form-subir-archivo")).toBeNull();
    expect($("contenedor-pgc").textContent).toContain("Tu PGC está terminado");
    expect($("btn-reemplazar-1")).toBeNull();
  });

  test("sin PDF de propuesta muestra 'Sin documento adjunto'", () => {
    pintar({ pdf_propuesta: null });
    expect($("pdf-propuesta").textContent).toContain("Sin documento adjunto");
  });
});

describe("pintarArchivosPgc y sus controles", () => {
  beforeEach(() => {
    window.pgc_actual = { ...PGC, archivos: [ARCHIVO], notas: NOTAS };
    pintarPgc();
  });

  test("sin archivos muestra el mensaje de vacío", () => {
    pintarArchivosPgc([]);
    expect($("lista-archivos-pgc").textContent).toContain("Todavía no has subido evidencias");
    pintarArchivosPgc(undefined);
    expect($("lista-archivos-pgc").textContent).toContain("Todavía no has subido evidencias");
  });

  test("pinta cada archivo con su enlace y botones", () => {
    expect($("fila-archivo-1")).not.toBeNull();
    expect($("enlace-archivo-1").querySelector("a").getAttribute("href")).toBe("https://x/a.pdf");
    expect($("btn-reemplazar-1")).not.toBeNull();
  });

  test("toggleDescripcionArchivo muestra y oculta la descripción", () => {
    expect($("descripcion-archivo-1").classList.contains("hidden")).toBe(true);
    toggleDescripcionArchivo(1);
    expect($("descripcion-archivo-1").classList.contains("hidden")).toBe(false);
    expect($("btn-ver-descripcion-1").getAttribute("aria-expanded")).toBe("true");
    expect($("btn-ver-descripcion-1").textContent).toContain("Ocultar");
    toggleDescripcionArchivo(1);
    expect($("btn-ver-descripcion-1").textContent).toContain("Ver descripción");
    expect(() => toggleDescripcionArchivo(99)).not.toThrow();
  });

  test("toggleFormularioReemplazo abre (foco al título) y cierra (foco al botón)", () => {
    toggleFormularioReemplazo(1, true);
    expect($("form-reemplazo-1").classList.contains("hidden")).toBe(false);
    expect(document.activeElement).toBe($("titulo-reemplazo-1"));
    toggleFormularioReemplazo(1, false);
    expect($("form-reemplazo-1").classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe($("btn-reemplazar-1"));
    expect(() => toggleFormularioReemplazo(99, true)).not.toThrow();
  });
});

describe("pintarCalificaciones", () => {
  const pintarCon = (notas) => {
    window.pgc_actual = { ...PGC, archivos: [], notas };
    pintarPgc();
    return $("seccion-calificaciones");
  };
  test("sin datos de la API", () => {
    expect(pintarCon(null).textContent).toContain("No fue posible cargar las calificaciones");
  });
  test("pendiente de calificación", () => {
    expect(pintarCon({ nota_global: null, calificaciones: [] }).textContent).toContain("Pendiente de calificación");
    expect(pintarCon({ nota_global: null }).textContent).toContain("Pendiente de calificación");
  });
  test("nota global y comentarios (escapados)", () => {
    const s = pintarCon(NOTAS);
    expect(s.querySelector(".nota-valor").textContent).toContain("4.0");
    expect(s.textContent).toContain("Jurado <1>");
    expect(s.textContent).toContain("Muy bien");
    expect(s.textContent).toContain("Calificado el");
  });
  test("una fecha ilegible no rompe la lista", () => {
    const s = pintarCon({ nota_global: 3, calificaciones: [{ juror_name: "J", comment: "ok", graded_at: "xx" }] });
    expect(s.textContent).not.toContain("Calificado el");
  });
  test("sin contenedor no hace nada", () => {
    window.pgc_actual = { ...PGC, notas: NOTAS };
    document.body.innerHTML = "";
    expect(() => pintarCalificaciones()).not.toThrow();
  });
});

describe("inicializarMiPgc", () => {
  test("error al cargar", async () => {
    simularApi({ "GET /pgc/mine": estado(500) });
    await inicializarMiPgc();
    expect($("contenedor-pgc").textContent).toContain("No fue posible cargar tu PGC");
    simularApi({ "GET /pgc/mine": falloDeRed() });
    await inicializarMiPgc();
    expect($("contenedor-pgc").textContent).toContain("No fue posible cargar tu PGC");
  });
  test("sin PGC registrado", async () => {
    simularApi({ "GET /pgc/mine": ok([]) });
    await inicializarMiPgc();
    expect($("contenedor-pgc").textContent).toContain("Todavía no has registrado ningún PGC.");
    simularApi({ "GET /pgc/mine": ok({}) });
    await inicializarMiPgc();
    expect($("contenedor-pgc").textContent).toContain("Todavía no has registrado ningún PGC.");
  });
  test("carga archivos, calificaciones y PDF en paralelo y pinta la pantalla", async () => {
    const fetchMock = simularApi(rutasPgc());
    await inicializarMiPgc();
    expect(fetchMock.llamadas.map((l) => l.ruta).sort()).toEqual(
      ["/pgc/5/calificaciones", "/pgc/5/files", "/pgc/mine", "/propuestas/9/pdf"]
    );
    expect($("contenedor-pgc").querySelector("h2").textContent).toBe("Mi <PGC>");
    expect($("fila-archivo-1")).not.toBeNull();
  });
  test("si fallan las rutas secundarias igual pinta, con cada sección en su estado de error", async () => {
    simularApi(rutasPgc({ "GET /pgc/5/files": estado(500), "GET /pgc/5/calificaciones": falloDeRed(), "GET /propuestas/9/pdf": estado(404) }));
    await inicializarMiPgc();
    expect($("lista-archivos-pgc").textContent).toContain("Todavía no has subido evidencias");
    expect($("seccion-calificaciones").textContent).toContain("No fue posible cargar las calificaciones");
    expect($("pdf-propuesta").textContent).toContain("Sin documento adjunto");
  });
  test("sin id_proposal no pide el PDF", async () => {
    const fetchMock = simularApi(rutasPgc({}, { ...PGC, id_proposal: undefined }));
    await inicializarMiPgc();
    expect(fetchMock.llamadas.some((l) => l.ruta.includes("/propuestas/"))).toBe(false);
  });
});

describe("subirArchivoPgc", () => {
  const llenar = (archivo = crearArchivo()) => {
    $("titulo-archivo").value = " Avance 2 ";
    $("descripcion-archivo").value = "Segundo avance";
    asignarArchivos($("archivo-pgc"), archivo ? [archivo] : []);
  };
  const enviar = async () => {
    enviarFormulario($("form-subir-archivo"));
    await esperar();
  };

  test("campos vacíos o archivo inválido: no envía", async () => {
    const fetchMock = simularApi(rutasPgc());
    await inicializarMiPgc();
    await enviar();
    expect($("banner-archivo").textContent).toContain("El título es obligatorio.");
    expect($("banner-archivo").textContent).toContain("Debes seleccionar un archivo.");

    llenar(crearArchivo({ tipo: "text/plain" }));
    await enviar();
    expect($("banner-archivo").textContent).toContain("Formato no permitido");
    expect(fetchMock.llamadas.some((l) => l.metodo === "POST")).toBe(false);
  });

  test("subida correcta: manda el FormData, recarga y avisa", async () => {
    const fetchMock = simularApi(rutasPgc({ "POST /pgc/5/files": ok({ mensaje: "Subido." }) }));
    await inicializarMiPgc();
    llenar();
    await enviar();
    const post = fetchMock.llamadas.find((l) => l.metodo === "POST");
    expect(post.opciones.body.get("title_file")).toBe("Avance 2");
    expect(post.opciones.body.get("desc_file")).toBe("Segundo avance");
    expect(post.opciones.body.get("archivo").name).toBe("doc.pdf");
    expect($("banner-archivo").className).toContain("success");
    expect($("banner-archivo").textContent).toContain("Subido.");
    expect(fetchMock.llamadas.filter((l) => l.ruta === "/pgc/mine")).toHaveLength(2);
  });

  test("subida correcta sin mensaje del backend", async () => {
    simularApi(rutasPgc({ "POST /pgc/5/files": ok({}) }));
    await inicializarMiPgc();
    llenar();
    await enviar();
    expect($("banner-archivo").textContent).toContain("Archivo subido correctamente.");
  });

  test("errores del backend y de red", async () => {
    simularApi(rutasPgc({ "POST /pgc/5/files": estado(400, { mensaje: "Archivo repetido." }) }));
    await inicializarMiPgc();
    llenar();
    await enviar();
    expect($("banner-archivo").textContent).toContain("Archivo repetido.");
    expect($("btn-subir-archivo").disabled).toBe(false);

    simularApi({ "POST /pgc/5/files": estado(500) });
    await enviar();
    expect($("banner-archivo").textContent).toContain("No fue posible subir el archivo.");

    simularApi({ "POST /pgc/5/files": falloDeRed() });
    await enviar();
    expect($("banner-archivo").textContent).toContain("No fue posible conectar con el servidor.");
  });

  test("con el PGC terminado no sube nada", async () => {
    simularApi(rutasPgc());
    await inicializarMiPgc();
    window.pgc_actual.state_pgc = "Terminado";
    await subirArchivoPgc({ preventDefault() {} });
    expect($("banner-archivo").textContent).toContain("ya está terminado");
  });
});

describe("reemplazarArchivoPgc", () => {
  beforeEach(async () => {
    simularApi(rutasPgc({ "PUT /pgc/5/files/1": ok({ mensaje: "Reemplazado." }) }));
    await inicializarMiPgc();
  });

  test("con el PGC terminado no hace nada", async () => {
    window.pgc_actual.state_pgc = "Terminado";
    const fetchMock = simularApi();
    await reemplazarArchivoPgc(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("título vacío o archivo nuevo inválido: no envía", async () => {
    const fetchMock = simularApi();
    $("titulo-reemplazo-1").value = "";
    await reemplazarArchivoPgc(1);
    expect($("banner-archivo").textContent).toContain("El título es obligatorio.");

    $("titulo-reemplazo-1").value = "Nuevo";
    asignarArchivos($("archivo-reemplazo-1"), [crearArchivo({ tipo: "text/plain" })]);
    await reemplazarArchivoPgc(1);
    expect($("banner-archivo").textContent).toContain("Formato no permitido");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("solo título y descripción (sin archivo nuevo)", async () => {
    const fetchMock = simularApi(rutasPgc({ "PUT /pgc/5/files/1": ok({ mensaje: "Reemplazado." }) }));
    $("titulo-reemplazo-1").value = "Título corregido";
    await reemplazarArchivoPgc(1);
    const put = fetchMock.llamadas.find((l) => l.metodo === "PUT");
    expect(put.opciones.body.get("title_file")).toBe("Título corregido");
    expect(put.opciones.body.has("archivo")).toBe(false);
    expect($("banner-archivo").textContent).toContain("Reemplazado.");
  });

  test("con archivo nuevo lo adjunta", async () => {
    const fetchMock = simularApi(rutasPgc({ "PUT /pgc/5/files/1": ok({}) }));
    asignarArchivos($("archivo-reemplazo-1"), [crearArchivo()]);
    await reemplazarArchivoPgc(1);
    const put = fetchMock.llamadas.find((l) => l.metodo === "PUT");
    expect(put.opciones.body.get("archivo").name).toBe("doc.pdf");
    expect($("banner-archivo").textContent).toContain("Archivo reemplazado correctamente.");
  });

  test("errores del backend y de red reactivan los botones", async () => {
    simularApi({ "PUT /pgc/5/files/1": estado(400, { mensaje: "No permitido." }) });
    await reemplazarArchivoPgc(1);
    expect($("banner-archivo").textContent).toContain("No permitido.");
    expect($("fila-archivo-1").querySelector("form button").disabled).toBe(false);

    simularApi({ "PUT /pgc/5/files/1": estado(500) });
    await reemplazarArchivoPgc(1);
    expect($("banner-archivo").textContent).toContain("No fue posible reemplazar el archivo.");

    simularApi({ "PUT /pgc/5/files/1": falloDeRed() });
    await reemplazarArchivoPgc(1);
    expect($("banner-archivo").textContent).toContain("No fue posible conectar con el servidor.");
    expect($("fila-archivo-1").querySelector("form button").disabled).toBe(false);
  });
});

describe("eliminarArchivoPgc", () => {
  beforeEach(async () => {
    simularApi(rutasPgc());
    await inicializarMiPgc();
  });

  test("con el PGC terminado no hace nada", async () => {
    window.pgc_actual.state_pgc = "Terminado";
    await eliminarArchivoPgc(1);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  test("si el usuario cancela la confirmación no elimina", async () => {
    window.confirm = jest.fn(() => false);
    const fetchMock = simularApi();
    await eliminarArchivoPgc(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("elimina (204), recarga y avisa", async () => {
    const fetchMock = simularApi(rutasPgc({ "DELETE /pgc/5/files/1": estado(204) }));
    await eliminarArchivoPgc(1);
    expect(fetchMock.llamadas.some((l) => l.metodo === "DELETE" && l.ruta === "/pgc/5/files/1")).toBe(true);
    expect($("banner-archivo").textContent).toContain("Archivo eliminado correctamente.");
  });

  test("errores del backend y de red", async () => {
    simularApi({ "DELETE /pgc/5/files/1": estado(403, { mensaje: "No puedes eliminar." }) });
    await eliminarArchivoPgc(1);
    expect($("banner-archivo").textContent).toContain("No puedes eliminar.");

    simularApi({ "DELETE /pgc/5/files/1": estado(500) });
    await eliminarArchivoPgc(1);
    expect($("banner-archivo").textContent).toContain("No fue posible eliminar el archivo.");

    simularApi({ "DELETE /pgc/5/files/1": falloDeRed() });
    await eliminarArchivoPgc(1);
    expect($("banner-archivo").textContent).toContain("No fue posible conectar con el servidor.");
    expect($("fila-archivo-1").querySelector("button").disabled).toBe(false);
  });
});
