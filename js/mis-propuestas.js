// ============================================================
// MIS-PROPUESTAS.JS — vista de estado de la propuesta del
// estudiante (HU-09).
// ============================================================

const CLASE_POR_ESTADO = {
  "Pendiente de validación": "pendiente",
  "Aprobada": "aprobada",
  "Rechazada": "rechazada",
  "Anulada": "anulada",
};

/**
 * Carga las categorías de proyecto desde la API y llena el select del
 * formulario de reenvío, preseleccionando la categoría ya guardada.
 * @param {string} categoriaActual - El descr_proposal guardado en la propuesta.
 */
async function pintarCategoriasReenvio(categoriaActual) {
  const select = document.getElementById("re-categoria");
  if (!select) return;

  try {
    const res = await peticionApi("/categorias");
    const categorias = await res.json();

    if (!res.ok || !Array.isArray(categorias) || categorias.length === 0) {
      select.innerHTML = `<option value="" disabled selected>No se pudieron cargar las categorías</option>`;
      return;
    }

    select.innerHTML = categorias
      .map((c) => {
        const seleccionado = c.name_category === categoriaActual ? 'selected' : '';
        return `<option value="${c.name_category}" ${seleccionado}>${c.name_category}</option>`;
      })
      .join("");
  } catch {
    select.innerHTML = `<option value="" disabled selected>Error al cargar categorías</option>`;
  }
}

/** Muestra u oculta el formulario de edición. */
function toggleFormularioReenvio(visible) {
  const form = document.getElementById("form-reenvio");
  const btnAbrir = document.getElementById("btn-abrir-reenvio");
  if (!form || !btnAbrir) return;
  form.classList.toggle("hidden", !visible);
  btnAbrir.classList.toggle("hidden", visible);
}

/**
 * Pinta los checkboxes de integrantes desde la API y marca
 * los que ya pertenecen a la propuesta.
 * @param {Array<number|{id_user:number}>} seleccionados - IDs o objetos de integrantes ya en la propuesta.
 */
async function pintarIntegrantesReenvio(seleccionados) {
  const contenedor = document.getElementById("lista-integrantes-reenvio");
  if (!contenedor) return;

  // Normalizar seleccionados: puede ser array de objetos {id_user} o de números
  const idsSeleccionados = seleccionados.map((s) => (typeof s === "object" ? s.id_user : s));

  try {
    // El BE obtiene el ciclo del estudiante a través del token (no se envía ?ciclo)
    const res = await peticionApi("/estudiantes");
    const estudiantes = await res.json();

    if (!res.ok || !Array.isArray(estudiantes) || estudiantes.length === 0) {
      contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.82rem;">No hay otros estudiantes disponibles en tu ciclo.</p>`;
      return;
    }

    contenedor.innerHTML = estudiantes
      .map((e) => {
        // Mapeo correcto: id_user (no .id), full_name (no .nombre)
        const marcado = idsSeleccionados.includes(e.id_user) ? "checked" : "";
        return `
          <div class="form-check">
            <input class="form-check-input" type="checkbox" value="${e.id_user}" id="ri-${e.id_user}" ${marcado}>
            <label class="form-check-label" for="ri-${e.id_user}">${e.full_name}</label>
          </div>`;
      })
      .join("");

    // Guardamos la lista en el DOM para poder leerla al hacer submit.
    contenedor.dataset.estudiantes = JSON.stringify(estudiantes);
  } catch {
    contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.82rem;">No fue posible cargar los integrantes.</p>`;
  }
}

