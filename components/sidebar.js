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

// Literales de etapa (con tilde, confirmados por backend en cycle_dates.stage).
// OJO: llevan prefijo SIDEBAR_ a propósito. radicar-propuesta.js y
// configurarFecha.js ya declaran "const ETAPA_RADICACION" y se cargan
// en la misma página que este archivo: si aquí se repite el mismo
// nombre, el navegador lanza "Identifier has already been declared" y
// el segundo script NO se ejecuta (la página queda sin funcionar).
const SIDEBAR_ETAPA_RADICACION = "Radicación";
const SIDEBAR_ETAPA_REGISTRO_PGC = "Registro PGC";

// Mismo texto que ya usa radicar-propuesta.js (Bug 1) para explicar
// por qué no se puede radicar una propuesta nueva. Se centraliza
// aquí para que el candado del menú diga lo mismo que la página.
const MOTIVO_BLOQUEO_RADICAR = {
  "Pendiente de validación": "Ya tienes una propuesta pendiente de validación.",
  "Aprobada": "Tu propuesta ya fue aprobada — continúa desde \"Mi PGC\".",
  "Rechazada": "Tu propuesta fue rechazada — edítala desde \"Mi propuesta\".",
  "Anulada": "Tu propuesta fue anulada.",
};

// Qué opción del menú depende de qué etapa del ciclo.
const CANDADOS_POR_FECHA = [
  { id_opcion: "radicar-propuesta", etapa: SIDEBAR_ETAPA_RADICACION, accion: "radicar propuestas" },
  { id_opcion: "propuestaAprobada", etapa: SIDEBAR_ETAPA_REGISTRO_PGC, accion: "registrar el PGC" },
];

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

/**
 * Arma el HTML de un enlace bloqueado: gris, sin href (no navega) y
 * con el motivo en un tooltip. Ya NO usa pointer-events: none, porque
 * eso también apagaba el hover y el tooltip nunca aparecía.
 */
function construirEnlaceBloqueado(opcion, motivo) {
  return `
    <span class="nav-link bloqueado" tabindex="0" role="link" aria-disabled="true"
          title="${escaparHtml(motivo)}" data-bs-toggle="tooltip" data-bs-placement="right">
      🔒 ${opcion.label}
    </span>`;
}

/**
 * Convierte "YYYY-MM-DD HH:mm:ss" (formato del BE) a Date. Se cambia
 * el espacio por "T" porque algunos navegadores (Safari) devuelven
 * Invalid Date con el espacio, y ahí el candado nunca se activaba.
 */
function leerFechaBe(texto) {
  return new Date(String(texto).replace(" ", "T"));
}

/** "2026-10-24 00:00:00" → "24/10/2026" para mostrar en el tooltip. */
function formatearFechaCorta(texto) {
  const fecha = leerFechaBe(texto);
  return isNaN(fecha) ? texto : fecha.toLocaleDateString("es-CO");
}

/**
 * Revisa la ventana de una etapa contra las filas de GET /ciclos/:id/fechas.
 * Devuelve el motivo del bloqueo o null si hoy está dentro del rango.
 * Si la etapa no está configurada TAMBIÉN se bloquea (antes se dejaba
 * pasar y el menú decía una cosa mientras la página decía otra).
 */
function motivoBloqueoPorEtapa(filas, etapa, accion) {
  const fila = (filas || []).find((f) => f.stage === etapa);
  if (!fila) return `El periodo para ${accion} todavía no ha sido configurado para tu ciclo.`;

  const ahora = new Date();
  if (ahora < leerFechaBe(fila.start_date) || ahora > leerFechaBe(fila.end_date)) {
    return `Fuera de fecha: habilitado del ${formatearFechaCorta(fila.start_date)} al ${formatearFechaCorta(fila.end_date)}.`;
  }
  return null;
}

/** Pide las fechas del ciclo del estudiante una sola vez. null si no se pudo. */
async function obtenerFechasCiclo(usuario) {
  if (!usuario.id_cycle) return null; // el JWT debe traer id_cycle para estudiantes
  try {
    const res = await peticionApi(`/ciclos/${usuario.id_cycle}/fechas`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Revisa si "Radicar propuesta" debe quedar bloqueado: primero por
 * tener ya una propuesta (cualquier estado) y si no, por la fecha
 * de la etapa "Radicación". Devuelve el motivo o null.
 */
async function obtenerBloqueoRadicarPropuesta(filas_fechas) {
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
  if (!filas_fechas) return null;
  return motivoBloqueoPorEtapa(filas_fechas, SIDEBAR_ETAPA_RADICACION, "radicar propuestas");
}

/** Cambia un enlace del menú por su versión bloqueada con tooltip. */
function bloquearOpcion(elemento, opciones, id_opcion, motivo) {
  const opcion = opciones.find((o) => o.id === id_opcion);
  const enlaceActual = opcion && elemento.querySelector(`a[href="${opcion.href}"]`);
  if (!enlaceActual) return;

  enlaceActual.outerHTML = construirEnlaceBloqueado(opcion, motivo);

  // Si Bootstrap JS está cargado en la página, tooltip inmediato y con
  // estilo; si no, queda el tooltip nativo del atributo title.
  if (window.bootstrap && bootstrap.Tooltip) {
    elemento.querySelectorAll('.bloqueado[data-bs-toggle="tooltip"]').forEach((el) => {
      bootstrap.Tooltip.getOrCreateInstance(el);
    });
  }
}

async function renderizarBarraLateral(idContenedor, paginaActiva) {
  const elemento = document.getElementById(idContenedor);
  if (!elemento) return;

  const usuario = typeof obtenerUsuario === "function" ? obtenerUsuario() : null;
  const opciones = usuario ? construirMenu(usuario) : [];

  // Primera pintada: todo habilitado, para que el menú no tarde en aparecer.
  elemento.innerHTML = `<nav class="sidebar">${opciones.map((o) => construirEnlaceMenu(o, paginaActiva)).join("")}</nav>`;

  // Candados por fecha: solo aplican a Estudiante.
  if (!usuario || usuario.rol !== "estudiante") return;

  const filas_fechas = await obtenerFechasCiclo(usuario);

  for (const candado of CANDADOS_POR_FECHA) {
    if (!opciones.some((o) => o.id === candado.id_opcion)) continue;

    const motivo = candado.id_opcion === "radicar-propuesta"
      ? await obtenerBloqueoRadicarPropuesta(filas_fechas)
      : (filas_fechas ? motivoBloqueoPorEtapa(filas_fechas, candado.etapa, candado.accion) : null);

    if (motivo) bloquearOpcion(elemento, opciones, candado.id_opcion, motivo);
  }
}