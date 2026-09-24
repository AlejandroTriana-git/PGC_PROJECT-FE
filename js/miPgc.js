// ============================================================
// MIPGC.JS — HU-03: vista de solo lectura del PGC registrado
// + carga y reemplazo de archivos de evidencia.
// ============================================================

const TAMANO_MAXIMO_ARCHIVO_MB = 10;

// Formatos permitidos según HU-03: PDF, Word, Excel, imágenes, PowerPoint.
const TIPOS_PERMITIDOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
];

// El PGC cargado, para no volver a pedirlo al subir/reemplazar cada archivo.
let pgc_actual = null;

/** Arma las etiquetas de categorías como texto simple. */
function nombresCategoriasPgc(categorias) {
  if (!Array.isArray(categorias) || categorias.length === 0) return "Sin categorías";
  return categorias.map((c) => (typeof c === "object" ? c.name_category : c)).join(", ");
}

/** Arma los nombres de integrantes como texto simple. */
function nombresIntegrantesPgc(integrantes) {
  if (!Array.isArray(integrantes) || integrantes.length === 0) return "Solo el líder";
  return integrantes.map((i) => (typeof i === "object" ? i.full_name : i)).join(", ");
}

/** Valida el archivo seleccionado: formato y tamaño máximo. */
function validarArchivoPgc(archivo) {
  if (!archivo) return "Debes seleccionar un archivo.";
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return "Formato no permitido. Solo PDF, Word, Excel, PowerPoint o imágenes (JPG/PNG).";
  }
  const tamano_mb = archivo.size / (1024 * 1024);
  if (tamano_mb > TAMANO_MAXIMO_ARCHIVO_MB) {
    return `El archivo no debe superar ${TAMANO_MAXIMO_ARCHIVO_MB} MB.`;
  }
  return null;
}

/**
 * Pinta la lista de archivos ya subidos. Cada uno trae, además del
 * link, un botón "Reemplazar" y un <input type="file"> oculto que
 * ese botón dispara — así no hace falta un modal ni tocar el HTML
 * de miPgc.html para esta función.
 */
function pintarArchivosPgc(archivos) {
  const contenedor = document.getElementById("lista-archivos-pgc");

  if (!Array.isArray(archivos) || archivos.length === 0) {
    contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.85rem;">Todavía no has subido evidencias de avance.</p>`;
    return;
  }

  contenedor.innerHTML = `
    <ul class="list-group">
      ${archivos
        .map(
          (archivo) => `
        <li class="list-group-item d-flex justify-content-between align-items-center" id="fila-archivo-${archivo.id_file}">
          <div>
            <a href="${archivo.url_file}" target="_blank" rel="noopener" style="font-weight:600;color:var(--verde-medio);">
              📎 ${archivo.title_file}
            </a>
          </div>
          <div>
            <button type="button" class="btn btn-sm btn-outline-primary"
                    onclick="document.getElementById('input-reemplazar-${archivo.id_file}').click()">
              Reemplazar
            </button>
            <input type="file" class="d-none" id="input-reemplazar-${archivo.id_file}"
                   onchange="reemplazarArchivoPgc(${archivo.id_file}, this.files[0])">
          </div>
        </li>`
        )
        .join("")}
    </ul>`;
}

/** Pinta la tarjeta completa: datos del PGC + sección de archivos. */
function pintarPgc() {
  const contenedor = document.getElementById("contenedor-pgc");
  const p = pgc_actual;

  contenedor.innerHTML = `
    <div class="card-resumen">

      <span class="label">Título</span>
      <h2 style="font-size:1.2rem;font-weight:700;color:var(--verde-udec);">${p.title_proposal}</h2>

      <div style="display:grid;gap:.75rem;margin:1rem 0;">
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
          <p style="margin:0;">${nombresCategoriasPgc(p.categorias)}</p>
        </div>
        <div>
          <span class="label">Integrantes</span>
          <p style="margin:0;">${nombresIntegrantesPgc(p.integrantes)}</p>
        </div>
      </div>

      <hr>

      <h3 style="font-size:1rem;font-weight:700;color:var(--verde-udec);margin-bottom:.75rem;">Evidencias de avance</h3>

      <div id="lista-archivos-pgc" class="mb-3"></div>

      <div id="banner-archivo" class="banner hidden"></div>

      <form id="form-subir-archivo" class="row g-2 align-items-end" novalidate>
        <div class="col-12 col-md-5">
          <label for="titulo-archivo" class="form-label">Título del archivo</label>
          <input type="text" class="form-control" id="titulo-archivo">
        </div>
        <div class="col-12 col-md-5">
          <label for="archivo-pgc" class="form-label">Archivo</label>
          <input type="file" class="form-control" id="archivo-pgc">
        </div>
        <div class="col-12 col-md-2">
          <button type="submit" class="btn btn-primary w-100" id="btn-subir-archivo">Subir archivo</button>
        </div>
        <div class="col-12">
          <div class="form-text">PDF, Word, Excel, PowerPoint o imágenes — máximo 10 MB.</div>
        </div>
      </form>

    </div>
  `;

  pintarArchivosPgc(p.archivos || []);

  document.getElementById("form-subir-archivo").addEventListener("submit", subirArchivoPgc);
}

