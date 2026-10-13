// ============================================================
// MIPGC.JS — HU-03: vista del PGC registrado, organizada en pestañas
// (Resumen / Archivos / Calificación) + carga, reemplazo y eliminación
// de archivos de evidencia + documento de la propuesta original
// (Issues 10 y 11).
//
// Cada archivo lleva un título y una descripción obligatorios que
// escribe el estudiante (title_file, desc_file en pgc_files).
// Las pestañas son las de Bootstrap: miPgc.html debe cargar bootstrap.bundle.
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

const PESTANAS_PGC = [
  { id: "resumen", etiqueta: "Resumen" },
  { id: "archivos", etiqueta: "Archivos" },
  { id: "calificacion", etiqueta: "Calificación" },
];

// El PGC cargado, para no volver a pedirlo al subir/reemplazar cada archivo.
let pgc_actual = null;

// Pestaña abierta: sobrevive a los repintados (subir, reemplazar, eliminar).
let pestana_activa = "resumen";

/** Nombres de las categorías, como arreglo de textos sin escapar. */
function textosCategorias(categorias) {
  if (!Array.isArray(categorias)) return [];
  return categorias.map((c) => (typeof c === "object" ? c.name_category : c));
}

/** Nombres de los integrantes, como arreglo de textos sin escapar. */
function textosIntegrantes(integrantes) {
  if (!Array.isArray(integrantes)) return [];
  return integrantes.map((i) => (typeof i === "object" ? i.full_name : i));
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

/** Muestra u oculta el mini-formulario de reemplazo de una fila y mueve el foco. */
function toggleFormularioReemplazo(id_file, visible) {
  const form = document.getElementById(`form-reemplazo-${id_file}`);
  const boton = document.getElementById(`btn-reemplazar-${id_file}`);
  if (!form || !boton) return;
  form.classList.toggle("hidden", !visible);
  boton.classList.toggle("hidden", visible);
  const destino = visible ? document.getElementById(`titulo-reemplazo-${id_file}`) : boton;
  if (destino) destino.focus();
}

/** Muestra u oculta la descripción de un archivo. */
function toggleDescripcionArchivo(id_file) {
  const parrafo = document.getElementById(`descripcion-archivo-${id_file}`);
  const boton = document.getElementById(`btn-ver-descripcion-${id_file}`);
  if (!parrafo || !boton) return;
  const estaba_visible = !parrafo.classList.contains("hidden");
  parrafo.classList.toggle("hidden", estaba_visible);
  boton.textContent = estaba_visible ? "Ver descripción ▾" : "Ocultar descripción ▴";
  boton.setAttribute("aria-expanded", String(!estaba_visible));
}

/**
 * Pinta la lista de archivos ya subidos. Cada fila muestra el título
 * (siempre visible, como enlace con nota de expiración vía renderEnlacePdf),
 * un botón para desplegar la descripción, y botones "Reemplazar"/"Eliminar".
 * "Reemplazar" abre un mini-formulario en línea con título, descripción y
 * archivo, prellenado con los valores actuales.
 */
function pintarArchivosPgc(archivos) {
  const contenedor = document.getElementById("lista-archivos-pgc");

  if (!Array.isArray(archivos) || archivos.length === 0) {
    contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.85rem;">Todavía no has subido evidencias de avance.</p>`;
    return;
  }

  // El BE (mapearArchivoParaFrontend) devuelve:
  //   { id_file, title_file, desc_file, url_file: { url, expira_en_segundos } }
  contenedor.innerHTML = `
    <ul class="list-group">
      ${archivos
        .map((archivo) => {
          const titulo = escaparHtml(archivo.title_file || "Archivo");
          return `
        <li class="list-group-item" id="fila-archivo-${archivo.id_file}">
          <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
            <div>
              <div id="enlace-archivo-${archivo.id_file}"></div>
              <button type="button" class="btn btn-link btn-sm p-0" id="btn-ver-descripcion-${archivo.id_file}"
                      aria-expanded="false" aria-controls="descripcion-archivo-${archivo.id_file}"
                      onclick="toggleDescripcionArchivo(${archivo.id_file})" style="font-size:.78rem;">
                Ver descripción ▾
              </button>
              <p class="text-muted mb-0 mt-1 hidden" id="descripcion-archivo-${archivo.id_file}" style="font-size:.78rem;">
                ${escaparHtml(archivo.desc_file)}
              </p>
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-outline-primary" id="btn-reemplazar-${archivo.id_file}"
                      aria-label="Reemplazar ${titulo}"
                      onclick="toggleFormularioReemplazo(${archivo.id_file}, true)">
                Reemplazar
              </button>
              <button type="button" class="btn btn-sm btn-outline-danger"
                      aria-label="Eliminar ${titulo}"
                      onclick="eliminarArchivoPgc(${archivo.id_file})">
                Eliminar
              </button>
            </div>
          </div>

          <form id="form-reemplazo-${archivo.id_file}" class="row g-2 mt-2 hidden" novalidate
                onsubmit="reemplazarArchivoPgc(${archivo.id_file}); return false;">
            <div class="col-12 col-md-4">
              <label for="titulo-reemplazo-${archivo.id_file}" class="form-label">Título</label>
              <input type="text" class="form-control form-control-sm" required id="titulo-reemplazo-${archivo.id_file}" value="${escaparHtml(archivo.title_file)}">
            </div>
            <div class="col-12 col-md-4">
              <label for="descripcion-reemplazo-${archivo.id_file}" class="form-label">Descripción</label>
              <input type="text" class="form-control form-control-sm" required id="descripcion-reemplazo-${archivo.id_file}" value="${escaparHtml(archivo.desc_file)}">
            </div>
            <div class="col-12 col-md-4">
              <label for="archivo-reemplazo-${archivo.id_file}" class="form-label">Nuevo archivo (opcional)</label>
              <input type="file" class="form-control form-control-sm" id="archivo-reemplazo-${archivo.id_file}">
            </div>
            <div class="col-12 d-flex gap-2">
              <button type="submit" class="btn btn-sm btn-primary">Guardar cambios</button>
              <button type="button" class="btn btn-sm btn-outline-secondary" onclick="toggleFormularioReemplazo(${archivo.id_file}, false)">Cancelar</button>
            </div>
          </form>
        </li>`;
        })
        .join("")}
    </ul>`;

  // url_file del BE es { url, expira_en_segundos }: renderEnlacePdf necesita
  // el objeto completo para calcular el tiempo disponible.
  archivos.forEach((archivo) => {
    renderEnlacePdf(
      document.getElementById(`enlace-archivo-${archivo.id_file}`),
      archivo.url_file,
      `<span aria-hidden="true">📎</span> ${escaparHtml(archivo.title_file || "Archivo")}`
    );
  });
}

/** Formatea una nota a un decimal; "—" si no hay valor numérico válido. */
function formatearNota(valor) {
  const numero = Number(valor);
  if (valor === null || valor === undefined || valor === "" || !Number.isFinite(numero)) return "—";
  return numero.toFixed(1);
}

/**
 * Pinta la sección de calificaciones. Las notas viven aquí y no en la ficha
 * pública (fichaPgc.html), que cualquier usuario puede abrir con el id de otro PGC.
 *
 * Contrato de GET /pgc/:id_pgc/grades (lo define el frontend):
 *   { nota_global: 4.3 | null, calificaciones: [{ juror_name, grade, comment, graded_at }] }
 * Si nadie ha calificado: nota_global null y calificaciones [].
 * pgc_actual.notas vale null cuando la petición falló.
 */
function pintarCalificaciones() {
  const contenedor = document.getElementById("seccion-calificaciones");
  if (!contenedor) return;

  const notas = pgc_actual.notas;

  if (!notas) {
    contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.85rem;">No fue posible cargar las calificaciones. Intenta recargar la página.</p>`;
    return;
  }

  const calificaciones = Array.isArray(notas.calificaciones) ? notas.calificaciones : [];

  if (calificaciones.length === 0) {
    contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.85rem;">Pendiente de calificación. Cuando los jurados califiquen tu PGC, verás aquí la nota y sus comentarios.</p>`;
    return;
  }

  const filas = calificaciones
    .map((c) => {
      const fecha = new Date(c.graded_at);
      const fecha_texto = Number.isNaN(fecha.getTime()) ? "" : fecha.toLocaleDateString("es-CO");
      return `
        <li class="list-group-item">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <strong>${escaparHtml(c.juror_name)}</strong>
            <span class="badge-estado aprobada">${escaparHtml(formatearNota(c.grade))} / 5.0</span>
          </div>
          <p class="mb-0 mt-2" style="white-space:pre-wrap;">${escaparHtml(c.comment)}</p>
          ${fecha_texto ? `<span class="text-muted" style="font-size:.75rem;">Calificado el ${escaparHtml(fecha_texto)}</span>` : ""}
        </li>`;
    })
    .join("");

  contenedor.innerHTML = `
    <div class="nota-global mb-3">
      <span class="campo-etiqueta"><span aria-hidden="true">⭐</span>Nota global</span>
      <p class="nota-valor">
        ${escaparHtml(formatearNota(notas.nota_global))}
        <span class="text-muted" style="font-size:1rem;font-weight:600;">/ 5.0</span>
      </p>
    </div>
    <h4 class="h6" style="font-weight:800;color:var(--verde-udec);">Calificación por jurado</h4>
    <ul class="list-group mt-1">${filas}</ul>
  `;
}

/** Texto del contador que acompaña a cada pestaña ("" si no hay nada que contar). */
function contadorPestana(id) {
  const p = pgc_actual;
  if (id === "archivos") {
    const total = (p.archivos || []).length;
    return total > 0 ? String(total) : "";
  }
  if (id === "calificacion" && p.notas && Array.isArray(p.notas.calificaciones) && p.notas.calificaciones.length > 0) {
    return formatearNota(p.notas.nota_global);
  }
  return "";
}

/** Pinta la pantalla completa: cabecera, pestañas y sus tres paneles. */
function pintarPgc() {
  const contenedor = document.getElementById("contenedor-pgc");
  const p = pgc_actual;

  // ── Cabecera: título + ciclo y estado, si el backend los manda ──
  const datos_cabecera = [];
  const ciclo = p.name_cycle ?? p.id_cycle;
  if (ciclo !== undefined && ciclo !== null && ciclo !== "") {
    datos_cabecera.push(/^\d+$/.test(String(ciclo)) ? `Ciclo ${ciclo}` : String(ciclo));
  }
  const estado = p.estado ?? p.state_pgc;
  if (estado) datos_cabecera.push(estado);

  // ── Pestañas ──
  const botones_pestana = PESTANAS_PGC.map((pestana) => {
    const activa = pestana.id === pestana_activa;
    const contador = contadorPestana(pestana.id);
    return `
      <li class="nav-item" role="presentation">
        <button class="nav-link${activa ? " active" : ""}" id="pestana-${pestana.id}" data-pestana="${pestana.id}"
                data-bs-toggle="tab" data-bs-target="#panel-${pestana.id}" type="button" role="tab"
                aria-controls="panel-${pestana.id}" aria-selected="${activa}">
          ${pestana.etiqueta}${contador ? `<span class="contador">${escaparHtml(contador)}</span>` : ""}
        </button>
      </li>`;
  }).join("");

  const panel = (id, contenido) => `
    <div class="tab-pane fade${id === pestana_activa ? " show active" : ""}" id="panel-${id}"
         role="tabpanel" aria-labelledby="pestana-${id}" tabindex="0">
      ${contenido}
    </div>`;

  // ── Panel 1: Resumen ──
  const panel_resumen = `
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
          ${bloqueCampo("🏷️", "Categorías", listaChips(textosCategorias(p.categorias), "Sin categorías"))}
          ${bloqueCampo("👥", "Integrantes", listaChips(textosIntegrantes(p.integrantes), "Solo el líder"))}
        </div>
      </div>
    </div>`;

  // ── Panel 2: Archivos (evidencias de avance + documento de la propuesta) ──
  const panel_archivos = `
    <h3 class="titulo-seccion">Evidencias de avance</h3>
    <p class="text-muted" style="font-size:.82rem;">Archivos que tu equipo sube mientras desarrolla el proyecto.</p>

    <div id="lista-archivos-pgc" class="mb-3"></div>

    <div id="banner-archivo" class="banner hidden"></div>

    <form id="form-subir-archivo" class="row g-2 border rounded p-3 bg-white" novalidate>
      <div class="col-12">
        <h4 class="h6 mb-0" style="font-weight:800;color:var(--verde-udec);">Subir nueva evidencia</h4>
        <p class="text-muted mb-0" style="font-size:.78rem;">Todos los campos son obligatorios.</p>
      </div>
      <div class="col-12 col-md-4">
        <label for="titulo-archivo" class="form-label">Título</label>
        <input type="text" class="form-control" id="titulo-archivo" required>
      </div>
      <div class="col-12 col-md-5">
        <label for="descripcion-archivo" class="form-label">Descripción</label>
        <input type="text" class="form-control" id="descripcion-archivo" required>
      </div>
      <div class="col-12 col-md-3">
        <label for="archivo-pgc" class="form-label">Archivo</label>
        <input type="file" class="form-control" id="archivo-pgc" required aria-describedby="ayuda-archivo-pgc">
      </div>
      <div class="col-12">
        <button type="submit" class="btn btn-primary" id="btn-subir-archivo">Subir archivo</button>
        <div id="ayuda-archivo-pgc" class="form-text">PDF, Word, Excel, PowerPoint o imágenes — máximo 10 MB.</div>
      </div>
    </form>

    <hr class="my-4">

    <h3 class="titulo-seccion">Documento de la propuesta</h3>
    <p class="text-muted" style="font-size:.82rem;">PDF con el que se aprobó tu propuesta. Es de solo lectura.</p>
    <div id="pdf-propuesta"></div>`;

  // ── Panel 3: Calificación ──
  const panel_calificacion = `
    <h3 class="titulo-seccion">Calificación del jurado</h3>
    <div id="seccion-calificaciones"></div>`;

  contenedor.innerHTML = `
    <div class="pgc-cabecera">
      <h2>${escaparHtml(p.title_proposal)}</h2>
      ${datos_cabecera.length > 0 ? listaChips(datos_cabecera, "") : ""}
    </div>

    <ul class="nav nav-tabs pestanas" role="tablist" aria-label="Secciones de tu PGC">
      ${botones_pestana}
    </ul>
    <div class="tab-content pt-3">
      ${panel("resumen", panel_resumen)}
      ${panel("archivos", panel_archivos)}
      ${panel("calificacion", panel_calificacion)}
    </div>
  `;

  pintarArchivosPgc(p.archivos || []);
  pintarCalificaciones();

  // pdf_propuesta es { url, expira_en_segundos } o null (si falló o si el
  // backend todavía no manda id_proposal): en ese caso renderEnlacePdf muestra "Sin documento adjunto".
  renderEnlacePdf(
    document.getElementById("pdf-propuesta"),
    p.pdf_propuesta,
    `<span aria-hidden="true">📄</span> Ver documento de la propuesta`
  );

  // Se recuerda la pestaña abierta para dejarla igual después de repintar.
  contenedor.querySelectorAll("[data-pestana]").forEach((boton) => {
    boton.addEventListener("shown.bs.tab", () => {
      pestana_activa = boton.dataset.pestana;
    });
  });

  document.getElementById("form-subir-archivo").addEventListener("submit", subirArchivoPgc);
}

/** Envía el nuevo archivo (con título y descripción) a POST /pgc/:id/files. */
async function subirArchivoPgc(evento) {
  evento.preventDefault();
  ocultarBanner("banner-archivo");

  const titulo = document.getElementById("titulo-archivo").value.trim();
  const descripcion = document.getElementById("descripcion-archivo").value.trim();
  const archivo = document.getElementById("archivo-pgc").files[0];

  const todo_bien = validarCampos(
    [
      { id: "titulo-archivo", error: titulo ? null : "El título es obligatorio." },
      { id: "descripcion-archivo", error: descripcion ? null : "La descripción es obligatoria." },
      { id: "archivo-pgc", error: validarArchivoPgc(archivo) },
    ],
    "banner-archivo"
  );
  if (!todo_bien) return;

  const boton = document.getElementById("btn-subir-archivo");
  boton.disabled = true;
  boton.textContent = "Subiendo...";

  try {
    const fd = new FormData();
    fd.append("title_file", titulo);
    fd.append("desc_file", descripcion);
    fd.append("archivo", archivo);

    const res = await peticionApi(`/pgc/${pgc_actual.id_pgc}/files`, { method: "POST", body: fd });
    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      mostrarBanner("banner-archivo", "error", datos.mensaje || "No fue posible subir el archivo.");
      enfocarBanner("banner-archivo");
      return;
    }

    await inicializarMiPgc();
    mostrarBanner("banner-archivo", "success", datos.mensaje || "Archivo subido correctamente.");
    enfocarBanner("banner-archivo");
  } catch {
    mostrarBanner("banner-archivo", "error", "No fue posible conectar con el servidor.");
    enfocarBanner("banner-archivo");
  } finally {
    boton.disabled = false;
    boton.textContent = "Subir archivo";
  }
}

