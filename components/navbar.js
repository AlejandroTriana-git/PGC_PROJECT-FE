// ============================================================
// NAVBAR.JS — topbar institucional (escudo  + datos
// del usuario). Se escribe UNA sola vez aquí y cada página solo
// hace:
//
//   <div id="topbar"></div>
//   <script src="components/navbar.js"></script>
//   <script> renderizarBarraSuperior("topbar"); </script>
//
// Si mañana cambia el diseño del encabezado, se edita este
// archivo y se actualiza en todas las páginas a la vez.
// ============================================================

const ETIQUETAS_ROL = {
  estudiante: { label: "Estudiante", color: "var(--teal)" },
  docente: { label: "Docente", color: "var(--naranja)" },
  coordinador: { label: "Coordinador", color: "var(--oro)" },
  jurado: { label: "Jurado", color: "var(--verde-brillante)" },
  administrador: { label: "Administrador", color: "var(--gris)" },
};

function renderizarBarraSuperior(idContenedor) {
  const elemento = document.getElementById(idContenedor);
  if (!elemento) return;

  const usuario = typeof obtenerUsuario === "function" ? obtenerUsuario() : null;
  const infoRol = usuario && ETIQUETAS_ROL[usuario.rol] ? ETIQUETAS_ROL[usuario.rol] : null;

  elemento.innerHTML = `
    <div class="topbar">
  
          <img src="assets/logos/logosimbolo-blanco.png" alt="Escudo Universidad de Cundinamarca" class="logo-topbar">

      ${
        usuario
          ? `<div class="usuario-box">
              <span>${usuario.nombre || usuario.correo || "Usuario"}</span>
              ${infoRol ? `<span class="role-chip"><span class="dot" style="background:${infoRol.color}"></span>${infoRol.label}</span>` : ""}
              <button class="btn-salir" onclick="cerrarSesion()">Cerrar sesión</button>
            </div>`
          : ""
      }
    </div>
  `;
}