/** Envía el nuevo archivo a POST /pgc/:id/files. */
async function subirArchivoPgc(evento) {
  evento.preventDefault();
  ocultarBanner("banner-archivo");

  const titulo = document.getElementById("titulo-archivo").value.trim();
  const archivo = document.getElementById("archivo-pgc").files[0];

  if (!titulo) {
    mostrarBanner("banner-archivo", "error", "Debes asignarle un título al archivo.");
    return;
  }

  const error_archivo = validarArchivoPgc(archivo);
  if (error_archivo) {
    mostrarBanner("banner-archivo", "error", error_archivo);
    return;
  }

  const boton = document.getElementById("btn-subir-archivo");
  boton.disabled = true;
  boton.textContent = "Subiendo...";

  try {
    const fd = new FormData();
    fd.append("title_file", titulo);
    fd.append("archivo", archivo);

    const res = await peticionApi(`/pgc/${pgc_actual.id_pgc}/files`, { method: "POST", body: fd });
    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      mostrarBanner("banner-archivo", "error", datos.mensaje || "No fue posible subir el archivo.");
      return;
    }

    mostrarBanner("banner-archivo", "success", datos.mensaje || "Archivo subido correctamente.");
    await inicializarMiPgc();
  } catch {
    mostrarBanner("banner-archivo", "error", "No fue posible conectar con el servidor.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Subir archivo";
  }
}

/**
 * Reemplaza un archivo ya subido, vía PUT /pgc/:id/files/:idArchivo.
 * Se dispara desde el <input type="file"> oculto de pintarArchivosPgc.
 */
async function reemplazarArchivoPgc(id_archivo, archivo) {
  ocultarBanner("banner-archivo");

  const error_archivo = validarArchivoPgc(archivo);
  if (error_archivo) {
    mostrarBanner("banner-archivo", "error", error_archivo);
    return;
  }

  const fila = document.getElementById(`fila-archivo-${id_archivo}`);
  const boton_fila = fila ? fila.querySelector("button") : null;
  if (boton_fila) {
    boton_fila.disabled = true;
    boton_fila.textContent = "Reemplazando...";
  }

  try {
    const fd = new FormData();
    fd.append("archivo", archivo);

    const res = await peticionApi(`/pgc/${pgc_actual.id_pgc}/files/${id_archivo}`, { method: "PUT", body: fd });
    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      mostrarBanner("banner-archivo", "error", datos.mensaje || "No fue posible reemplazar el archivo.");
      if (boton_fila) {
        boton_fila.disabled = false;
        boton_fila.textContent = "Reemplazar";
      }
      return;
    }

    mostrarBanner("banner-archivo", "success", datos.mensaje || "Archivo reemplazado correctamente.");
    await inicializarMiPgc();
  } catch {
    mostrarBanner("banner-archivo", "error", "No fue posible conectar con el servidor.");
    if (boton_fila) {
      boton_fila.disabled = false;
      boton_fila.textContent = "Reemplazar";
    }
  }
}

async function inicializarMiPgc() {
  const contenedor = document.getElementById("contenedor-pgc");

  try {
    const res = await peticionApi("/pgc/mio");
    if (res.status === 404) {
      contenedor.innerHTML = `<p class="text-muted fst-italic">Todavía no has registrado ningún PGC.</p>`;
      return;
    }
    if (!res.ok) throw new Error("Error al cargar el PGC.");
    pgc_actual = await res.json();
  } catch {
    contenedor.innerHTML = `<p class="text-muted fst-italic">No fue posible cargar tu PGC. Intenta recargar la página.</p>`;
    return;
  }

  pintarPgc();
}