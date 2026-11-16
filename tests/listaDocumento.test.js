const {
  cargarBase, cargar, simularApi, ok, estado, falloDeRed, simularBootstrap,
  crearArchivo, asignarArchivos, enviarFormulario, esperar,
} = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("components/listaDocumento.js");
});

const DOCS = [
  { id_document: 1, title_file: "Rúbrica A", version_label: "V1.0", desc_file: "Primera", url: "https://x/a.pdf", expira_en_segundos: 600 },
  { id_document: 2, title_file: "Rúbrica B", version_label: "V2", desc_file: "", url: "https://x/b.pdf", expira_en_segundos: 600 },
];

let editable;
let bootstrapMock;
let lista;

function crear(extra = {}) {
  lista = crearListaDocumento({
    idContenedor: "doc",
    idBanner: "banner",
    textoVacio: "Aún no hay documentos.",
    puedeEditar: () => editable,
    rutaLista: () => "/docs",
    rutaSubir: () => "/docs",
    rutaHistorial: (titulo) => `/docs/${encodeURIComponent(titulo)}/historial`,
    ...extra,
  });
  return lista;
}

const $ = (selector) => document.querySelector(selector);
const banner = () => document.getElementById("banner");

beforeEach(() => {
  localStorage.clear();
  editable = false;
  document.body.innerHTML = '<div id="doc"></div><div id="banner" class="hidden"></div>';
  bootstrapMock = simularBootstrap();
});

describe("carga y pintado de la lista", () => {
  test("sin documentos muestra el texto de vacío", async () => {
    simularApi({ "GET /docs": ok([]) });
    await crear().recargar();
    expect($('[data-zona="lista"]').textContent).toContain("Aún no hay documentos.");
  });

  test("una respuesta que no es arreglo se trata como vacía", async () => {
    simularApi({ "GET /docs": ok({ raro: true }) });
    await crear().recargar();
    expect($('[data-zona="lista"]').textContent).toContain("Aún no hay documentos.");
  });

  test("pinta una tarjeta por documento con título, versión, descripción y enlace", async () => {
    simularApi({ "GET /docs": ok(DOCS) });
    await crear().recargar();
    const tarjetas = document.querySelectorAll("[data-doc]");
    expect(tarjetas).toHaveLength(2);
    expect(tarjetas[0].textContent).toContain("Rúbrica A");
    expect(tarjetas[0].textContent).toContain("Versión V1.0");
    expect(tarjetas[0].textContent).toContain("Primera");
    expect(tarjetas[0].querySelector('a[href="https://x/a.pdf"]')).not.toBeNull();
  });

  test("sin permiso no hay botones de edición ni formulario de agregar", async () => {
    simularApi({ "GET /docs": ok(DOCS) });
    await crear().recargar();
    expect($('[data-accion="mostrar-actualizar"]')).toBeNull();
    expect($('[data-accion="mostrar-agregar"]')).toBeNull();
  });

  test("403: avisa que no tiene acceso", async () => {
    simularApi({ "GET /docs": estado(403) });
    await crear().recargar();
    expect($('[data-zona="lista"]').textContent).toContain("No tienes acceso");
  });

  test("error del servidor o de red: avisa que no se pudo cargar", async () => {
    simularApi({ "GET /docs": estado(500) });
    await crear().recargar();
    expect($('[data-zona="lista"]').textContent).toContain("No fue posible cargar los documentos");

    simularApi({ "GET /docs": falloDeRed() });
    await crear().recargar();
    expect($('[data-zona="lista"]').textContent).toContain("No fue posible cargar los documentos");
  });

  test("el HTML de los documentos se escapa", async () => {
    simularApi({ "GET /docs": ok([{ ...DOCS[0], title_file: "<img src=x>" }]) });
    await crear().recargar();
    expect($("[data-doc] img")).toBeNull();
  });
});

