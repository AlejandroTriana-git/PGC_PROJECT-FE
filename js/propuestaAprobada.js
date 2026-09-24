// ============================================================
// PROPUESTAAPROBADA.JS — HU-02: listado de propuestas aprobadas
// sin PGC registrado + modal de confirmación de registro.
// ============================================================

// Arreglo con las propuestas aprobadas cargadas desde la API.
// Se guarda aquí para no volver a pedirlas al abrir el modal.
let propuestas_aprobadas = [];
let propuesta_seleccionada = null;
let modal_registro = null;

/** Arma las etiquetas de categorías de una propuesta como texto simple. */
function nombresCategorias(categorias) {
  if (!Array.isArray(categorias) || categorias.length === 0) return "Sin categorías";
  return categorias.map((c) => (typeof c === "object" ? c.name_category : c)).join(", ");
}

/** Arma los nombres de integrantes de una propuesta como texto simple. */
function nombresIntegrantes(integrantes) {
  if (!Array.isArray(integrantes) || integrantes.length === 0) return "Solo el líder";
  return integrantes.map((i) => (typeof i === "object" ? i.full_name : i)).join(", ");
}

/** Pinta la tabla de propuestas aprobadas pendientes de registro. */
function pintarPropuestasAprobadas() {
  const contenedor = document.getElementById("contenedor-propuesta-aprobada");

  if (propuestas_aprobadas.length === 0) {
    contenedor.innerHTML = `<p class="text-muted fst-italic">No tienes propuestas aprobadas pendientes de registrar como PGC.</p>`;
    return;
  }

  const filas = propuestas_aprobadas
    .map(
      (propuesta) => `
      <tr>
        <td>${propuesta.title_proposal}</td>
        <td>${propuesta.ciclo ?? propuesta.id_cycle ?? "—"}</td>
        <td>${nombresCategorias(propuesta.categorias)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-primary" onclick="abrirRegistroPgc(${propuesta.id_proposal})">Registrar PGC</button>
        </td>
      </tr>`
    )
    .join("");

  contenedor.innerHTML = `
    <div class="table-responsive">
      <table class="table align-middle bg-white">
        <thead>
          <tr>
            <th>Título</th>
            <th>Ciclo</th>
            <th>Categorías</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

/** Abre el modal de confirmación con los datos heredados, en solo lectura. */
function abrirRegistroPgc(id_proposal) {
  propuesta_seleccionada = propuestas_aprobadas.find((p) => p.id_proposal === id_proposal);
  if (!propuesta_seleccionada) return;

  const p = propuesta_seleccionada;

  document.getElementById("cuerpo-modal-registro").innerHTML = `
    <p class="text-muted" style="font-size:.82rem;">
      Estos datos vienen de tu propuesta aprobada y no se pueden modificar en este paso.
    </p>
    <div style="display:grid;gap:.75rem;">
      <div>
        <span class="label">Título</span>
        <p style="margin:0;font-weight:700;">${p.title_proposal}</p>
      </div>
      <div>
        <span class="label">Problema</span>
        <p style="margin:0;white-space:pre-wrap;">${p.problem_proposal}</p>
      </div>
      <div>
        <span class="label">Justificación</span>
        <p style="margin:0;white-space:pre-wrap;">${p.justification_proposal}</p>
      </div>
      <div>
        <span class="label">Objetivos</span>
        <p style="margin:0;white-space:pre-wrap;">${p.objectives_proposal}</p>
      </div>
      <div>
        <span class="label">Solución propuesta</span>
        <p style="margin:0;white-space:pre-wrap;">${p.solution_proposal}</p>
      </div>
      <div>
        <span class="label">Categorías</span>
        <p style="margin:0;">${nombresCategorias(p.categorias)}</p>
      </div>
      <div>
        <span class="label">Integrantes</span>
        <p style="margin:0;">${nombresIntegrantes(p.integrantes)}</p>
      </div>
    </div>
    <div id="banner-modal-registro" class="banner hidden" style="margin-top:1rem;"></div>
  `;

  modal_registro.show();
}

/** Confirma el registro del PGC contra POST /pgc. */
async function confirmarRegistroPgc() {
  if (!propuesta_seleccionada) return;

  const boton = document.getElementById("btn-confirmar-registro");
  boton.disabled = true;
  boton.textContent = "Registrando...";

  try {
    const res = await peticionApi("/pgc", {
      method: "POST",
      body: JSON.stringify({ id_proposal: propuesta_seleccionada.id_proposal }),
    });
    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Caso "fuera de fecha": se espera que el backend devuelva el
      // rango habilitado junto con el mensaje, para mostrarlo completo.
      const rango = datos.fecha_inicio_registro_pgc && datos.fecha_fin_registro_pgc
        ? ` (habilitado del ${datos.fecha_inicio_registro_pgc} al ${datos.fecha_fin_registro_pgc})`
        : "";
      mostrarBanner("banner-modal-registro", "error", (datos.mensaje || "No fue posible registrar el PGC.") + rango);
      return;
    }

    // Registro exitoso: se va directo a "Mi PGC" (Issue 3).
    window.location.href = "miPgc.html";
  } catch {
    mostrarBanner("banner-modal-registro", "error", "No fue posible conectar con el servidor.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Confirmar registro";
  }
}

async function inicializarPropuestaAprobada() {
  modal_registro = new bootstrap.Modal(document.getElementById("modal-registro-pgc"));

  try {
    const res = await peticionApi("/proposals/approved-without-pgc");
    if (!res.ok) throw new Error("Error al cargar propuestas aprobadas.");
    propuestas_aprobadas = await res.json();
  } catch {
    mostrarBanner("banner", "error", "No fue posible cargar tus propuestas aprobadas. Intenta recargar la página.");
    propuestas_aprobadas = [];
  }

  pintarPropuestasAprobadas();

  document.getElementById("btn-confirmar-registro").addEventListener("click", confirmarRegistroPgc);
}