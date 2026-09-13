// ============================================================
// AUTH.JS — HU-01: inicio de sesión, JWT y rutas protegidas.
// Toda la lógica de autenticación vive aquí; cualquier página
// que necesite sesión solo llama a requerirAutenticacion() al cargar.
// ============================================================

const CLAVE_TOKEN = "pgc_token";

/**
 * Diccionario de traducción de roles: la BD y el frontend no usan
 * los mismos nombres (ej. la BD dice "Profesor", nosotros decimos
 * "docente"). Aquí se resuelve esa diferencia en un solo lugar,
 * para que sidebar.js y navbar.js no tengan que saber nada de esto.
 */
const TRADUCCION_ROLES = {
  "Estudiante": "estudiante",
  "Profesor": "docente",
  "Jurado": "jurado",
  "Encargado de Ciclo": "coordinador",
  "Administrador": "administrador",
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
 * Devuelve el payload del usuario actual (id, nombre, rol...) o null.
 * El campo "rol" se traduce con TRADUCCION_ROLES antes de entregarlo,
 * para que el resto del frontend siempre reciba los nombres que ya
 * usa (estudiante, docente, coordinador, jurado, administrador).
 */
function obtenerUsuario() {
  const token = obtenerToken();
  const payload = token ? decodificarJWT(token) : null;
  if (!payload) return null;

  const rolTraducido = TRADUCCION_ROLES[payload.rol];
  payload.rol = rolTraducido || payload.rol.toLowerCase();

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