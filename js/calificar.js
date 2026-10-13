// ============================================================
// CALIFICAR.JS — HU nueva Sprint 5: calificación de PGC por
// jurado. Nota 0.0–5.0 (la columna jury_grades.grade permite
// hasta 9.9, pero la escala real del programa es sobre 5.0 —
// validado aquí en el cliente; confirmar con backend si también
// lo validan del lado del servidor).
//
// Al abrir el modal se pide la ficha completa (GET /pgc/:id_pgc,
// la misma de HU-05) + los archivos de evidencia (GET /pgc/:id_pgc/files)
// + el PDF de la propuesta original (GET /propuestas/:id_proposal/pdf).
// Este último depende de que la ficha incluya id_proposal — si
// backend todavía no lo agrega, esa sección se omite sin romper
// el resto (ver pintarDetallePgc).
// ============================================================

const ETAPA_CALIFICACION = "Calificación"; // literal exacto del ENUM, con tilde
const NOTA_MAXIMA = 5;

let pgc_pendientes = [];
let pgc_seleccionado = null;
let modal_calificar = null;

const cache_fechas_por_ciclo = {};

/** Trae (o reutiliza de caché) las fechas de un ciclo. */
async function obtenerFechasCiclo(id_cycle) {
  if (cache_fechas_por_ciclo[id_cycle] !== undefined) return cache_fechas_por_ciclo[id_cycle];
  try {
    const res = await peticionApi(`/ciclos/${id_cycle}/fechas`);
    cache_fechas_por_ciclo[id_cycle] = res.ok ? await res.json() : [];
  } catch {
    cache_fechas_por_ciclo[id_cycle] = [];
  }
  return cache_fechas_por_ciclo[id_cycle];
}

/** Devuelve el motivo de bloqueo para calificar este PGC, o null si se puede. */
async function obtenerBloqueoCalificacion(pgc) {
  if (pgc.ya_calificado) return "Ya calificaste este PGC.";

  const filas_fecha = await obtenerFechasCiclo(pgc.id_cycle);
  const fila = filas_fecha.find((f) => f.stage === ETAPA_CALIFICACION);
  if (!fila) return "El periodo de calificación todavía no ha sido configurado para este ciclo.";

  const ahora = new Date();
  if (ahora < new Date(fila.start_date) || ahora > new Date(fila.end_date)) {
    return `Fuera del periodo de calificación (habilitado del ${fila.start_date} al ${fila.end_date}).`;
  }
  return null;
}

async function pintarTablaCalificar() {
  const cuerpo = document.getElementById("tabla-calificar");

  if (pgc_pendientes.length === 0) {
    cuerpo.innerHTML = `<tr><td colspan="4" class="text-muted fst-italic">No tienes PGC pendientes por calificar.</td></tr>`;
    return;
  }

  cuerpo.innerHTML = pgc_pendientes
    .map(
      (pgc) => `
      <tr id="fila-pgc-${pgc.id_pgc}">
        <td>${escaparHtml(pgc.title_proposal)}</td>
        <td>${escaparHtml(pgc.leader_name)}</td>
        <td>${escaparHtml(pgc.name_cycle ?? pgc.id_cycle ?? "—")}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="abrirCalificacion(${pgc.id_pgc})">Calificar</button>
        </td>
      </tr>`
    )
    .join("");

  for (const pgc of pgc_pendientes) {
    const motivo = await obtenerBloqueoCalificacion(pgc);
    if (motivo) {
      const fila = document.getElementById(`fila-pgc-${pgc.id_pgc}`);
      const boton = fila ? fila.querySelector("button") : null;
      if (boton) {
        boton.disabled = true;
        boton.title = motivo;
        boton.textContent = "No disponible";
      }
    }
  }
}

/** Arma categorías/integrantes como texto simple (ya escapado). */
function nombresCategoriasCalificar(categorias) {
  if (!Array.isArray(categorias) || categorias.length === 0) return "Sin categorías";
  return categorias.map((c) => escaparHtml(typeof c === "object" ? c.name_category : c)).join(", ");
}
function nombresIntegrantesCalificar(integrantes) {
  if (!Array.isArray(integrantes) || integrantes.length === 0) return "Solo el líder";
  return integrantes.map((i) => escaparHtml(typeof i === "object" ? i.full_name : i)).join(", ");
}

/**
 * Pinta el detalle completo del PGC dentro del modal: datos de la
 * propuesta, archivos de la propuesta (PDF original) y archivos
 * de evidencia del PGC — las dos secciones de archivos que pidió
 * el líder, claramente separadas.
 */
