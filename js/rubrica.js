// ============================================================
// RUBRICA.JS — rúbricas de calificación por ciclo. Las lee cualquier
// miembro del ciclo y solo las sube/actualiza el Encargado de ESE
// ciclo (capacidad encargado_de, no un rol). La seguridad real la
// aplica backend (autorizarEncargadoDeCiclo); aquí solo se decide
// qué mostrar. Toda la lógica de lista, historial y subida vive en
// components/listaDocumento.js.
// ============================================================

// Literal exacto del ENUM cycle_documents.doc_type (con tilde).
const TIPO_RUBRICA = "Rúbrica";

let ciclo_actual = null;
let lista_rubrica = null;

/** Ciclos cuyas rúbricas puede consultar este usuario, según rol y contexto activo. */
function obtenerCiclosConsultables(usuario) {
  if (usuario.rol === "estudiante") return usuario.id_cycle ? [usuario.id_cycle] : [];
  if (usuario.rol === "profesor") {
    return obtenerContextoActivo() === "jurado" ? usuario.jurado_de : usuario.encargado_de;
  }
  return [];
}

/** Solo el Encargado de ese ciclo, en su contexto de encargado, ve los controles de edición. */
function puedeEditarRubrica(usuario) {
  return (
    usuario.rol === "profesor" &&
    obtenerContextoActivo() === "encargado" &&
    usuario.encargado_de.includes(ciclo_actual)
  );
}

/** Si hay un solo ciclo lo muestra como título; si hay varios, un selector. */
function pintarSelectorCiclo(ciclos) {
  const zona = document.getElementById("zona-ciclo");

  if (ciclos.length === 1) {
    zona.innerHTML = `<p class="mb-0"><strong>Ciclo ${escaparHtml(ciclos[0])}</strong></p>`;
    return;
  }

  zona.innerHTML = `
    <label for="selector-ciclo" class="form-label">Ciclo</label>
    <select id="selector-ciclo" class="form-select" style="max-width:220px;">
      ${ciclos.map((id) => `<option value="${escaparHtml(id)}">Ciclo ${escaparHtml(id)}</option>`).join("")}
    </select>`;

  document.getElementById("selector-ciclo").addEventListener("change", (evento) => {
    ciclo_actual = Number(evento.target.value);
    ocultarBanner("banner");
    lista_rubrica.recargar();
  });
}

function inicializarRubrica() {
  const usuario = obtenerUsuario();
  const ciclos = obtenerCiclosConsultables(usuario);

  if (ciclos.length === 0) {
    document.getElementById("contenedor-documento").innerHTML =
      `<p class="text-muted fst-italic">No tienes un ciclo asignado para consultar rúbricas.</p>`;
    return;
  }

  ciclo_actual = Number(ciclos[0]);

  lista_rubrica = crearListaDocumento({
    idContenedor: "contenedor-documento",
    idBanner: "banner",
    textoVacio: "Este ciclo todavía no tiene rúbricas publicadas.",
    puedeEditar: () => puedeEditarRubrica(usuario),
    rutaLista: () => `/ciclos/${ciclo_actual}/documentos?tipo=${encodeURIComponent(TIPO_RUBRICA)}`,
    rutaSubir: () => `/ciclos/${ciclo_actual}/documentos/rubrica`,
    rutaHistorial: (titulo) =>
      `/ciclos/${ciclo_actual}/documentos/${encodeURIComponent(titulo)}/historial?tipo=${encodeURIComponent(TIPO_RUBRICA)}`,
  });

  pintarSelectorCiclo(ciclos);
  lista_rubrica.recargar();
}