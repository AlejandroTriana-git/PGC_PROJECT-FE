// ============================================================
// SIDEBAR.JS — menú lateral según rol y, para Profesor, según
// el contexto activo (Profesor / Encargado / Jurado). Cada página
// solo hace:
//
//   <div id="sidebar"></div>
//   <script src="components/sidebar.js"></script>
//   <script> renderizarBarraLateral("sidebar", "dashboard"); </script>
//
// El segundo argumento es el nombre de la página activa, para
// resaltar el enlace correspondiente.
//
// IMPORTANTE: un Profesor ya NO ve un menú combinado con todas
// sus capacidades a la vez. Ve solo el menú del contexto que
// tenga activo en ese momento (ver auth.js / navbar.js) — si
// cambia de contexto en el topbar, este menú cambia con él.
//
// CANDADOS: el bloqueo de "Radicar propuesta" que se ve aquí es
// SOLO COSMÉTICO (evita el clic con pointer-events: none) — la
// protección real vive dentro de radicar-propuesta.html, que
// revisa lo mismo al cargar y no pinta el formulario si no debe.
// Si alguien fuerza la URL, la página se protege sola.
// ============================================================

// Menú de Estudiante y Administrador: sin contexto, fijo por rol.
const MENU_BASE_POR_ROL = {
  estudiante: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "radicar-propuesta", label: "Radicar propuesta", href: "radicar-propuesta.html" },
    { id: "mis-propuestas", label: "Mi propuesta", href: "mis-propuestas.html" },
    { id: "propuestaAprobada", label: "Propuestas aprobadas", href: "propuestaAprobada.html" },
    { id: "miPgc", label: "Mi PGC", href: "miPgc.html" },
    { id: "buscarPgc", label: "Buscar PGC", href: "buscarPgc.html" },
    { id: "lineamientos", label: "Lineamientos", href: "lineamientos.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
  administrador: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "ciclos", label: "Ciclos", href: "ciclos.html" },
    { id: "usuarios", label: "Usuarios", href: "usuarios.html" },
    { id: "reportes", label: "Reportes", href: "reportes.html" },
    { id: "buscarPgc", label: "Buscar PGC", href: "buscarPgc.html" },
    { id: "lineamientos", label: "Lineamientos", href: "lineamientos.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
};

