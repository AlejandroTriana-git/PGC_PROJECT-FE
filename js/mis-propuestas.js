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
 */
async function pintarIntegrantesReenvio(seleccionados) {
  const contenedor = document.getElementById("lista-integrantes-reenvio");
  if (!contenedor) return;

  try {
    const res = await peticionApi("/estudiantes?ciclo=mismo");
    const estudiantes = await res.json();

    if (!res.ok || !Array.isArray(estudiantes) || estudiantes.length === 0) {
      contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.82rem;">No hay otros estudiantes disponibles en tu ciclo.</p>`;
      return;
    }

    contenedor.innerHTML = estudiantes
      .map((e) => {
        const marcado = seleccionados.includes(e.id) ? "checked" : "";
        return `
          <div class="form-check">
            <input class="form-check-input" type="checkbox" value="${e.id}" id="ri-${e.id}" ${marcado}>
            <label class="form-check-label" for="ri-${e.id}">${e.nombre}</label>
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
  const esLider = usuario && usuario.id === propuesta.id_lider;
  const puedeReenviar = esLider && propuesta.estado === "Rechazada";
  const reenviosRestantes = 3 - (propuesta.resubmit_count || 0);

  contenedor.innerHTML = `
    <div class="card-resumen">
      <span class="label">Título</span>
      <h2 style="font-size:1.2rem;font-weight:700;color:var(--verde-udec);">${propuesta.titulo}</h2>

      <div class="mt-2 mb-2">
        <span class="badge-estado ${claseEstado}">${propuesta.estado}</span>
        ${propuesta.resubmit_count > 0
          ? `<span class="text-muted ms-2" style="font-size:.8rem;">Reenvíos: ${propuesta.resubmit_count} de 3</span>`
          : ""}
      </div>

      ${propuesta.estado === "Rechazada"
        ? `<div class="banner error" style="margin-top:.5rem;">
             <span>${propuesta.comentario}</span>
           </div>`
        : ""}

      <!-- Enlace al PDF con nota de expiración -->
      <div id="mis-pdf-contenedor" class="mt-2"></div>

      ${puedeReenviar
        ? `<!-- Botón para desplegar el formulario -->
           <button id="btn-abrir-reenvio" class="btn btn-primary mt-2"
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
                 <option value="investigacion"  ${propuesta.categoria === 'investigacion'  ? 'selected' : ''}>Investigación</option>
                 <option value="desarrollo"     ${propuesta.categoria === 'desarrollo'     ? 'selected' : ''}>Desarrollo tecnológico</option>
                 <option value="social"         ${propuesta.categoria === 'social'         ? 'selected' : ''}>Proyección social</option>
                 <option value="emprendimiento" ${propuesta.categoria === 'emprendimiento' ? 'selected' : ''}>Emprendimiento</option>
               </select>
             </div>

             <div class="col-12">
               <label for="re-problema" class="form-label">Problema</label>
               <textarea class="form-control" id="re-problema" rows="3">${propuesta.problema}</textarea>
             </div>

             <div class="col-12">
               <label for="re-justificacion" class="form-label">Justificación</label>
               <textarea class="form-control" id="re-justificacion" rows="3">${propuesta.justificacion}</textarea>
             </div>

             <div class="col-12">
               <label for="re-objetivos" class="form-label">Objetivos</label>
               <textarea class="form-control" id="re-objetivos" rows="3">${propuesta.objetivos}</textarea>
             </div>

             <div class="col-12">
               <label for="re-solucion" class="form-label">Solución propuesta</label>
               <textarea class="form-control" id="re-solucion" rows="3">${propuesta.solucion}</textarea>
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

  // Cargar integrantes y conectar el submit solo si aplica.
  if (puedeReenviar) {
    pintarIntegrantesReenvio(propuesta.integrantes || []);
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
  const integrantes = estudiantesDisponibles
    .filter((e) => document.getElementById(`ri-${e.id}`)?.checked)
    .map((e) => e.id);

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
    fd.append("titulo", titulo);
    fd.append("categoria", categoria);
    fd.append("problema", problema);
    fd.append("justificacion", justificacion);
    fd.append("objetivos", objetivos);
    fd.append("solucion", solucion);
    fd.append("integrantes", JSON.stringify(integrantes));
    fd.append("pdf", archivoPdf);

    const res = await peticionApi(`/propuestas/${propuesta.id}`, { method: "PUT", body: fd });
    const json = await res.json().catch(() => ({}));

    mostrarBanner(
      "banner-reenvio",
      res.ok ? "success" : "error",
      json.mensaje || (res.ok ? "Propuesta reenviada correctamente." : "No fue posible reenviar la propuesta.")
    );

    if (res.ok) toggleFormularioReenvio(false);
  } catch {
    mostrarBanner("banner-reenvio", "error", "No fue posible conectar con el servidor.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Reenviar propuesta";
  }
}