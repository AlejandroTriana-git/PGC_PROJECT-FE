// ============================================================
// CALIFICADO.JS — HU-07: PGC que el jurado logueado ya calificó.
//
// Antes este archivo era una copia de aprobaciones.js: buscaba
// #tabla-propuestas (que no existe en calificado.html) y la página
// llamaba a inicializarCalificados(), que no existía. Por eso la
// tabla salía vacía.
//
// Ruta del backend:
//   GET /pgc/calificados-por-mi → [{ id_pgc, id_cycle, state_pgc,
//     title_proposal, name_cycle, leader_name, grade, comment, graded_at }]
// ============================================================

let pgc_calificados = [];

/** Nota con un decimal (4 → "4.0"); "—" si no es un número. */
function formatearNotaCalificado(nota) {
  const numero = Number(nota);
  return Number.isNaN(numero) ? "—" : numero.toFixed(1);
}

/** Fecha corta en español ("12 oct 2026"); "" si no se puede leer. */
function formatearFechaCalificado(valor) {
  if (!valor) return "";
  const fecha = new Date(String(valor).replace(" ", "T"));
  return Number.isNaN(fecha.getTime())
    ? ""
    : fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function pintarTablaCalificados() {
  const cuerpo = document.getElementById("tabla-calificados");

  if (pgc_calificados.length === 0) {
    cuerpo.innerHTML = `<tr><td colspan="5" class="text-muted fst-italic">Todavía no has calificado ningún PGC.</td></tr>`;
    return;
  }

  cuerpo.innerHTML = pgc_calificados
    .map((pgc) => {
      const fecha = formatearFechaCalificado(pgc.graded_at);
      return `
      <tr>
        <td>
          <a href="fichaPgc.html?id=${encodeURIComponent(pgc.id_pgc)}" class="titulo-resultado">${escaparHtml(pgc.title_proposal)}</a>
          ${fecha ? `<div class="text-muted" style="font-size:.75rem;">Calificado el ${escaparHtml(fecha)}</div>` : ""}
        </td>
        <td>${escaparHtml(pgc.leader_name || "—")}</td>
        <td>${escaparHtml(pgc.name_cycle ?? pgc.id_cycle ?? "—")}</td>
        <td><span class="badge-estado aprobada">${escaparHtml(formatearNotaCalificado(pgc.grade))} / 5.0</span></td>
        <td style="white-space:pre-wrap;max-width:420px;">${escaparHtml(pgc.comment || "—")}</td>
      </tr>`;
    })
    .join("");
}

async function inicializarCalificados() {
  const cuerpo = document.getElementById("tabla-calificados");
  cuerpo.innerHTML = `<tr><td colspan="5" class="text-muted fst-italic">Cargando...</td></tr>`;

  try {
    const res = await peticionApi("/pgc/calificados-por-mi");
    if (!res.ok) throw new Error();
    const datos = await res.json();
    pgc_calificados = Array.isArray(datos) ? datos : [];
  } catch {
    pgc_calificados = [];
    mostrarBanner("banner", "error", "No fue posible cargar los PGC calificados. Intenta recargar la página.");
  }

  pintarTablaCalificados();
}