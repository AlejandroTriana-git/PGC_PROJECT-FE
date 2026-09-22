// ============================================================
// RADICAR-PROPUESTA.JS — HU-09: lógica del formulario de
// radicación inicial de un PGC.
// ============================================================

const TAMANO_MAXIMO_PDF_MB = 10;

/**
 * Carga los estudiantes del mismo ciclo desde la API y pinta
 * los checkboxes de integrantes disponibles.
 */
async function pintarIntegrantes() {
  const contenedor = document.getElementById("lista-integrantes");

  try {
    const res = await peticionApi("/estudiantes?ciclo=mismo");
    const estudiantes = await res.json();

    if (!res.ok || !Array.isArray(estudiantes) || estudiantes.length === 0) {
      contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.82rem;">No hay otros estudiantes disponibles en tu ciclo.</p>`;
      return;
    }

    contenedor.innerHTML = estudiantes
      .map(
        (estudiante) => `
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="${estudiante.id}" id="integrante-${estudiante.id}">
          <label class="form-check-label" for="integrante-${estudiante.id}">${estudiante.nombre}</label>
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

function inicializarRadicarPropuesta() {
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
    const integrantes = estudiantesDisponibles
      .filter((e) => document.getElementById(`integrante-${e.id}`)?.checked)
      .map((e) => e.id);

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
      fd.append("titulo", titulo);
      fd.append("categoria", categoria);
      fd.append("problema", problema);
      fd.append("justificacion", justificacion);
      fd.append("objetivos", objetivos);
      fd.append("solucion", solucion);
      fd.append("integrantes", JSON.stringify(integrantes));
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