const { cargarBase, crearToken, simularApi, ok, estado, simularUbicacion } = require("./helpers/entorno");

beforeAll(() => cargarBase());
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
});

describe("escaparHtml", () => {
  test("escapa los cinco caracteres peligrosos", () => {
    expect(escaparHtml(`<b class="x">'A' & B</b>`)).toBe("&lt;b class=&quot;x&quot;&gt;&#39;A&#39; &amp; B&lt;/b&gt;");
  });
  test("null y undefined devuelven cadena vacía", () => {
    expect(escaparHtml(null)).toBe("");
    expect(escaparHtml(undefined)).toBe("");
  });
  test("convierte números a texto y respeta el 0", () => {
    expect(escaparHtml(42)).toBe("42");
    expect(escaparHtml(0)).toBe("0");
  });
});

describe("mostrarBanner / ocultarBanner", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="banner" class="hidden"></div>';
  });

  test("no falla si el contenedor no existe", () => {
    expect(() => mostrarBanner("no-existe", "error", "x")).not.toThrow();
    expect(() => ocultarBanner("no-existe")).not.toThrow();
  });

  test("error: clase, rol alert, icono y mensaje", () => {
    mostrarBanner("banner", "error", "Algo falló");
    const banner = document.getElementById("banner");
    expect(banner.className).toBe("banner error");
    expect(banner.getAttribute("role")).toBe("alert");
    expect(banner.querySelector("svg")).not.toBeNull();
    expect(banner.textContent).toContain("Algo falló");
  });

  test("éxito: rol status", () => {
    mostrarBanner("banner", "success", "Listo");
    const banner = document.getElementById("banner");
    expect(banner.className).toBe("banner success");
    expect(banner.getAttribute("role")).toBe("status");
  });

  test("el mensaje se inserta como texto, no como HTML", () => {
    mostrarBanner("banner", "error", "<img src=x onerror=alert(1)>");
    const banner = document.getElementById("banner");
    expect(banner.querySelector("img")).toBeNull();
    expect(banner.textContent).toContain("<img");
  });

  test("agrega un enlace cuando se pide", () => {
    mostrarBanner("banner", "success", "Guardado.", { texto: "Ver", href: "ficha.html" });
    const enlace = document.querySelector("#banner a");
    expect(enlace.textContent).toBe("Ver");
    expect(enlace.getAttribute("href")).toBe("ficha.html");
  });

  test("ocultarBanner agrega la clase hidden", () => {
    mostrarBanner("banner", "error", "x");
    ocultarBanner("banner");
    expect(document.getElementById("banner").classList.contains("hidden")).toBe(true);
  });
});

describe("decodificarJWT", () => {
  test("lee el payload de un token válido", () => {
    const token = crearToken({ id: 7, rol: "Profesor" });
    expect(decodificarJWT(token)).toMatchObject({ id: 7, rol: "Profesor" });
  });
  test("soporta tildes y eñes", () => {
    expect(decodificarJWT(crearToken({ nombre: "José Ñandú" })).nombre).toBe("José Ñandú");
  });
  test("devuelve null con un token mal formado", () => {
    expect(decodificarJWT("basura")).toBeNull();
    expect(decodificarJWT("a.%%%.c")).toBeNull();
    expect(decodificarJWT(undefined)).toBeNull();
  });
});

