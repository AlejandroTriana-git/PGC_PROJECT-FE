// ============================================================
// SIDEBAR.JS — menú lateral con navegación por rol (HU-01:
// "ocultar/mostrar opciones según rol"). Cada página solo hace:
//
//   <div id="sidebar"></div>
//   <script src="components/sidebar.js"></script>
//   <script> renderizarBarraLateral("sidebar", "dashboard"); </script>
//
// El segundo argumento es el nombre de la página activa, para
// resaltar el enlace correspondiente.
// ============================================================

// Menú disponible por rol. Agregar una opción nueva aquí la
// hace aparecer automáticamente para ese rol en todas las
// páginas, sin tocar el HTML de cada una.
const MENU_POR_ROL = {
  estudiante: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
  docente: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "reportes", label: "Propuestas", href: "reportes.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
  coordinador: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "usuarios", label: "Usuarios", href: "usuarios.html" },
    { id: "reportes", label: "Reportes", href: "reportes.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
  jurado: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "reportes", label: "Evaluaciones", href: "reportes.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
  // Pendiente confirmar alcance real con el equipo; de momento
  // se le da acceso similar al de coordinador.
  administrador: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "usuarios", label: "Usuarios", href: "usuarios.html" },
    { id: "reportes", label: "Reportes", href: "reportes.html" },
    { id: "perfil", label: "Mi perfil", href: "perfil.html" },
  ],
};

function renderizarBarraLateral(idContenedor, paginaActiva) {
  const elemento = document.getElementById(idContenedor);
  if (!elemento) return;

  const usuario = typeof obtenerUsuario === "function" ? obtenerUsuario() : null;
  const opciones = (usuario && MENU_POR_ROL[usuario.rol]) || [];

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