// ============================================================
// Utilidades compartidas por las pruebas del FE del PGC.
// ============================================================
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..", "..");
const URL_BASE = "https://pgc-project-be.onrender.com/api";

/** Carga uno o varios scripts del proyecto (rutas relativas a la raíz). */
function cargar(...rutas) {
  rutas.forEach((ruta) => require(path.join(RAIZ, ruta)));
}

/** config.js + auth.js + utils.js: lo que casi todas las páginas necesitan. */
function cargarBase() {
  cargar("js/config.js", "js/auth.js", "js/utils.js");
}

/**
 * Pone en el documento el <body> real de una página del proyecto (sin sus
 * <script>), para que los ids coincidan con los que usa el JS.
 * Ej.: cargarHtml("aprobaciones.html")
 */
function cargarHtml(archivo) {
  const html = fs.readFileSync(path.join(RAIZ, archivo), "utf8");
  const coincidencia = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const cuerpo = (coincidencia ? coincidencia[1] : html).replace(/<script[\s\S]*?<\/script>/gi, "");
  document.body.innerHTML = cuerpo;
}

/** Simula bootstrap.Modal (las páginas lo usan para sus ventanas emergentes). */
function simularBootstrap() {
  const instancias = [];
  global.bootstrap = {
    Modal: jest.fn().mockImplementation(() => {
      const modal = { show: jest.fn(), hide: jest.fn() };
      instancias.push(modal);
      return modal;
    }),
  };
  global.bootstrap.instancias = instancias;
  return global.bootstrap;
}

/** Crea un File de prueba. */
function crearArchivo({ nombre = "doc.pdf", tipo = "application/pdf", tamanoMB = 0.1 } = {}) {
  const archivo = new File(["contenido"], nombre, { type: tipo });
  Object.defineProperty(archivo, "size", { value: Math.round(tamanoMB * 1024 * 1024) });
  return archivo;
}

/** Hace que un <input type="file"> "tenga" los archivos indicados. */
function asignarArchivos(input, archivos) {
  Object.defineProperty(input, "files", { value: archivos, configurable: true });
}

/** Dispara el evento submit de un formulario (burbujea y se puede cancelar). */
function enviarFormulario(form) {
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

// ── JWT de prueba ────────────────────────────────────────────
function base64Url(texto) {
  return Buffer.from(texto, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Crea un JWT (sin firma real) con el payload dado. exp por defecto: +1 h. */
function crearToken(payload = {}) {
  const cuerpo = { exp: Math.floor(Date.now() / 1000) + 3600, ...payload };
  return `${base64Url('{"alg":"HS256","typ":"JWT"}')}.${base64Url(JSON.stringify(cuerpo))}.firma`;
}

/** Deja una sesión iniciada con el payload indicado. */
function iniciarSesionDePrueba(payload = {}) {
  localStorage.setItem("pgc_token", crearToken({ nombre: "Ana Pérez", rol: "Estudiante", ...payload }));
}

// ── fetch simulado ───────────────────────────────────────────
function crearRespuesta(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new Error("sin cuerpo");
      return body;
    },
  };
}

const ok = (body = {}) => ({ status: 200, body });
const estado = (status, body = {}) => ({ status, body });
const falloDeRed = () => new Error("sin conexión");

/**
 * Reemplaza fetch por un simulador. `rutas` es { "GET /ciclos": ok([...]) }.
 * - La clave es "MÉTODO /ruta" (sin la URL base). Si termina en * coincide por prefijo.
 * - El valor es ok(body) | estado(code, body) | falloDeRed() | función(llamada) que devuelva eso.
 * - Lo que no esté definido responde 404.
 * El mock queda en global.fetch y expone .llamadas (método, ruta, opciones).
 */
function simularApi(rutas = {}) {
  const llamadas = [];
  const mock = jest.fn(async (url, opciones = {}) => {
    const metodo = String(opciones.method || "GET").toUpperCase();
    const ruta = String(url).replace(URL_BASE, "");
    llamadas.push({ metodo, ruta, opciones });

    for (const [clave, definicion] of Object.entries(rutas)) {
      const [metodoClave, patron] = clave.split(" ");
      if (metodoClave !== metodo) continue;
      const coincide = patron.endsWith("*") ? ruta.startsWith(patron.slice(0, -1)) : ruta === patron;
      if (!coincide) continue;

      const valor = typeof definicion === "function" ? definicion({ metodo, ruta, opciones }) : definicion;
      if (valor instanceof Error) throw valor;
      return crearRespuesta(valor.status, valor.body);
    }
    return crearRespuesta(404, {});
  });
  mock.llamadas = llamadas;
  global.fetch = mock;
  return mock;
}

// ── location y fecha ─────────────────────────────────────────
/** Sustituye window.location por un objeto simple, para poder comprobar redirecciones. */
function simularUbicacion(extra = {}) {
  delete window.location;
  window.location = {
    href: "http://localhost/",
    origin: "http://localhost",
    pathname: "/",
    search: "",
    ...extra,
  };
  return window.location;
}

const NO_SIMULAR = [
  "nextTick", "setImmediate", "clearImmediate", "setTimeout", "clearTimeout", "setInterval",
  "clearInterval", "queueMicrotask", "performance", "hrtime", "requestAnimationFrame",
  "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback",
];

/** Congela solo la fecha ("hoy" = la indicada); los timers siguen reales. */
function congelarFecha(iso) {
  jest.useFakeTimers({ now: new Date(iso), doNotFake: NO_SIMULAR });
}

function descongelarFecha() {
  jest.useRealTimers();
}

/** Espera a que terminen las promesas pendientes (render asíncrono). */
function esperar() {
  return new Promise((resolver) => setTimeout(resolver, 0));
}

module.exports = {
  RAIZ, URL_BASE, cargar, cargarBase, cargarHtml, simularBootstrap, crearArchivo, asignarArchivos, enviarFormulario, crearToken, iniciarSesionDePrueba,
  crearRespuesta, ok, estado, falloDeRed, simularApi,
  simularUbicacion, congelarFecha, descongelarFecha, esperar,
};