// Menú de Profesor: uno distinto por cada contexto posible.
const MENU_POR_CONTEXTO = {
  profesor: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "reportes", label: "Propuestas", href: "reportes.html" },
    { id: "buscarPgc", label: "Buscar PGC", href: "buscarPgc.html" },
    { id: "lineamientos", label: "Lineamientos", href: "lineamientos.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
  encargado: [
    { id: "aprobaciones", label: "Aprobaciones", href: "aprobaciones.html" },
    { id: "configurarFecha", label: "Configurar fechas", href: "configurarFecha.html" },
    { id: "buscarPgc", label: "Buscar PGC", href: "buscarPgc.html" },
    { id: "lineamientos", label: "Lineamientos", href: "lineamientos.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
  jurado: [
    { id: "evaluaciones", label: "Evaluaciones", href: "evaluaciones.html" },
    { id: "buscarPgc", label: "Buscar PGC", href: "buscarPgc.html" },
    { id: "lineamientos", label: "Lineamientos", href: "lineamientos.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
};

// Mismo literal que usa radicar-propuesta.js para la etapa de fechas
// (con tilde, confirmado por backend en cycle_dates.stage).
const ETAPA_RADICACION = "Radicación";

// Mismo texto que ya usa radicar-propuesta.js (Bug 1) para explicar
// por qué no se puede radicar una propuesta nueva. Se centraliza
// aquí para que el candado del menú diga lo mismo que la página.
const MOTIVO_BLOQUEO_RADICAR = {
  "Pendiente de validación": "Ya tienes una propuesta pendiente de validación.",
  "Aprobada": "Tu propuesta ya fue aprobada — continúa desde \"Mi PGC\".",
  "Rechazada": "Tu propuesta fue rechazada — edítala desde \"Mi propuesta\".",
  "Anulada": "Tu propuesta fue anulada.",
};

/**
 * Devuelve el menú que le toca al usuario: si es Profesor, según
 * su contexto activo; si no, el menú fijo de su rol.
 */
function construirMenu(usuario) {
  if (usuario.rol === "profesor") {
    const contexto = obtenerContextoActivo();
    return MENU_POR_CONTEXTO[contexto] || MENU_POR_CONTEXTO.profesor;
  }
  return MENU_BASE_POR_ROL[usuario.rol] || [];
}

/** Arma el HTML de un enlace de menú normal (habilitado). */
function construirEnlaceMenu(opcion, paginaActiva) {
  return `
    <a class="nav-link${opcion.id === paginaActiva ? " active" : ""}" href="${opcion.href}">
      ${opcion.label}
    </a>`;
}

/** Arma el HTML de un enlace bloqueado: gris, sin click, con candado y tooltip nativo. */
function construirEnlaceBloqueado(opcion, motivo) {
  return `
    <span class="nav-link bloqueado" title="${escaparHtml(motivo)}">
      🔒 ${opcion.label}
    </span>`;
}

/**
 * Revisa si "Radicar propuesta" debe quedar bloqueado para este
 * estudiante: primero por tener ya una propuesta (cualquier estado),
 * y si no, por estar fuera de la fecha de la etapa "Radicación".
 * Devuelve el motivo a mostrar en el tooltip, o null si no aplica.
 */
async function obtenerBloqueoRadicarPropuesta(usuario) {
  try {
    const res = await peticionApi("/propuestas/mia");
    if (res.ok) {
      const propuesta = await res.json();
      return MOTIVO_BLOQUEO_RADICAR[propuesta.estado] || "Ya tienes una propuesta registrada.";
    }
    // 404: no tiene propuesta → sigue al chequeo de fecha
  } catch {
    return null; // si falla la consulta, no bloqueamos por las dudas
  }

  if (!usuario.id_cycle) return null; // sin id_cycle no se puede validar la fecha

  try {
    const res = await peticionApi(`/ciclos/${usuario.id_cycle}/fechas`);
    if (!res.ok) return null;
    const filas = await res.json();
    const fila = (filas || []).find((f) => f.stage === ETAPA_RADICACION);
    if (!fila) return null;

    const ahora = new Date();
    if (ahora < new Date(fila.start_date) || ahora > new Date(fila.end_date)) {
      return `Habilitado del ${fila.start_date} al ${fila.end_date}.`;
    }
    return null;
  } catch {
    return null;
  }
}

async function renderizarBarraLateral(idContenedor, paginaActiva) {
  const elemento = document.getElementById(idContenedor);
  if (!elemento) return;

  const usuario = typeof obtenerUsuario === "function" ? obtenerUsuario() : null;
  const opciones = usuario ? construirMenu(usuario) : [];

  // Primera pintada: todo habilitado, para que el menú no tarde en aparecer.
  elemento.innerHTML = `<nav class="sidebar">${opciones.map((o) => construirEnlaceMenu(o, paginaActiva)).join("")}</nav>`;

  // Candado de "Radicar propuesta" (solo aplica a Estudiante).
  if (usuario && usuario.rol === "estudiante" && opciones.some((o) => o.id === "radicar-propuesta")) {
    const motivo = await obtenerBloqueoRadicarPropuesta(usuario);
    if (motivo) {
      const enlaceActual = elemento.querySelector('a[href="radicar-propuesta.html"]');
      if (enlaceActual) {
        const opcion = opciones.find((o) => o.id === "radicar-propuesta");
        enlaceActual.outerHTML = construirEnlaceBloqueado(opcion, motivo);
      }
    }
  }
}