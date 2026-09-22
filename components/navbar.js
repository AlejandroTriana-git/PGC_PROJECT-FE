// ============================================================
// NAVBAR.JS — topbar institucional (imagotipo + datos
// del usuario). Se escribe UNA sola vez aquí y cada página solo
// hace:
//
//   <div id="topbar"></div>
//   <script src="components/navbar.js"></script>
//   <script> renderizarBarraSuperior("topbar"); </script>
//
// Si mañana cambia el diseño del encabezado, se edita este
// archivo y se actualiza en todas las páginas a la vez.
//
// IMPORTANTE: Un Profesor puede tener varias capacidades a la
// vez (docente + encargado + jurado), pero solo "usa" una a la
// vez — el "contexto activo" (ver auth.js). Aquí el topbar ya
// no muestra todos los chips juntos: muestra un selector con el
// contexto activo, que se puede cambiar si tiene más de uno.
// ============================================================

// Etiqueta fija para roles que no tienen capacidades extra.
const ETIQUETA_BASE = {
  estudiante: "Estudiante",
  coordinador: "Coordinador",
};

// Los "sombreros" que puede tener un Profesor: su etiqueta y la
// página a la que se va al elegirlo en el menú del topbar.
const CONTEXTOS_PROFESOR = {
  docente: { label: "Docente", home: "dashboard.html" },
  encargado: { label: "Encargado de Ciclo", home: "aprobaciones.html" },
  jurado: { label: "Jurado", home: "evaluaciones.html" },
};

/** Cambia el contexto activo y navega a su página principal. */
function cambiarContexto(contexto) {
  establecerContextoActivo(contexto);
  window.location.href = CONTEXTOS_PROFESOR[contexto].home;
}

/** Chip fijo, sin menú, para roles sin capacidades extra (Estudiante, Administrador). */
function construirChipSimple(etiqueta) {
  return `<span class="role-chip"><span class="dot" style="background:var(--verde-medio)"></span>${etiqueta}</span>`;
}

/**
 * Arma el selector de contexto para un Profesor: muestra el
 * contexto activo. Si no tiene capacidades extra, se ve como un
 * chip fijo (deshabilitado). Si tiene "encargado" y/o "jurado",
 * se vuelve un menú desplegable para cambiar entre ellos.
 */
function construirSelectorContexto(usuario) {
  const disponibles = ["docente"];
  if (usuario.encargado_de.length > 0) disponibles.push("encargado");
  if (usuario.jurado_de.length > 0) disponibles.push("jurado");

  const activo = disponibles.includes(obtenerContextoActivo()) ? obtenerContextoActivo() : "docente";
  const etiquetaActiva = CONTEXTOS_PROFESOR[activo].label;

  if (disponibles.length === 1) {
    return `
      <span class="role-chip role-chip-deshabilitado" title="No tiene capacidades adicionales">
        <span class="dot" style="background:var(--verde-medio)"></span>${etiquetaActiva}
      </span>`;
  }

  const opciones = disponibles
    .map(
      (contexto) => `
      <a href="#" class="opcion-contexto${contexto === activo ? " activa" : ""}" onclick="cambiarContexto('${contexto}'); return false;">
        ${CONTEXTOS_PROFESOR[contexto].label}
      </a>`
    )
    .join("");

  return `
    <details class="selector-contexto">
      <summary class="role-chip">
        <span class="dot" style="background:var(--verde-medio)"></span>${etiquetaActiva} ▾
      </summary>
      <div class="menu-contexto">${opciones}</div>
    </details>`;
}

/** Arma el chip o selector que le corresponde al usuario según su rol. */
function construirChipsUsuario(usuario) {
  if (usuario.rol === "docente") {
    return construirSelectorContexto(usuario);
  }
  const etiqueta = ETIQUETA_BASE[usuario.rol] || usuario.rol;
  return construirChipSimple(etiqueta);
}

function renderizarBarraSuperior(idContenedor) {
  const elemento = document.getElementById(idContenedor);
  if (!elemento) return;

  const usuario = typeof obtenerUsuario === "function" ? obtenerUsuario() : null;

  elemento.innerHTML = `
    <div class="topbar">
  
          <img src="assets/logos/logosimbolo-blanco.png" alt="Universidad de Cundinamarca" class="logo-topbar">

      ${
        usuario
          ? `<div class="usuario-box">
              <span>${usuario.nombre || usuario.correo || "Usuario"}</span>
              ${construirChipsUsuario(usuario)}
              <button class="btn-salir" onclick="cerrarSesion()">Cerrar sesión</button>
            </div>`
          : ""
      }
    </div>
  `;
}