describe("peticionApi", () => {
  test("agrega el token y el Content-Type JSON", async () => {
    localStorage.setItem("pgc_token", "TOKEN123");
    const fetchMock = simularApi({ "GET /ciclos": ok([]) });
    const res = await peticionApi("/ciclos");
    expect(res.ok).toBe(true);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe(`${URL_API}/ciclos`);
    expect(opciones.headers.Authorization).toBe("Bearer TOKEN123");
    expect(opciones.headers["Content-Type"]).toBe("application/json");
  });

  test("sin sesión no manda Authorization", async () => {
    const fetchMock = simularApi({ "GET /ciclos": ok([]) });
    await peticionApi("/ciclos");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  test("con FormData no fija Content-Type", async () => {
    const fetchMock = simularApi({ "POST /archivos": ok() });
    await peticionApi("/archivos", { method: "POST", body: new FormData() });
    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
  });

  test("respeta los headers que se le pasan", async () => {
    const fetchMock = simularApi({ "GET /x": ok() });
    await peticionApi("/x", { headers: { "X-Prueba": "1" } });
    expect(fetchMock.mock.calls[0][1].headers["X-Prueba"]).toBe("1");
  });

  test("un 401 con sesión cierra la sesión y lanza error", async () => {
    const ubicacion = simularUbicacion();
    localStorage.setItem("pgc_token", "TOKEN123");
    simularApi({ "GET /privado": estado(401) });
    await expect(peticionApi("/privado")).rejects.toThrow("No autenticado");
    expect(localStorage.getItem("pgc_token")).toBeNull();
    expect(ubicacion.href).toContain("index.html?msg=");
  });

  test("un 401 sin sesión (visitante) no expulsa a nadie", async () => {
    const ubicacion = simularUbicacion();
    simularApi({ "GET /publico": estado(401) });
    const res = await peticionApi("/publico");
    expect(res.status).toBe(401);
    expect(ubicacion.href).toBe("http://localhost/");
  });
});

describe("renderEnlacePdf", () => {
  let contenedor;
  beforeEach(() => {
    contenedor = document.createElement("div");
  });

  test("sin contenedor no hace nada", () => {
    expect(() => renderEnlacePdf(null, { url: "x" })).not.toThrow();
  });
  test("sin pdf muestra 'Sin documento adjunto'", () => {
    renderEnlacePdf(contenedor, null);
    expect(contenedor.textContent).toContain("Sin documento adjunto");
  });
  test("enlace expirado", () => {
    renderEnlacePdf(contenedor, { url: "https://x/a.pdf", expira_en_segundos: 0 });
    expect(contenedor.textContent).toContain("ha expirado");
  });
  test("sin expira_en_segundos se considera expirado", () => {
    renderEnlacePdf(contenedor, { url: "https://x/a.pdf" });
    expect(contenedor.textContent).toContain("ha expirado");
  });
  test("muestra minutos cuando dura menos de una hora", () => {
    renderEnlacePdf(contenedor, { url: "https://x/a.pdf", expira_en_segundos: 300 });
    expect(contenedor.querySelector("a").getAttribute("href")).toBe("https://x/a.pdf");
    expect(contenedor.textContent).toContain("Disponible por 5 min");
  });
  test("muestra horas cuando dura una hora o más", () => {
    renderEnlacePdf(contenedor, { url: "https://x/a.pdf", expira_en_segundos: 7200 });
    expect(contenedor.textContent).toContain("Disponible por 2 h");
  });
  test("usa la etiqueta personalizada y escapa la URL", () => {
    renderEnlacePdf(contenedor, { url: 'https://x/"a".pdf', expira_en_segundos: 600 }, "Descargar");
    expect(contenedor.textContent).toContain("Descargar");
    expect(contenedor.innerHTML).toContain("&quot;a&quot;");
  });
});

describe("piezas de interfaz", () => {
  test("bloqueCampo escapa la etiqueta y deja el contenido tal cual", () => {
    const html = bloqueCampo("🏷️", "A & B", "<p>contenido</p>");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("<p>contenido</p>");
  });
  test("bloqueTexto muestra '—' cuando está vacío", () => {
    expect(bloqueTexto("x", "Campo", "   ")).toContain("—");
    expect(bloqueTexto("x", "Campo", null)).toContain("—");
  });
  test("bloqueTexto escapa el texto", () => {
    expect(bloqueTexto("x", "Campo", "<script>")).toContain("&lt;script&gt;");
  });
  test("listaChips pinta un chip por texto", () => {
    const cont = document.createElement("div");
    cont.innerHTML = listaChips(["IA", "Web"], "Nada");
    expect(cont.querySelectorAll("li.chip-dato")).toHaveLength(2);
  });
  test("listaChips usa el texto de 'vacío' si no hay elementos o no es arreglo", () => {
    expect(listaChips([], "Sin datos")).toContain("Sin datos");
    expect(listaChips(null, "Sin datos")).toContain("Sin datos");
  });
});

describe("validarCampos", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="banner"></div>
      <input id="a"><textarea id="b"></textarea>
      <div id="grupo"><input type="checkbox" id="c1"></div>`;
  });

  test("devuelve true y no muestra banner si todo está bien", () => {
    expect(validarCampos([{ id: "a", error: null }, { id: "b", error: null }], "banner")).toBe(true);
    expect(document.getElementById("banner").textContent).toBe("");
  });

  test("marca el control con error, junta los mensajes y enfoca el primero", () => {
    const ok = validarCampos(
      [{ id: "a", error: "Falta A." }, { id: "b", error: "Falta B." }],
      "banner"
    );
    expect(ok).toBe(false);
    const a = document.getElementById("a");
    expect(a.classList.contains("is-invalid")).toBe(true);
    expect(a.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById("banner").textContent).toContain("Falta A. Falta B.");
    expect(document.activeElement).toBe(a);
  });

  test("un contenedor de casillas recibe border-danger y el foco va a su primer control", () => {
    expect(validarCampos([{ id: "grupo", error: "Elige una." }], "banner")).toBe(false);
    expect(document.getElementById("grupo").classList.contains("border-danger")).toBe(true);
    expect(document.activeElement).toBe(document.getElementById("c1"));
  });

  test("limpia las marcas de un campo ya corregido", () => {
    validarCampos([{ id: "a", error: "Mal" }], "banner");
    validarCampos([{ id: "a", error: null }], "banner");
    const a = document.getElementById("a");
    expect(a.classList.contains("is-invalid")).toBe(false);
    expect(a.hasAttribute("aria-invalid")).toBe(false);
  });

  test("ignora ids que no existen", () => {
    expect(validarCampos([{ id: "fantasma", error: "x" }], "banner")).toBe(true);
  });
});

describe("enfocarBanner", () => {
  test("hace el banner enfocable y le da el foco", () => {
    document.body.innerHTML = '<div id="banner"></div>';
    enfocarBanner("banner");
    const banner = document.getElementById("banner");
    expect(banner.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(banner);
  });
  test("no falla si no existe", () => {
    expect(() => enfocarBanner("fantasma")).not.toThrow();
  });
});