async function inicializarMiPropuesta() {
  const usuario = obtenerUsuario();
  const contenedor = document.getElementById("contenedor-propuesta");

  // ── Carga la propuesta desde la API ──────────────────────────
  let propuesta;
  try {
    const res = await peticionApi("/propuestas/mia");
    if (res.status === 404) {
      contenedor.innerHTML = `<p class="text-muted fst-italic">Todavía no has radicado ninguna propuesta.</p>`;
      return;
    }
    if (!res.ok) throw new Error("Error al cargar la propuesta.");
    propuesta = await res.json();
  } catch (e) {
    contenedor.innerHTML = `<p class="text-muted fst-italic">No fue posible cargar tu propuesta. Intenta recargar la página.</p>`;
    return;
  }

  const claseEstado = CLASE_POR_ESTADO[propuesta.estado] || "pendiente";
  // Usar id_leader (no id_lider) tal como lo devuelve el BE
  const esLider = usuario && usuario.id === propuesta.id_leader;
  const puedeReenviar = esLider && propuesta.estado === "Rechazada";
  const reenviosRestantes = 3 - (propuesta.resubmit_count || 0);

  // Mapa legible de categoría
  const CATEGORIAS = {
    investigacion:  "Investigación",
    desarrollo:     "Desarrollo tecnológico",
    social:         "Proyección social",
    emprendimiento: "Emprendimiento",
  };
  const categoriaTexto = CATEGORIAS[propuesta.descr_proposal] || propuesta.descr_proposal || "—";

  // Nombres de integrantes: el BE ahora devuelve [{id_user, full_name}]
  const nombresIntegrantes = Array.isArray(propuesta.integrantes) && propuesta.integrantes.length > 0
    ? propuesta.integrantes
        .map((i) => (typeof i === "object" ? i.full_name : `#${i}`))
        .join(", ")
    : "Solo el líder";

  contenedor.innerHTML = `
    <div class="card-resumen">

      <!-- Encabezado: título + estado -->
      <span class="label">Título</span>
      <h2 style="font-size:1.2rem;font-weight:700;color:var(--verde-udec);">${propuesta.titulo}</h2>

      <div class="mt-2 mb-3">
        <span class="badge-estado ${claseEstado}">${propuesta.estado}</span>
        ${propuesta.resubmit_count > 0
          ? `<span class="text-muted ms-2" style="font-size:.8rem;">Reenvíos realizados: ${propuesta.resubmit_count} de 3</span>`
          : ""}
      </div>

      ${propuesta.estado === "Rechazada"
        ? `<div class="banner error" style="margin-top:.5rem;margin-bottom:1rem;">
             <span><strong>Motivo del rechazo:</strong> ${propuesta.comentario}</span>
           </div>`
        : ""}

      <!-- Detalle completo de la propuesta -->
      <div style="display:grid;gap:.75rem;margin-bottom:1rem;">

        <div>
          <span class="label">Categoría / Tipo</span>
          <p style="margin:0;">${categoriaTexto}</p>
        </div>

        <div>
          <span class="label">Líder</span>
          <p style="margin:0;">${propuesta.leader_name || "—"}</p>
        </div>

        <div>
          <span class="label">Integrantes</span>
          <p style="margin:0;">${nombresIntegrantes}</p>
        </div>

        <div>
          <span class="label">Problema</span>
          <p style="margin:0;white-space:pre-wrap;">${propuesta.problem_proposal || "—"}</p>
        </div>

        <div>
          <span class="label">Justificación</span>
          <p style="margin:0;white-space:pre-wrap;">${propuesta.justification_proposal || "—"}</p>
        </div>

        <div>
          <span class="label">Objetivos</span>
          <p style="margin:0;white-space:pre-wrap;">${propuesta.objectives_proposal || "—"}</p>
        </div>

        <div>
          <span class="label">Solución propuesta</span>
          <p style="margin:0;white-space:pre-wrap;">${propuesta.solution_proposal || "—"}</p>
        </div>

      </div>

      <!-- Enlace al PDF con nota de expiración -->
      <div id="mis-pdf-contenedor" class="mt-2"></div>

      ${puedeReenviar
        ? `<!-- Botón para desplegar el formulario -->
           <button id="btn-abrir-reenvio" class="btn btn-primary mt-3"
                   onclick="toggleFormularioReenvio(true)">
             ✏️ Editar y reenviar
           </button>

           <!-- Banner de resultado del reenvío -->
           <div id="banner-reenvio" class="banner hidden" style="margin-top:1rem;"></div>

           <!-- Formulario de edición (inicialmente oculto) -->
           <form id="form-reenvio" class="row g-3 hidden" style="margin-top:1.2rem;" novalidate>

             <div class="col-12">
               <p class="text-muted" style="font-size:.82rem;margin-bottom:.25rem;">
                 Reenvíos restantes: <strong>${reenviosRestantes}</strong> de 3.
                 Corrige los campos observados y adjunta el PDF actualizado.
               </p>
             </div>

             <div class="col-12">
               <label for="re-titulo" class="form-label">Título del proyecto</label>
               <input type="text" class="form-control" id="re-titulo"
                      value="${propuesta.titulo}">
             </div>

             <div class="col-12">
               <label for="re-categoria" class="form-label">Tipo de proyecto / Categoría</label>
               <select class="form-select" id="re-categoria">
                 <option value="" disabled selected>Cargando categorías…</option>
               </select>
             </div>

             <div class="col-12">
               <label for="re-problema" class="form-label">Problema</label>
               <textarea class="form-control" id="re-problema" rows="3">${propuesta.problem_proposal}</textarea>
             </div>

             <div class="col-12">
               <label for="re-justificacion" class="form-label">Justificación</label>
               <textarea class="form-control" id="re-justificacion" rows="3">${propuesta.justification_proposal}</textarea>
             </div>

             <div class="col-12">
               <label for="re-objetivos" class="form-label">Objetivos</label>
               <textarea class="form-control" id="re-objetivos" rows="3">${propuesta.objectives_proposal}</textarea>
             </div>

             <div class="col-12">
               <label for="re-solucion" class="form-label">Solución propuesta</label>
               <textarea class="form-control" id="re-solucion" rows="3">${propuesta.solution_proposal}</textarea>
             </div>

             <div class="col-12">
               <label class="form-label">Integrantes</label>
               <div id="lista-integrantes-reenvio" class="border rounded p-3">
                 <span class="text-muted fst-italic" style="font-size:.82rem;">Cargando integrantes…</span>
               </div>
               <div class="form-text">Solo se muestran estudiantes de tu mismo ciclo.</div>
             </div>

             <div class="col-12">
               <label for="re-pdf" class="form-label">Documento PDF actualizado</label>
               <input type="file" class="form-control" id="re-pdf" accept="application/pdf">
               <div class="form-text">Solo archivos .pdf, máximo 10 MB.</div>
             </div>

             <div class="col-12 d-flex gap-2 flex-wrap">
               <button type="submit" class="btn btn-primary" id="btn-reenviar">Reenviar propuesta</button>
               <button type="button" class="btn btn-outline-secondary"
                       onclick="toggleFormularioReenvio(false)">Cancelar</button>
             </div>

           </form>`
        : ""}
    </div>
  `;

  // Renderizar el enlace del PDF con nota de expiración.
  renderEnlacePdf(
    document.getElementById("mis-pdf-contenedor"),
    propuesta.pdf   // { url, "expira-en-segundos": 3600 }
  );

  // Cargar integrantes, categorías y conectar el submit solo si aplica.
  if (puedeReenviar) {
    pintarIntegrantesReenvio(propuesta.integrantes || []);
    pintarCategoriasReenvio(propuesta.descr_proposal || "");
    document.getElementById("form-reenvio").addEventListener("submit", (ev) =>
      manejarReenvio(ev, propuesta)
    );
  }
}