/**
 * Reemplaza un archivo ya subido, vía PUT /pgc/:id/files/:idArchivo. Lee título,
 * descripción y el nuevo binario del mini-formulario en línea. El binario es
 * opcional: si no se eligió uno nuevo, se actualiza solo el título/descripción
 * y el archivo guardado se mantiene igual.
 */
async function reemplazarArchivoPgc(id_file) {
  ocultarBanner("banner-archivo");

  const titulo = document.getElementById(`titulo-reemplazo-${id_file}`).value.trim();
  const descripcion = document.getElementById(`descripcion-reemplazo-${id_file}`).value.trim();
  const archivo = document.getElementById(`archivo-reemplazo-${id_file}`).files[0];

  const todo_bien = validarCampos(
    [
      { id: `titulo-reemplazo-${id_file}`, error: titulo ? null : "El título es obligatorio." },
      { id: `descripcion-reemplazo-${id_file}`, error: descripcion ? null : "La descripción es obligatoria." },
      { id: `archivo-reemplazo-${id_file}`, error: archivo ? validarArchivoPgc(archivo) : null },
    ],
    "banner-archivo"
  );
  if (!todo_bien) return;

  const fila = document.getElementById(`fila-archivo-${id_file}`);
  const botones_form = fila ? fila.querySelectorAll("form button") : [];
  botones_form.forEach((b) => { b.disabled = true; });

  try {
    const fd = new FormData();
    fd.append("title_file", titulo);
    fd.append("desc_file", descripcion);
    if (archivo) fd.append("archivo", archivo);

    const res = await peticionApi(`/pgc/${pgc_actual.id_pgc}/files/${id_file}`, { method: "PUT", body: fd });
    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      mostrarBanner("banner-archivo", "error", datos.mensaje || "No fue posible reemplazar el archivo.");
      enfocarBanner("banner-archivo");
      botones_form.forEach((b) => { b.disabled = false; });
      return;
    }

    await inicializarMiPgc();
    mostrarBanner("banner-archivo", "success", datos.mensaje || "Archivo reemplazado correctamente.");
    enfocarBanner("banner-archivo");
  } catch {
    mostrarBanner("banner-archivo", "error", "No fue posible conectar con el servidor.");
    enfocarBanner("banner-archivo");
    botones_form.forEach((b) => { b.disabled = false; });
  }
}

