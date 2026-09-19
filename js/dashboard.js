// ============================================================
// DASHBOARD.JS — lógica propia de dashboard.html.
// De momento solo pinta el saludo según el usuario autenticado;
// aquí es donde el Sprint 2 conectará los datos reales de la API
// (peticionApi("/dashboard") desde utils.js).
// ============================================================

function inicializarPanel() {
  const usuario = obtenerUsuario();
  const saludo = document.getElementById("saludo");
  if (usuario && saludo) {
    saludo.textContent = `Bienvenido, ${usuario.nombre || usuario.correo}`;
  }
}