describe("formularios (usuario con permiso)", () => {
  beforeEach(() => {
    editable = true;
  });

  test("sugiere la siguiente versión", async () => {
    simularApi({
      "GET /docs": ok([...DOCS, { ...DOCS[0], id_document: 3, version_label: "rara" }]),
    });
    await crear().recargar();
    expect($('form[data-id="1"] [name="version"]').value).toBe("2.0");
    expect($('form[data-id="2"] [name="version"]').value).toBe("3");
    expect($('form[data-id="3"] [name="version"]').value).toBe("1.0");
  });

  test("'Actualizar' muestra el formulario y 'Cancelar' lo oculta devolviendo la versión sugerida", async () => {
    simularApi({ "GET /docs": ok(DOCS) });
    await crear().recargar();
    const form = $('form[data-id="1"]');
    expect(form.classList.contains("hidden")).toBe(true);

    $('[data-accion="mostrar-actualizar"][data-id="1"]').click();
    expect(form.classList.contains("hidden")).toBe(false);

    form.querySelector('[name="version"]').value = "9.9";
    $('[data-accion="cancelar-actualizar"][data-id="1"]').click();
    expect(form.classList.contains("hidden")).toBe(true);
    expect(form.querySelector('[name="version"]').value).toBe("2.0");
    expect($('[data-accion="mostrar-actualizar"][data-id="1"]').classList.contains("hidden")).toBe(false);
  });

  test("'Agregar documento nuevo' abre y cierra su formulario", async () => {
    simularApi({ "GET /docs": ok([]) });
    await crear().recargar();
    const formulario = $('[data-zona="form-agregar"]');
    expect(formulario.classList.contains("hidden")).toBe(true);

    $('[data-accion="mostrar-agregar"]').click();
    expect(formulario.classList.contains("hidden")).toBe(false);

    $('[data-accion="cancelar-agregar"]').click();
    expect(formulario.classList.contains("hidden")).toBe(true);
  });

  describe("validaciones al agregar", () => {
    let form;
    beforeEach(async () => {
      simularApi({ "GET /docs": ok([]) });
      await crear().recargar();
      form = $('form[data-form="agregar"]');
    });

    test("el título es obligatorio", async () => {
      enviarFormulario(form);
      await esperar();
      expect(banner().textContent).toContain("El título es obligatorio.");
    });

    test.each([
      ["", "La versión es obligatoria."],
      ["abc", "La versión debe ser un número"],
    ])("versión %p → error", async (version, mensaje) => {
      form.elements["titulo"].value = "Guía";
      form.elements["version"].value = version;
      enviarFormulario(form);
      await esperar();
      expect(banner().textContent).toContain(mensaje);
      expect(document.activeElement).toBe(form.elements["version"]);
    });

    test.each([
      ["sin archivo", null, "Debes seleccionar el PDF"],
      ["archivo que no es PDF", crearArchivo({ tipo: "image/png" }), "El archivo debe ser un PDF."],
      ["PDF demasiado grande", crearArchivo({ tamanoMB: 11 }), "no debe superar 10 MB"],
    ])("%s", async (_nombre, archivo, mensaje) => {
      form.elements["titulo"].value = "Guía";
      asignarArchivos(form.elements["archivo"], archivo ? [archivo] : []);
      enviarFormulario(form);
      await esperar();
      expect(banner().textContent).toContain(mensaje);
    });
  });

  describe("publicar", () => {
    test("agregar documento nuevo: manda el FormData correcto, avisa y recarga la lista", async () => {
      const fetchMock = simularApi({
        "GET /docs": ok([]),
        "POST /docs": ok({ mensaje: "Publicado." }),
      });
      await crear().recargar();
      const form = $('form[data-form="agregar"]');
      form.elements["titulo"].value = " Guía nueva ";
      form.elements["descripcion"].value = "Detalle";
      form.elements["version"].value = "v2";
      asignarArchivos(form.elements["archivo"], [crearArchivo()]);

      enviarFormulario(form);
      await esperar();

      const envio = fetchMock.llamadas.find((l) => l.metodo === "POST");
      expect(envio.opciones.body.get("title_file")).toBe("Guía nueva");
      expect(envio.opciones.body.get("desc_file")).toBe("Detalle");
      expect(envio.opciones.body.get("version_label")).toBe("V2");
      expect(envio.opciones.body.get("archivo").name).toBe("doc.pdf");
      expect(banner().className).toContain("success");
      expect(banner().textContent).toContain("Publicado.");
      expect(fetchMock.llamadas.filter((l) => l.metodo === "GET")).toHaveLength(2); // carga inicial + recarga
    });

    test("actualizar: el título sale del documento, no del teclado", async () => {
      const fetchMock = simularApi({ "GET /docs": ok(DOCS), "POST /docs": ok() });
      await crear().recargar();
      const form = $('form[data-form="actualizar"][data-id="1"]');
      asignarArchivos(form.elements["archivo"], [crearArchivo()]);

      enviarFormulario(form);
      await esperar();

      const envio = fetchMock.llamadas.find((l) => l.metodo === "POST");
      expect(envio.opciones.body.get("title_file")).toBe("Rúbrica A");
      expect(envio.opciones.body.get("version_label")).toBe("V2.0");
      expect(banner().textContent).toContain("Documento guardado correctamente.");
    });

    test("si el backend rechaza, muestra su mensaje y no recarga", async () => {
      const fetchMock = simularApi({ "GET /docs": ok(DOCS), "POST /docs": estado(409, { mensaje: "Versión repetida." }) });
      await crear().recargar();
      const form = $('form[data-form="actualizar"][data-id="1"]');
      asignarArchivos(form.elements["archivo"], [crearArchivo()]);

      enviarFormulario(form);
      await esperar();

      expect(banner().className).toContain("error");
      expect(banner().textContent).toContain("Versión repetida.");
      expect(fetchMock.llamadas.filter((l) => l.metodo === "GET")).toHaveLength(1);
      expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
    });

    test("rechazo sin mensaje usa el texto genérico", async () => {
      simularApi({ "GET /docs": ok(DOCS), "POST /docs": estado(500) });
      await crear().recargar();
      const form = $('form[data-form="actualizar"][data-id="1"]');
      asignarArchivos(form.elements["archivo"], [crearArchivo()]);
      enviarFormulario(form);
      await esperar();
      expect(banner().textContent).toContain("No fue posible guardar el documento.");
    });

    test("sin conexión avisa que no se pudo conectar", async () => {
      simularApi({ "GET /docs": ok(DOCS), "POST /docs": falloDeRed() });
      await crear().recargar();
      const form = $('form[data-form="actualizar"][data-id="1"]');
      asignarArchivos(form.elements["archivo"], [crearArchivo()]);
      enviarFormulario(form);
      await esperar();
      expect(banner().textContent).toContain("No fue posible conectar con el servidor.");
    });
  });
});

