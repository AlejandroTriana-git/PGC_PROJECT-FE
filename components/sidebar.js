// ============================================================
// SIDEBAR.JS — menú lateral según rol y, para Profesor, según
// el contexto activo (Docente / Encargado / Jurado). Cada página
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
// ============================================================

// Menú de Estudiante y Coordinador: sin contexto, fijo por rol.
const MENU_BASE_POR_ROL = {
  estudiante: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "radicar-propuesta", label: "Radicar propuesta", href: "radicar-propuesta.html" },
    { id: "mis-propuestas", label: "Mi propuesta", href: "mis-propuestas.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
  coordinador: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "ciclos", label: "Ciclos", href: "ciclos.html" },
    { id: "usuarios", label: "Usuarios", href: "usuarios.html" },
    { id: "reportes", label: "Reportes", href: "reportes.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
};

// Menú de Profesor: uno distinto por cada contexto posible.
const MENU_POR_CONTEXTO = {
  docente: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "reportes", label: "Propuestas", href: "reportes.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
  encargado: [
    { id: "aprobaciones", label: "Aprobaciones", href: "aprobaciones.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
  jurado: [
    { id: "evaluaciones", label: "Evaluaciones", href: "evaluaciones.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
};

/**
 * Devuelve el menú que le toca al usuario: si es Profesor, según
 * su contexto activo; si no, el menú fijo de su rol.
 */
function construirMenu(usuario) {
  if (usuario.rol === "docente") {
    const contexto = obtenerContextoActivo();
    return MENU_POR_CONTEXTO[contexto] || MENU_POR_CONTEXTO.docente;
  }
  return MENU_BASE_POR_ROL[usuario.rol] || [];
}

function renderizarBarraLateral(idContenedor, paginaActiva) {
  const elemento = document.getElementById(idContenedor);
  if (!elemento) return;

  const usuario = typeof obtenerUsuario === "function" ? obtenerUsuario() : null;
  const opciones = usuario ? construirMenu(usuario) : [];

  const enlaces = opciones
    .map(
      (opcion) => `
      <a class="nav-link${opcion.id === paginaActiva ? " active" : ""}" href="${opcion.href}">
        ${opcion.label}
      </a>`
    )
    .join("");

  elemento.innerHTML = `<nav class="sidebar">${enlaces}</nav>`;
}