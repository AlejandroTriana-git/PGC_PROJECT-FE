// ============================================================
// FICHAPGC.JS — HU-05: ficha de solo lectura de un PGC del
// catálogo general. Recibe el id por la URL (?id=...).
//
// Restricción de negocio: esta vista NUNCA debe mostrar nota ni
// comentarios de jurado — el backend confirmó que GET /pgc/:id no
// los incluye en la respuesta (eso es exclusivo de HU-07, con su
// propia autorización), así que aquí no hay nada que ocultar a
// propósito: esos campos simplemente no existen en este JSON.
// ============================================================

/** Arma las categorías como texto simple (ya escapado). */
function nombresCategoriasFicha(categorias) {
  if (!Array.isArray(categorias) || categorias.length === 0) return "Sin categorías";
  return categorias.map((c) => escaparHtml(typeof c === "object" ? c.name_category : c)).join(", ");
}

/** Arma los nombres de integrantes como texto simple (ya escapado). */
function nombresIntegrantesFicha(integrantes) {
  if (!Array.isArray(integrantes) || integrantes.length === 0) return "Solo el líder";
  return integrantes.map((i) => escaparHtml(typeof i === "object" ? i.full_name : i)).join(", ");
}

/**
 * Arma la sección de archivos del PGC. GET /pgc/:id trae
 * archivos: [{ id_file, title_file, desc_file, url_file }],
 * donde url_file es { url, expira_en_segundos } o null si el BE
 * no pudo firmar la URL de ese archivo. Los enlaces se pintan
 * después con renderEnlacePdf (ver pintarEnlacesArchivos).
 */
function seccionArchivosFicha(archivos) {
  if (!Array.isArray(archivos) || archivos.length === 0) {
    return `<p class="text-muted fst-italic mb-0" style="font-size:.85rem;">Este proyecto no tiene archivos cargados.</p>`;
  }
  return `
    <ul class="list-group">
      ${archivos
        .map(
          (a) => `
        <li class="list-group-item">
          <p style="margin:0;font-weight:600;">${escaparHtml(a.title_file)}</p>
          ${a.desc_file ? `<p class="text-muted mb-1" style="font-size:.82rem;white-space:pre-wrap;">${escaparHtml(a.desc_file)}</p>` : ""}
          <div id="enlace-archivo-${a.id_file}"></div>
        </li>`
        )
        .join("")}
    </ul>`;
}

/** Pinta el enlace de cada archivo una vez que la ficha ya está en el DOM. */
function pintarEnlacesArchivos(archivos) {
  (archivos || []).forEach((a) => {
    renderEnlacePdf(
      document.getElementById(`enlace-archivo-${a.id_file}`),
      a.url_file,
      "📄 Ver / descargar"
    );
  });
}

function pintarFicha(p) {
  const contenedor = document.getElementById("contenedor-ficha");

  contenedor.innerHTML = `
    <div class="card-resumen">

      <span class="label">Título</span>
      <h2 style="font-size:1.2rem;font-weight:700;color:var(--verde-udec);">${escaparHtml(p.title_proposal)}</h2>

      <div class="mt-2 mb-3">
        <span class="badge-estado ${p.estado === "Terminado" ? "aprobada" : "pendiente"}">${escaparHtml(p.estado)}</span>
      </div>

      <div style="display:grid;gap:.75rem;">
        <div>
          <span class="label">Ciclo</span>
          <p style="margin:0;">${escaparHtml(p.name_cycle ?? p.id_cycle ?? "—")}</p>
        </div>
        <div>
          <span class="label">Problema</span>
          <p style="margin:0;white-space:pre-wrap;">${escaparHtml(p.problem_proposal)}</p>
        </div>
        <div>
          <span class="label">Justificación</span>
          <p style="margin:0;white-space:pre-wrap;">${escaparHtml(p.justification_proposal)}</p>
        </div>
        <div>
          <span class="label">Objetivos</span>
          <p style="margin:0;white-space:pre-wrap;">${escaparHtml(p.objectives_proposal)}</p>
        </div>
        <div>
          <span class="label">Solución propuesta</span>
          <p style="margin:0;white-space:pre-wrap;">${escaparHtml(p.solution_proposal)}</p>
        </div>
        <div>
          <span class="label">Categorías</span>
          <p style="margin:0;">${nombresCategoriasFicha(p.categorias)}</p>
        </div>
        <div>
          <span class="label">Integrantes</span>
          <p style="margin:0;">${nombresIntegrantesFicha(p.integrantes)}</p>
        </div>
        ${
          p.id_pgc_previous
            ? `<div>
                <span class="label">Continuidad</span>
                <p style="margin:0;"><a href="fichaPgc.html?id=${p.id_pgc_previous}">Ver PGC anterior (ciclo previo) →</a></p>
              </div>`
            : ""
        }
        <div>
          <span class="label">Archivos</span>
          ${seccionArchivosFicha(p.archivos)}
        </div>
      </div>

    </div>
  `;

  pintarEnlacesArchivos(p.archivos);
}

async function inicializarFichaPgc() {
  const contenedor = document.getElementById("contenedor-ficha");
  const id_pgc = new URLSearchParams(window.location.search).get("id");

  if (!id_pgc) {
    contenedor.innerHTML = `<p class="text-muted fst-italic">No se indicó qué proyecto mostrar.</p>`;
    return;
  }

  try {
    const res = await peticionApi(`/pgc/${id_pgc}`);
    if (res.status === 404) {
      contenedor.innerHTML = `<p class="text-muted fst-italic">Ese proyecto no existe.</p>`;
      return;
    }
    if (!res.ok) throw new Error();
    const pgc = await res.json();
    pintarFicha(pgc);
  } catch {
    contenedor.innerHTML = `<p class="text-muted fst-italic">No fue posible cargar la ficha del proyecto.</p>`;
  }
}