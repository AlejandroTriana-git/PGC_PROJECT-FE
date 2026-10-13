// ============================================================
// CALIFICADOS.JS — lista de solo lectura de los PGC que este
// jurado ya calificó, con su nota y comentario.
//
// Endpoint asumido: GET /pgc/graded-by-me — no estaba confirmado
// con backend todavía, es parte de lo que falta pedirles.
// ============================================================

async function inicializarCalificados() {
  const cuerpo = document.getElementById("tabla-calificados");

  try {
    const res = await peticionApi("/pgc/graded-by-me");
    if (!res.ok) throw new Error();
    const calificados = await res.json();

    if (!Array.isArray(calificados) || calificados.length === 0) {
      cuerpo.innerHTML = `<tr><td colspan="5" class="text-muted fst-italic">Todavía no has calificado ningún PGC.</td></tr>`;
      return;
    }

    cuerpo.innerHTML = calificados
      .map(
        (pgc) => `
        <tr>
          <td>${escaparHtml(pgc.title_proposal)}</td>
          <td>${escaparHtml(pgc.leader_name)}</td>
          <td>${escaparHtml(pgc.name_cycle ?? pgc.id_cycle ?? "—")}</td>
          <td><strong>${escaparHtml(pgc.grade)}</strong></td>
          <td style="max-width:320px;">${escaparHtml(pgc.comment)}</td>
        </tr>`
      )
      .join("");
  } catch {
    mostrarBanner("banner", "error", "No fue posible cargar tus calificaciones. Intenta recargar la página.");
  }
}