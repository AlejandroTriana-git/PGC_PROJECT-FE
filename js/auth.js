// ============================================================
// AUTH.JS — HU-01: inicio de sesión, JWT y rutas protegidas.
// Toda la lógica de autenticación vive aquí; cualquier página
// que necesite sesión solo llama a requerirAutenticacion() al cargar.
// ============================================================

const CLAVE_TOKEN = "pgc_token";
const CLAVE_CONTEXTO = "pgc_contexto_activo";

/**
 * Diccionario de traducción de roles: la BD y el frontend no usan
 * los mismos nombres (ej. la BD dice "Profesor", nosotros decimos
 * "docente"). Aquí se resuelve esa diferencia en un solo lugar.
 *
 * OJO: "Jurado" y "Encargado de Ciclo" ya NO son roles — son
 * capacidades por ciclo que trae un "Profesor" en los arreglos
 * encargado_de / jurado_de (ver obtenerUsuario más abajo).
 */
const TRADUCCION_ROLES = {
  "Estudiante": "estudiante",
  "Profesor": "docente",
  "Coordinador": "coordinador",
};

/** Guarda el JWT recibido del backend. */
function guardarToken(token) {
  localStorage.setItem(CLAVE_TOKEN, token);
}

/** Devuelve el JWT guardado, o null si no hay sesión. */
function obtenerToken() {
  return localStorage.getItem(CLAVE_TOKEN);
}

/** Elimina el JWT (cierre de sesión). */
function eliminarToken() {
  localStorage.removeItem(CLAVE_TOKEN);
  localStorage.removeItem(CLAVE_CONTEXTO);
}

/**
 * Devuelve el contexto activo del Profesor: "docente" (por
 * defecto), "encargado" o "jurado". Un Profesor siempre aterriza
 * en "docente" al iniciar sesión; solo cambia si usa el menú
 * desplegable del topbar (ver navbar.js).
 */
function obtenerContextoActivo() {
  return localStorage.getItem(CLAVE_CONTEXTO) || "docente";
}

/** Guarda el contexto activo elegido desde el menú del topbar. */
function establecerContextoActivo(contexto) {
  localStorage.setItem(CLAVE_CONTEXTO, contexto);
}

/**
 * true si hay un token guardado y no está vencido.
 * La validación de firma la hace siempre el backend; aquí
 * solo evitamos mandar a la interfaz un token ya caducado.
 */
function estaAutenticado() {
  const token = obtenerToken();
  if (!token) return false;
  const payload = decodificarJWT(token);
  if (!payload || !payload.exp) return false;
  return payload.exp * 1000 > Date.now();
}

/**
 * Devuelve el payload del usuario actual (id, nombre, rol,
 * encargado_de, jurado_de...) o null.
 *
 * - "rol" se traduce con TRADUCCION_ROLES antes de entregarlo.
 * - "encargado_de" y "jurado_de" vienen tal cual del backend
 *   (arreglos de id_cycle) — no necesitan traducción, solo se
 *   les pone un respaldo de arreglo vacío por si algún día el
 *   backend no los manda para un rol que no los usa.
 *
 * Con esto, sidebar.js y navbar.js arman el menú y los chips
 * combinando "rol" + estos dos arreglos, en vez de depender de
 * un único nombre de rol fijo.
 */
function obtenerUsuario() {
  const token = obtenerToken();
  const payload = token ? decodificarJWT(token) : null;
  if (!payload) return null;

  const rolTraducido = TRADUCCION_ROLES[payload.rol];
  payload.rol = rolTraducido || payload.rol.toLowerCase();
  payload.encargado_de = payload.encargado_de || [];
  payload.jurado_de = payload.jurado_de || [];

  return payload;
}

/**
 * Intenta iniciar sesión contra la API.
 * Devuelve { ok: true, data } o { ok: false, mensaje, campos }
 * — pensado para alimentar directamente mostrarBanner().
 */
async function iniciarSesion(correo, clave) {
  if (!correo || !clave) {
    return { ok: false, mensaje: "Debe completar todos los campos.", campos: ["f-correo", "f-clave"] };
  }

  try {
    const res = await fetch(`${URL_API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, contrasena: clave }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 400) {
      return { ok: false, mensaje: data.mensaje || "Debe completar todos los campos.", campos: ["f-correo", "f-clave"] };
    }
    if (res.status === 404) {
      return { ok: false, mensaje: data.mensaje || "Correo electrónico no registrado.", campos: ["f-correo"] };
    }
    if (res.status === 401) {
      return { ok: false, mensaje: data.mensaje || "Contraseña incorrecta.", campos: ["f-clave"] };
    }
    if (!res.ok) {
      return { ok: false, mensaje: data.mensaje || "No fue posible iniciar sesión.", campos: [] };
    }

    guardarToken(data.token);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, mensaje: "No fue posible conectar con el servidor.", campos: [] };
  }
}

/**
 * Cierra la sesión y redirige al login.
 * @param {string} [mensaje] - si se pasa, se muestra en index.html
 *   (por ejemplo "Sesión expirada.").
 */
function cerrarSesion(mensaje) {
  eliminarToken();
  const destino = mensaje ? `index.html?msg=${encodeURIComponent(mensaje)}` : "index.html";
  window.location.href = destino;
}

/**
 * "Middleware" de rutas protegidas del lado del frontend.
 * Se llama al inicio de cada página que requiera sesión
 * (dashboard, usuarios, reportes, perfil). Si no hay sesión
 * válida, redirige al login con el mensaje del HU-01.
 */
function requerirAutenticacion() {
  if (!estaAutenticado()) {
    cerrarSesion("Debe iniciar sesión para acceder a esta página.");
  }
}

/**
 * Bloquea el acceso a una página que requiere una capacidad
 * específica del Profesor: "encargado" o "jurado". Reutiliza
 * requerirAutenticacion() (así nunca se te olvida esa parte) y
 * además valida que el arreglo correspondiente no esté vacío.
 * Si no cumple, lo devuelve a su dashboard.
 */
function requerirCapacidad(capacidad) {
  requerirAutenticacion();
  const usuario = obtenerUsuario();
  const lista = usuario ? usuario[`${capacidad}_de`] : [];
  if (!lista || lista.length === 0) {
    window.location.href = "dashboard.html";
  }
}

/**
 * Bloquea el acceso a una página reservada a uno o varios roles
 * puntuales (ej. "administrador" para usuarios.html, o
 * ["docente", "administrador"] para reportes.html, que la ven
 * ambos roles). Acepta un string o un arreglo. Reutiliza
 * requerirAutenticacion() y compara el rol ya traducido de
 * obtenerUsuario(). Si no coincide, lo devuelve a su dashboard.
 */
function requerirRol(roles) {
  requerirAutenticacion();
  const usuario = obtenerUsuario();
  const permitidos = Array.isArray(roles) ? roles : [roles];
  if (!usuario || !permitidos.includes(usuario.rol)) {
    window.location.href = "dashboard.html";
  }
}