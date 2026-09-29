// ============================================================
// MIPGC.JS — HU-03: vista de solo lectura del PGC registrado
// + carga y reemplazo de archivos de evidencia.
//
// Los archivos no llevan título propio: el backend guarda solo
// storage_path (la ruta/nombre del archivo) y file_format, así que
// el nombre visible sale del storage_path.
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

/** Deja solo el nombre del archivo, sin las carpetas de la ruta de Storage. */
function nombreDeArchivo(storage_path) {
  if (!storage_path) return "Archivo sin nombre";
  return storage_path.split("/").pop();
}

/** Arma las categorías como texto simple (ya escapado). */
function nombresCategoriasPgc(categorias) {
  if (!Array.isArray(categorias) || categorias.length === 0) return "Sin categorías";
  return categorias.map((c) => escaparHtml(typeof c === "object" ? c.name_category : c)).join(", ");
}

/** Arma los nombres de integrantes como texto simple (ya escapado). */
function nombresIntegrantesPgc(integrantes) {
  if (!Array.isArray(integrantes) || integrantes.length === 0) return "Solo el líder";
  return integrantes.map((i) => escaparHtml(typeof i === "object" ? i.full_name : i)).join(", ");
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
 * Pinta la lista de archivos ya subidos. Cada fila muestra el nombre
 * del archivo como enlace (con nota de expiración vía renderEnlacePdf),
 * su formato como etiqueta, y un botón "Reemplazar" que dispara un
 * <input type="file"> oculto.
 */
function pintarArchivosPgc(archivos) {
  const contenedor = document.getElementById("lista-archivos-pgc");

  if (!Array.isArray(archivos) || archivos.length === 0) {
    contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.85rem;">Todavía no has subido evidencias de avance.</p>`;
    return;
  }

  // El BE (mapearArchivoParaFrontend) devuelve:
  //   { id_file, title_file, url_file: { url, expira_en_segundos } }
  // storage_path, id_pgc_file y file_format nunca llegan al FE (decisión del equipo).
  contenedor.innerHTML = `
    <ul class="list-group">
      ${archivos
        .map(
          (archivo) => `
        <li class="list-group-item d-flex justify-content-between align-items-center" id="fila-archivo-${archivo.id_file}">
          <div>
            <div id="enlace-archivo-${archivo.id_file}"></div>
            <span class="badge text-bg-light border mt-1">${escaparHtml(((archivo.title_file || "").split(".").pop() || "ARCHIVO").toUpperCase())}</span>
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-outline-primary"
                    onclick="document.getElementById('input-reemplazar-${archivo.id_file}').click()">
              Reemplazar
            </button>
            <input type="file" class="d-none" id="input-reemplazar-${archivo.id_file}"
                   onchange="reemplazarArchivoPgc(${archivo.id_file}, this.files[0])">
            <button type="button" class="btn btn-sm btn-outline-danger"
                    onclick="eliminarArchivoPgc(${archivo.id_file})">
              Eliminar
            </button>
          </div>
        </li>`
        )
        .join("")}
    </ul>`;

  // url_file del BE es { url, expira_en_segundos }.
  // renderEnlacePdf necesita AMBOS campos: url para el href y expira_en_segundos
  // para calcular el tiempo disponible. Si solo pasamos { url } queda en 0 y
  // muestra "El enlace ha expirado" en vez del link clicable.
  archivos.forEach((archivo) => {
    const etiqueta = `📎 ${escaparHtml(archivo.title_file || "Archivo")}`;
    renderEnlacePdf(
      document.getElementById(`enlace-archivo-${archivo.id_file}`),
      archivo.url_file,   // pasar el objeto completo { url, expira_en_segundos }
      etiqueta
    );
  });
}


/** Pinta la tarjeta completa: datos del PGC + sección de archivos. */
function pintarPgc() {
  const contenedor = document.getElementById("contenedor-pgc");
  const p = pgc_actual;

  contenedor.innerHTML = `
    <div class="card-resumen">

      <span class="label">Título</span>
      <h2 style="font-size:1.2rem;font-weight:700;color:var(--verde-udec);">${escaparHtml(p.title_proposal)}</h2>

      <div style="display:grid;gap:.75rem;margin:1rem 0;">
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
        <div class="col-12 col-md-9">
          <label for="archivo-pgc" class="form-label">Nuevo archivo</label>
          <input type="file" class="form-control" id="archivo-pgc">
        </div>
        <div class="col-12 col-md-3">
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

/** Envía el nuevo archivo (solo el binario) a POST /pgc/:id/files. */
async function subirArchivoPgc(evento) {
  evento.preventDefault();
  ocultarBanner("banner-archivo");

  const archivo = document.getElementById("archivo-pgc").files[0];

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
    fd.append("archivo", archivo);

    const res = await peticionApi(`/pgc/${pgc_actual.id_pgc}/files`, { method: "POST", body: fd });
    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      mostrarBanner("banner-archivo", "error", datos.mensaje || "No fue posible subir el archivo.");
      return;
    }

    await inicializarMiPgc();
    mostrarBanner("banner-archivo", "success", datos.mensaje || "Archivo subido correctamente.");
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
async function reemplazarArchivoPgc(id_file, archivo) {
  ocultarBanner("banner-archivo");

  const error_archivo = validarArchivoPgc(archivo);
  if (error_archivo) {
    mostrarBanner("banner-archivo", "error", error_archivo);
    return;
  }

  const fila = document.getElementById(`fila-archivo-${id_file}`);
  const boton_fila = fila ? fila.querySelector("button") : null;
  if (boton_fila) {
    boton_fila.disabled = true;
    boton_fila.textContent = "Reemplazando...";
  }

  try {
    const fd = new FormData();
    fd.append("archivo", archivo);

    const res = await peticionApi(`/pgc/${pgc_actual.id_pgc}/files/${id_file}`, { method: "PUT", body: fd });
    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      mostrarBanner("banner-archivo", "error", datos.mensaje || "No fue posible reemplazar el archivo.");
      if (boton_fila) {
        boton_fila.disabled = false;
        boton_fila.textContent = "Reemplazar";
      }
      return;
    }

    await inicializarMiPgc();
    mostrarBanner("banner-archivo", "success", datos.mensaje || "Archivo reemplazado correctamente.");
  } catch {
    mostrarBanner("banner-archivo", "error", "No fue posible conectar con el servidor.");
    if (boton_fila) {
      boton_fila.disabled = false;
      boton_fila.textContent = "Reemplazar";
    }
  }
}

/**
 * Elimina un archivo de evidencia vía DELETE /pgc/:id/files/:idArchivo.
 * Pide confirmación antes de proceder.
 */
async function eliminarArchivoPgc(id_file) {
  if (!confirm("¿Seguro que quieres eliminar este archivo? Esta acción no se puede deshacer.")) return;

  // Deshabilitar todos los botones de esa fila mientras se procesa.
  const fila = document.getElementById(`fila-archivo-${id_file}`);
  const botones_fila = fila ? fila.querySelectorAll("button") : [];
  botones_fila.forEach((b) => { b.disabled = true; });

  try {
    const res = await peticionApi(
      `/pgc/${pgc_actual.id_pgc}/files/${id_file}`,
      { method: "DELETE" }
    );

    // El controller responde 204 (sin body) en éxito.
    if (!res.ok) {
      const datos = await res.json().catch(() => ({}));
      mostrarBanner("banner-archivo", "error", datos.mensaje || "No fue posible eliminar el archivo.");
      botones_fila.forEach((b) => { b.disabled = false; });
      return;
    }

    // Recargar toda la vista para reflejar el archivo eliminado.
    await inicializarMiPgc();
    mostrarBanner("banner-archivo", "success", "Archivo eliminado correctamente.");
  } catch {
    mostrarBanner("banner-archivo", "error", "No fue posible conectar con el servidor.");
    botones_fila.forEach((b) => { b.disabled = false; });
  }
}


async function inicializarMiPgc() {
  const contenedor = document.getElementById("contenedor-pgc");

  try {
    const res = await peticionApi("/pgc/mine");
    if (!res.ok) throw new Error("Error al cargar el PGC.");
    const lista = await res.json();

    // El BE devuelve un array ordenado por registered_at DESC.
    // Si está vacío, el estudiante todavía no tiene PGC registrado.
    if (!Array.isArray(lista) || lista.length === 0) {
      contenedor.innerHTML = `<p class="text-muted fst-italic">Todavía no has registrado ningún PGC.</p>`;
      return;
    }

    pgc_actual = lista[0]; // El más reciente
  } catch {
    contenedor.innerHTML = `<p class="text-muted fst-italic">No fue posible cargar tu PGC. Intenta recargar la página.</p>`;
    return;
  }

  // ── Cargar archivos de evidencia desde GET /pgc/:id/files ──────────────
  // GET /pgc/mine no incluye los archivos: viven en una ruta separada.
  try {
    const resArchivos = await peticionApi(`/pgc/${pgc_actual.id_pgc}/files`);
    pgc_actual.archivos = resArchivos.ok ? await resArchivos.json() : [];
  } catch {
    pgc_actual.archivos = [];
  }

  pintarPgc();
}