function pintarDetallePgc(ficha, archivos_pgc) {
  const contenedor = document.getElementById("cuerpo-detalle-pgc");

  contenedor.innerHTML = `
    <div style="display:grid;gap:.75rem;margin-bottom:1rem;">
      <div>
        <span class="label">Problema</span>
        <p style="margin:0;white-space:pre-wrap;">${escaparHtml(ficha.problem_proposal)}</p>
      </div>
      <div>
        <span class="label">Justificación</span>
        <p style="margin:0;white-space:pre-wrap;">${escaparHtml(ficha.justification_proposal)}</p>
      </div>
      <div>
        <span class="label">Objetivos</span>
        <p style="margin:0;white-space:pre-wrap;">${escaparHtml(ficha.objectives_proposal)}</p>
      </div>
      <div>
        <span class="label">Solución propuesta</span>
        <p style="margin:0;white-space:pre-wrap;">${escaparHtml(ficha.solution_proposal)}</p>
      </div>
      <div>
        <span class="label">Categorías</span>
        <p style="margin:0;">${nombresCategoriasCalificar(ficha.categorias)}</p>
      </div>
      <div>
        <span class="label">Integrantes</span>
        <p style="margin:0;">${nombresIntegrantesCalificar(ficha.integrantes)}</p>
      </div>
    </div>

    <h3 style="font-size:.9rem;font-weight:700;color:var(--verde-udec);">Documento de la propuesta</h3>
    <div id="calificar-pdf-propuesta" class="mb-3">
      <span class="text-muted fst-italic" style="font-size:.82rem;">No disponible.</span>
    </div>

    <h3 style="font-size:.9rem;font-weight:700;color:var(--verde-udec);">Evidencias de avance (PGC)</h3>
    <div id="calificar-archivos-pgc">
      ${
        archivos_pgc.length === 0
          ? `<p class="text-muted fst-italic" style="font-size:.82rem;">No se han subido evidencias.</p>`
          : `<ul class="list-group">
              ${archivos_pgc.map((a, i) => `<li class="list-group-item" id="calificar-archivo-${i}"></li>`).join("")}
            </ul>`
      }
    </div>
  `;

  archivos_pgc.forEach((archivo, i) => {
    renderEnlacePdf(
      document.getElementById(`calificar-archivo-${i}`),
      archivo.url_file,
      `📎 ${escaparHtml(archivo.title_file || "Archivo")}`
    );
  });

  // El PDF de la propuesta depende de que la ficha traiga id_proposal.
  // Mientras backend no lo agregue (pendiente, Issue 10), esta sección
  // se queda en "No disponible" sin romper el resto del modal.
  if (ficha.id_proposal) {
    peticionApi(`/propuestas/${ficha.id_proposal}/pdf`)
      .then((res) => (res.ok ? res.json() : null))
      .then((pdf) => {
        if (pdf) renderEnlacePdf(document.getElementById("calificar-pdf-propuesta"), pdf, "📄 Ver documento PDF");
      })
      .catch(() => {});
  }
}

async function abrirCalificacion(id_pgc) {
  pgc_seleccionado = pgc_pendientes.find((p) => p.id_pgc === id_pgc);
  if (!pgc_seleccionado) return;

  document.getElementById("calificar-titulo").textContent = pgc_seleccionado.title_proposal;
  document.getElementById("cuerpo-detalle-pgc").innerHTML = `<p class="text-muted fst-italic">Cargando información del PGC...</p>`;
  document.getElementById("input-nota").value = "";
  document.getElementById("input-comentario").value = "";
  ocultarBanner("banner-modal-calificar");
  modal_calificar.show();

  try {
    const [res_ficha, res_archivos] = await Promise.all([
      peticionApi(`/pgc/${id_pgc}`),
      peticionApi(`/pgc/${id_pgc}/files`),
    ]);
    const ficha = res_ficha.ok ? await res_ficha.json() : null;
    const archivos_pgc = res_archivos.ok ? await res_archivos.json() : [];

    if (!ficha) {
      document.getElementById("cuerpo-detalle-pgc").innerHTML = `<p class="text-muted fst-italic">No fue posible cargar la información del PGC.</p>`;
      return;
    }
    pintarDetallePgc(ficha, archivos_pgc);
  } catch {
    document.getElementById("cuerpo-detalle-pgc").innerHTML = `<p class="text-muted fst-italic">No fue posible cargar la información del PGC.</p>`;
  }
}

async function inicializarCalificar() {
  modal_calificar = new bootstrap.Modal(document.getElementById("modal-calificar"));

  try {
    const res = await peticionApi("/pgc/pending-grading");
    if (!res.ok) throw new Error();
    pgc_pendientes = await res.json();
  } catch {
    mostrarBanner("banner", "error", "No fue posible cargar los PGC pendientes. Intenta recargar la página.");
    pgc_pendientes = [];
  }

  await pintarTablaCalificar();

  document.getElementById("btn-guardar-nota").addEventListener("click", async () => {
    ocultarBanner("banner-modal-calificar");

    const nota = document.getElementById("input-nota").value;
    const comentario = document.getElementById("input-comentario").value.trim();

    if (nota === "" || Number(nota) < 0 || Number(nota) > NOTA_MAXIMA) {
      mostrarBanner("banner-modal-calificar", "error", `La calificación debe estar entre 0.0 y ${NOTA_MAXIMA.toFixed(1)}.`);
      return;
    }
    if (!comentario) {
      mostrarBanner("banner-modal-calificar", "error", "Debes escribir un comentario de retroalimentación.");
      return;
    }

    const boton = document.getElementById("btn-guardar-nota");
    boton.disabled = true;
    boton.textContent = "Guardando...";

    try {
      const res = await peticionApi(`/pgc/${pgc_seleccionado.id_pgc}/grade`, {
        method: "POST",
        body: JSON.stringify({ grade: Number(nota), comment: comentario }),
      });
      const datos = await res.json().catch(() => ({}));

      if (!res.ok) {
        mostrarBanner("banner-modal-calificar", "error", datos.mensaje || "No fue posible guardar la calificación.");
        return;
      }

      mostrarBanner("banner", "success", datos.mensaje || `Calificación guardada para "${pgc_seleccionado.title_proposal}".`);
      pgc_pendientes = pgc_pendientes.filter((p) => p.id_pgc !== pgc_seleccionado.id_pgc);
      await pintarTablaCalificar();
      modal_calificar.hide();
    } catch {
      mostrarBanner("banner-modal-calificar", "error", "No fue posible conectar con el servidor.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Guardar calificación";
    }
  });
}