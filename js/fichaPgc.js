// ============================================================
// FICHAPGC.JS — HU-05: ficha de solo lectura de un PGC del
// catálogo general. Recibe el id por la URL (?id=...).
//
// Es PÚBLICA (se puede ver sin sesión) y usa el mismo diseño de
// "Mi PGC" / "Mi propuesta": cabecera + descripción a la izquierda +
// datos generales a la derecha, con las piezas de utils.js
// (bloqueCampo, bloqueTexto, listaChips).
//
// Restricción de negocio: esta vista NUNCA debe mostrar nota ni
// comentarios de jurado — el backend confirmó que GET /pgc/:id no
// los incluye en la respuesta (eso es exclusivo de HU-07, con su
// propia autorización), así que aquí no hay nada que ocultar a
// propósito: esos campos simplemente no existen en este JSON.
// ============================================================

/** Textos de las categorías (vienen como objetos { name_category } o como texto). */
function textosCategoriasFicha(categorias) {
  return Array.isArray(categorias) ? categorias.map((c) => (typeof c === "object" ? c.name_category : c)) : [];
}

/** Textos de los integrantes (vienen como objetos { full_name } o como texto). */
function textosIntegrantesFicha(integrantes) {
  return Array.isArray(integrantes) ? integrantes.map((i) => (typeof i === "object" ? i.full_name : i)) : [];
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
          <div id="enlace-archivo-${escaparHtml(a.id_file)}"></div>
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
  const ciclo = p.name_cycle ?? p.id_cycle;
  const texto_ciclo = ciclo === undefined || ciclo === null ? "" : /^\d+$/.test(String(ciclo)) ? `Ciclo ${ciclo}` : String(ciclo);

  document.title = `UDEC PGC — ${p.title_proposal || "Ficha de proyecto"}`;

  contenedor.innerHTML = `
    <div class="pgc-cabecera">
      <span class="label">Proyecto de grado</span>
      <h2>${escaparHtml(p.title_proposal)}</h2>
      <div class="pgc-cabecera-meta">
        ${texto_ciclo ? `<span class="chip-dato">${escaparHtml(texto_ciclo)}</span>` : ""}
        ${p.estado ? `<span class="badge-estado ${p.estado === "Terminado" ? "aprobada" : "pendiente"}">${escaparHtml(p.estado)}</span>` : ""}
      </div>
    </div>

    <div class="row g-4">
      <div class="col-lg-8">
        <h3 class="titulo-seccion">Descripción del proyecto</h3>
        <div class="d-grid gap-3">
          ${bloqueTexto("🧩", "Problema", p.problem_proposal)}
          ${bloqueTexto("💡", "Justificación", p.justification_proposal)}
          ${bloqueTexto("🎯", "Objetivos", p.objectives_proposal)}
          ${bloqueTexto("🛠️", "Solución propuesta", p.solution_proposal)}
        </div>
      </div>
      <div class="col-lg-4">
        <h3 class="titulo-seccion">Datos generales</h3>
        <div class="d-grid gap-3">
          ${bloqueCampo("🏷️", "Categorías", listaChips(textosCategoriasFicha(p.categorias), "Sin categorías"))}
          ${bloqueCampo("👥", "Integrantes", listaChips(textosIntegrantesFicha(p.integrantes), "Solo el líder"))}
          ${
            p.id_pgc_previous
              ? bloqueCampo(
                  "🔗",
                  "Continuidad",
                  `<p class="campo-texto"><a href="fichaPgc.html?id=${encodeURIComponent(p.id_pgc_previous)}">Ver PGC anterior (ciclo previo) →</a></p>`
                )
              : ""
          }
          ${bloqueCampo("📎", "Archivos", seccionArchivosFicha(p.archivos))}
        </div>
      </div>
    </div>
  `;

  pintarEnlacesArchivos(p.archivos);
}

/** "Volver" regresa a la búsqueda con sus filtros si venimos de ahí. */
function prepararEnlaceVolver() {
  const enlace = document.getElementById("enlace-volver");
  if (!enlace) return;
  try {
    const anterior = new URL(document.referrer);
    if (anterior.origin === window.location.origin && anterior.pathname.endsWith("buscarPgc.html")) {
      enlace.href = `buscarPgc.html${anterior.search}`;
    }
  } catch { /* sin referrer: se queda en buscarPgc.html */ }
}

async function inicializarFichaPgc() {
  prepararEnlaceVolver();

  const contenedor = document.getElementById("contenedor-ficha");
  const id_pgc = new URLSearchParams(window.location.search).get("id");

  if (!id_pgc) {
    contenedor.innerHTML = `<p class="text-muted fst-italic">No se indicó qué proyecto mostrar.</p>`;
    return;
  }

  contenedor.innerHTML = `<p class="text-muted fst-italic">Cargando ficha del proyecto...</p>`;

  try {
    const res = await peticionApi(`/pgc/${encodeURIComponent(id_pgc)}`);
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