/** Elimina un archivo de evidencia vía DELETE /pgc/:id/files/:idArchivo, con confirmación. */
async function eliminarArchivoPgc(id_file) {
  if (!confirm("¿Seguro que quieres eliminar este archivo? Esta acción no se puede deshacer.")) return;

  const fila = document.getElementById(`fila-archivo-${id_file}`);
  const botones_fila = fila ? fila.querySelectorAll("button") : [];
  botones_fila.forEach((b) => { b.disabled = true; });

  try {
    const res = await peticionApi(`/pgc/${pgc_actual.id_pgc}/files/${id_file}`, { method: "DELETE" });

    // El controller responde 204 (sin body) en éxito.
    if (!res.ok) {
      const datos = await res.json().catch(() => ({}));
      mostrarBanner("banner-archivo", "error", datos.mensaje || "No fue posible eliminar el archivo.");
      enfocarBanner("banner-archivo");
      botones_fila.forEach((b) => { b.disabled = false; });
      return;
    }

    await inicializarMiPgc();
    mostrarBanner("banner-archivo", "success", "Archivo eliminado correctamente.");
    enfocarBanner("banner-archivo");
  } catch {
    mostrarBanner("banner-archivo", "error", "No fue posible conectar con el servidor.");
    enfocarBanner("banner-archivo");
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

  // ── Archivos, calificaciones y PDF de la propuesta, en paralelo ──────────
  // GET /pgc/mine no incluye ninguno: viven en rutas separadas. Si alguna falla,
  // la pantalla igual se pinta y esa sección muestra su propio mensaje.
  const pedir = (ruta) =>
    peticionApi(ruta)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

  const [archivos, notas, pdf_propuesta] = await Promise.all([
    pedir(`/pgc/${pgc_actual.id_pgc}/files`),
    pedir(`/pgc/${pgc_actual.id_pgc}/grades`),
    // El PDF original necesita id_proposal en la respuesta de /pgc/mine (pendiente con BE).
    pgc_actual.id_proposal ? pedir(`/propuestas/${pgc_actual.id_proposal}/pdf`) : Promise.resolve(null),
  ]);

  pgc_actual.archivos = archivos || [];
  pgc_actual.notas = notas;               // null si la petición falló
  pgc_actual.pdf_propuesta = pdf_propuesta; // null si falló o no hay id_proposal

  pintarPgc();
}