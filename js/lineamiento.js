// ============================================================
// LINEAMIENTO.JS — lineamientos institucionales (HU-11). Hay UN solo
// conjunto de lineamientos, compartido por los 3 ciclos (tabla
// guideline_documents, sin id_cycle). Los lee cualquier usuario con
// sesión y solo los publica o actualiza el Administrador. Toda la
// lógica de lista, historial y subida vive en
// components/listaDocumento.js, la misma que usa rubrica.html.
// ============================================================

function inicializarLineamiento() {
  const usuario = obtenerUsuario();

  const lista_lineamiento = crearListaDocumento({
    idContenedor: "contenedor-documento",
    idBanner: "banner",
    textoVacio: "Todavía no hay lineamientos publicados.",
    puedeEditar: () => usuario.rol === "administrador",
    rutaLista: () => "/lineamientos",
    rutaSubir: () => "/lineamientos",
    rutaHistorial: (titulo) => `/lineamientos/${encodeURIComponent(titulo)}/historial`,
  });

  lista_lineamiento.recargar();
}