/** Valida y envía el formulario de reenvío contra PUT /propuestas/:id. */
async function manejarReenvio(evento, propuesta) {
  evento.preventDefault();
  ocultarBanner("banner-reenvio");

  const titulo        = document.getElementById("re-titulo").value.trim();
  const categoria     = document.getElementById("re-categoria").value;
  const problema      = document.getElementById("re-problema").value.trim();
  const justificacion = document.getElementById("re-justificacion").value.trim();
  const objetivos     = document.getElementById("re-objetivos").value.trim();
  const solucion      = document.getElementById("re-solucion").value.trim();
  const archivoPdf    = document.getElementById("re-pdf").files[0];

  // Leer los integrantes marcados desde los checkboxes generados dinámicamente.
  const contenedorIntegrantes = document.getElementById("lista-integrantes-reenvio");
  const estudiantesDisponibles = JSON.parse(contenedorIntegrantes.dataset.estudiantes || "[]");
  // Usar id_user (no .id) para identificar integrantes
  const integrantes = estudiantesDisponibles
    .filter((e) => document.getElementById(`ri-${e.id_user}`)?.checked)
    .map((e) => e.id_user);

  // ── Validaciones ───────────────────────────────────────────
  if (!titulo || !categoria || !problema || !justificacion || !objetivos || !solucion) {
    mostrarBanner("banner-reenvio", "error", "Debes completar todos los campos.");
    return;
  }
  if (!archivoPdf) {
    mostrarBanner("banner-reenvio", "error", "Debes adjuntar el PDF actualizado de la propuesta.");
    return;
  }
  if (archivoPdf.type !== "application/pdf") {
    mostrarBanner("banner-reenvio", "error", "El archivo debe ser un PDF.");
    return;
  }
  const tamanoMB = archivoPdf.size / (1024 * 1024);
  if (tamanoMB > 10) {
    mostrarBanner("banner-reenvio", "error", "El PDF no debe superar 10 MB.");
    return;
  }

  const boton = document.getElementById("btn-reenviar");
  boton.disabled = true;
  boton.textContent = "Reenviando...";

  try {
    const fd = new FormData();
    // Nombres de campo tal como los espera el BE
    fd.append("title_proposal",           titulo);
    fd.append("descr_proposal",           categoria);
    fd.append("problem_proposal",         problema);
    fd.append("justification_proposal",   justificacion);
    fd.append("objectives_proposal",      objetivos);
    fd.append("solution_proposal",        solucion);
    fd.append("integrantes",              JSON.stringify(integrantes));
    fd.append("pdf", archivoPdf);

    // PATCH /propuestas/:id/reenviar (no PUT /propuestas/:id)
    // Usar id_proposal (no .id) tal como lo devuelve el BE
    const res = await peticionApi(`/propuestas/${propuesta.id_proposal}/reenviar`, { method: "PATCH", body: fd });
    const json = await res.json().catch(() => ({}));

    mostrarBanner(
      "banner-reenvio",
      res.ok ? "success" : "error",
      json.mensaje || (res.ok ? "Propuesta reenviada correctamente." : "No fue posible reenviar la propuesta.")
    );

    if (res.ok) {
      // Bug 4: re-renderizar la sección completa para reflejar el nuevo estado
      // "Pendiente de validación" sin necesidad de cambiar de menú.
      await inicializarMiPropuesta();
    }
  } catch {
    mostrarBanner("banner-reenvio", "error", "No fue posible conectar con el servidor.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Reenviar propuesta";
  }
}