describe("historial de versiones", () => {
  const abrir = async () => {
    await crear().recargar();
    $('[data-accion="historial"][data-id="1"]').click();
    await esperar();
  };
  const cuerpo = () => document.getElementById("doc-modal-historial-cuerpo");

  test("abre el modal y lista las versiones", async () => {
    simularApi({
      "GET /docs": ok(DOCS),
      "GET /docs/R%C3%BAbrica%20A/historial": ok([
        { version_label: "V1.0", uploaded_at: "2026-10-01T10:00:00Z", uploaded_by: "Laura" },
        { version_label: "V0.9", uploaded_at: "fecha-mala", uploaded_by: "Pedro" },
      ]),
    });
    await abrir();
    expect(bootstrapMock.instancias[0].show).toHaveBeenCalled();
    expect(document.getElementById("doc-modal-historial-titulo").textContent).toBe("Historial — Rúbrica A");
    expect(cuerpo().querySelectorAll("li")).toHaveLength(2);
    expect(cuerpo().textContent).toContain("subido por Laura");
  });

  test("sin versiones anteriores", async () => {
    simularApi({ "GET /docs": ok(DOCS), "GET /docs/*": ok([]) });
    await abrir();
    expect(cuerpo().textContent).toContain("Sin versiones anteriores.");
  });

  test("si falla, avisa", async () => {
    simularApi({ "GET /docs": ok(DOCS), "GET /docs/*": estado(500) });
    await abrir();
    expect(cuerpo().textContent).toContain("No fue posible cargar el historial.");
  });
});
