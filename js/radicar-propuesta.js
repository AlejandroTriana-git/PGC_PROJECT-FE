// ============================================================
// RADICAR-PROPUESTA.JS — HU-09: lógica del formulario de
// radicación inicial de un PGC.
// ============================================================

const TAMANO_MAXIMO_PDF_MB = 10;

/**
 * Carga las categorías de proyecto desde la API y llena el <select id="categoria">.
 * El `value` de cada opción es el name_category, que es lo que se guarda
 * en descr_proposal tal como espera el backend.
 */
async function pintarCategorias() {
  const select = document.getElementById("categoria");
  if (!select) return;

  try {
    const res = await peticionApi("/categorias");
    const categorias = await res.json();

    if (!res.ok || !Array.isArray(categorias) || categorias.length === 0) {
      select.innerHTML = `<option value="" disabled selected>No se pudieron cargar las categorías</option>`;
      return;
    }

    select.innerHTML =
      `<option value="" disabled selected>Selecciona una opción</option>` +
      categorias
        .map((c) => `<option value="${c.name_category}">${c.name_category}</option>`)
        .join("");
  } catch {
    select.innerHTML = `<option value="" disabled selected>Error al cargar categorías</option>`;
  }
}

/**
 * Carga los estudiantes del mismo ciclo desde la API y pinta
 * los checkboxes de integrantes disponibles.
 */
async function pintarIntegrantes() {
  const contenedor = document.getElementById("lista-integrantes");

  try {
    // El BE obtiene el ciclo del estudiante a través del token (no se envía ?ciclo)
    const res = await peticionApi("/estudiantes");
    const estudiantes = await res.json();

    if (!res.ok || !Array.isArray(estudiantes) || estudiantes.length === 0) {
      contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.82rem;">No hay otros estudiantes disponibles en tu ciclo.</p>`;
      return;
    }

    contenedor.innerHTML = estudiantes
      .map(
        // Mapeo correcto: id_user (no .id), full_name (no .nombre)
        (estudiante) => `
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="${estudiante.id_user}" id="integrante-${estudiante.id_user}">
          <label class="form-check-label" for="integrante-${estudiante.id_user}">${estudiante.full_name}</label>
        </div>`
      )
      .join("");

    // Guardamos la lista para poder leerla al hacer submit.
    contenedor.dataset.estudiantes = JSON.stringify(estudiantes);
  } catch {
    contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.82rem;">No fue posible cargar los integrantes.</p>`;
  }
}

/** Valida el PDF seleccionado: extensión y tamaño máximo. */
function validarPdf(archivo) {
  if (!archivo) return "Debes adjuntar el PDF de la propuesta.";
  if (archivo.type !== "application/pdf") return "El archivo debe ser un PDF.";
  const tamanoMB = archivo.size / (1024 * 1024);
  if (tamanoMB > TAMANO_MAXIMO_PDF_MB) return `El PDF no debe superar ${TAMANO_MAXIMO_PDF_MB} MB.`;
  return null;
}

async function inicializarRadicarPropuesta() {
  // ── Bug 1: bloquear el formulario si el estudiante ya tiene una propuesta ──
  try {
    const resMia = await peticionApi("/propuestas/mia");

    if (resMia.ok) {
      // Ya existe una propuesta (activa, rechazada o anulada)
      const propuesta = await resMia.json();
      const form = document.getElementById("form-propuesta");
      if (form) form.classList.add("hidden");

      const estadoTextos = {
        "Pendiente de validación": "una propuesta pendiente de validación",
        "Aprobada": "una propuesta aprobada",
        "Rechazada": "una propuesta rechazada (puedes editarla desde \"Mi propuesta\")",
        "Anulada": "una propuesta anulada",
      };
      const descripcion = estadoTextos[propuesta.estado] || "una propuesta registrada";

      mostrarBanner(
        "banner",
        "error",
        `Ya tienes ${descripcion}. No puedes radicar una nueva propuesta. <a href="mis-propuestas.html" style="color:inherit;font-weight:700;">Ver mi propuesta →</a>`
      );
      return; // No inicializar el formulario
    }

    // Si es 404 no hay propuesta → flujo normal
  } catch {
    // Si falla la consulta previa, dejamos que el submit la maneje
  }

  pintarCategorias();
  pintarIntegrantes();

  document.getElementById("form-propuesta").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    ocultarBanner("banner");

    const titulo        = document.getElementById("titulo").value.trim();
    const categoria     = document.getElementById("categoria").value;
    const problema      = document.getElementById("problema").value.trim();
    const justificacion = document.getElementById("justificacion").value.trim();
    const objetivos     = document.getElementById("objetivos").value.trim();
    const solucion      = document.getElementById("solucion").value.trim();
    const archivoPdf    = document.getElementById("pdf").files[0];

    // Leer los integrantes marcados desde los checkboxes generados dinámicamente.
    const contenedorIntegrantes = document.getElementById("lista-integrantes");
    const estudiantesDisponibles = JSON.parse(contenedorIntegrantes.dataset.estudiantes || "[]");
    // Usar id_user (no .id) para identificar integrantes
    const integrantes = estudiantesDisponibles
      .filter((e) => document.getElementById(`integrante-${e.id_user}`)?.checked)
      .map((e) => e.id_user);

    if (!titulo || !categoria || !problema || !justificacion || !objetivos || !solucion) {
      mostrarBanner("banner", "error", "Debes completar todos los campos.");
      return;
    }

    const errorPdf = validarPdf(archivoPdf);
    if (errorPdf) {
      mostrarBanner("banner", "error", errorPdf);
      return;
    }

    const boton = document.getElementById("btn-radicar");
    boton.disabled = true;
    boton.textContent = "Radicando...";

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
      // NOTA: id_cycle NO se envía — el BE lo obtiene del líder en la BD
      fd.append("pdf", archivoPdf);

      const res = await peticionApi("/propuestas", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));

      mostrarBanner(
        "banner",
        res.ok ? "success" : "error",
        json.mensaje || (res.ok ? "Propuesta radicada correctamente." : "No fue posible radicar la propuesta.")
      );
    } catch {
      mostrarBanner("banner", "error", "No fue posible conectar con el servidor.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Radicar propuesta";
    }
  });
}