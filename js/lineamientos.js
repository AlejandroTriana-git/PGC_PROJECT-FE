// ============================================================
// LINEAMIENTOS.JS — HU-11: lista de documentos vigentes de tipo
// "Lineamiento" para un ciclo, con historial de versiones
// (lectura, todos los roles) + subida de nuevas versiones o
// documentos nuevos (solo administrador).
//
// Un ciclo puede tener VARIOS lineamientos distintos (plantilla,
// reglamento, formato...), cada uno identificado por su title_file
// (fijo entre versiones) y versionado por version_label. El
// endpoint de subida es el MISMO para "actualizar uno existente" y
// "agregar uno nuevo": lo único que cambia es si el formulario
// llega con el título bloqueado (actualizar) o en blanco (nuevo).
// ============================================================

const TIPO_DOCUMENTO = "Lineamiento";
const TAMANO_MAXIMO_LINEAMIENTO_MB = 10;

let id_cycle_actual = null;
let documentos_vigentes = [];

/** Valida que el archivo sea un PDF dentro del tamaño máximo. */
function validarPdfLineamiento(archivo) {
  if (!archivo) return "Debes seleccionar el PDF del documento.";
  if (archivo.type !== "application/pdf") return "El archivo debe ser un PDF.";
  const tamano_mb = archivo.size / (1024 * 1024);
  if (tamano_mb > TAMANO_MAXIMO_LINEAMIENTO_MB) return `El PDF no debe superar ${TAMANO_MAXIMO_LINEAMIENTO_MB} MB.`;
  return null;
}

/**
 * Envía una nueva versión a POST /ciclos/:id_cycle/documentos/lineamiento.
 * Mismo endpoint para actualizar uno existente o agregar uno nuevo.
 * @param {object} datos - { title_file, desc_file, version_label, archivo }
 */
async function subirDocumento(datos) {
  const fd = new FormData();
  fd.append("title_file", datos.title_file);
  if (datos.desc_file) fd.append("desc_file", datos.desc_file);
  fd.append("version_label", datos.version_label);
  fd.append("archivo", datos.archivo);

  return peticionApi(`/ciclos/${id_cycle_actual}/documentos/lineamiento`, { method: "POST", body: fd });
}

/**
 * Pinta el formulario para "Agregar documento nuevo": título en
 * blanco y editable (a diferencia de "Actualizar", donde el título
 * viaja fijo — ver pintarFormularioActualizar).
 */
function pintarFormularioAgregar() {
  const contenedor = document.getElementById("contenedor-agregar");

  contenedor.innerHTML = `
    <button type="button" class="btn btn-outline-primary mb-3" id="btn-mostrar-agregar">+ Agregar documento nuevo</button>

    <div id="form-agregar-wrap" class="hidden">
      <div class="card-resumen mb-3">
        <h3 style="font-size:1rem;font-weight:700;color:var(--verde-udec);margin-bottom:.75rem;">Nuevo documento</h3>
        <form id="form-agregar" class="row g-2" novalidate>
          <div class="col-12 col-md-4">
            <label for="titulo-nuevo" class="form-label">Título</label>
            <input type="text" class="form-control" id="titulo-nuevo" placeholder="Ej. Reglamento general">
          </div>
          <div class="col-12 col-md-4">
            <label for="descripcion-nuevo" class="form-label">Descripción (opcional)</label>
            <input type="text" class="form-control" id="descripcion-nuevo">
          </div>
          <div class="col-6 col-md-2">
            <label for="version-nuevo" class="form-label">Versión</label>
            <input type="text" class="form-control" id="version-nuevo" placeholder="V1">
          </div>
          <div class="col-6 col-md-2">
            <label for="pdf-nuevo" class="form-label">PDF</label>
            <input type="file" class="form-control" id="pdf-nuevo" accept="application/pdf">
          </div>
          <div class="col-12 d-flex gap-2">
            <button type="submit" class="btn btn-primary" id="btn-guardar-nuevo">Publicar</button>
            <button type="button" class="btn btn-outline-secondary" id="btn-cancelar-agregar">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById("btn-mostrar-agregar").addEventListener("click", () => {
    document.getElementById("form-agregar-wrap").classList.remove("hidden");
    document.getElementById("btn-mostrar-agregar").classList.add("hidden");
  });
  document.getElementById("btn-cancelar-agregar").addEventListener("click", () => {
    document.getElementById("form-agregar-wrap").classList.add("hidden");
    document.getElementById("btn-mostrar-agregar").classList.remove("hidden");
  });

  document.getElementById("form-agregar").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    ocultarBanner("banner");

    const titulo = document.getElementById("titulo-nuevo").value.trim();
    const descripcion = document.getElementById("descripcion-nuevo").value.trim();
    const version = document.getElementById("version-nuevo").value.trim();
    const archivo = document.getElementById("pdf-nuevo").files[0];

    if (!titulo || !version) {
      mostrarBanner("banner", "error", "El título y la versión son obligatorios.");
      return;
    }
    const error_pdf = validarPdfLineamiento(archivo);
    if (error_pdf) {
      mostrarBanner("banner", "error", error_pdf);
      return;
    }

    const boton = document.getElementById("btn-guardar-nuevo");
    boton.disabled = true;
    boton.textContent = "Publicando...";

    try {
      const res = await subirDocumento({ title_file: titulo, desc_file: descripcion, version_label: version, archivo });
      const datos = await res.json().catch(() => ({}));

      if (!res.ok) {
        mostrarBanner("banner", "error", datos.mensaje || "No fue posible publicar el documento.");
        return;
      }

      mostrarBanner("banner", "success", datos.mensaje || "Documento publicado correctamente.");
      await cargarDocumentos();
      pintarFormularioAgregar(); // vuelve a pintar ya cerrado, limpio
    } catch {
      mostrarBanner("banner", "error", "No fue posible conectar con el servidor.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Publicar";
    }
  });
}

/** Muestra u oculta el formulario de "Actualizar" de un documento puntual. */
function toggleFormularioActualizar(title_file_id, visible) {
  const form = document.getElementById(`form-actualizar-${title_file_id}`);
  const boton = document.getElementById(`btn-actualizar-${title_file_id}`);
  if (!form || !boton) return;
  form.classList.toggle("hidden", !visible);
  boton.classList.toggle("hidden", visible);
}

/**
 * Envía una nueva versión de un documento YA EXISTENTE. El título
 * viaja tal cual venía en el documento vigente — nunca se vuelve a
 * escribir, para no romper el amarre entre versiones.
 */
async function actualizarDocumento(title_file_id, title_file_real) {
  ocultarBanner("banner");

  const descripcion = document.getElementById(`descripcion-actualizar-${title_file_id}`).value.trim();
  const version = document.getElementById(`version-actualizar-${title_file_id}`).value.trim();
  const archivo = document.getElementById(`pdf-actualizar-${title_file_id}`).files[0];

  if (!version) {
    mostrarBanner("banner", "error", "La versión es obligatoria.");
    return;
  }
  const error_pdf = validarPdfLineamiento(archivo);
  if (error_pdf) {
    mostrarBanner("banner", "error", error_pdf);
    return;
  }

  const boton = document.getElementById(`btn-guardar-actualizar-${title_file_id}`);
  boton.disabled = true;
  boton.textContent = "Guardando...";

  try {
    const res = await subirDocumento({ title_file: title_file_real, desc_file: descripcion, version_label: version, archivo });
    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      mostrarBanner("banner", "error", datos.mensaje || "No fue posible guardar la nueva versión.");
      boton.disabled = false;
      boton.textContent = "Guardar nueva versión";
      return;
    }

    mostrarBanner("banner", "success", datos.mensaje || "Nueva versión publicada correctamente.");
    await cargarDocumentos();
  } catch {
    mostrarBanner("banner", "error", "No fue posible conectar con el servidor.");
    boton.disabled = false;
    boton.textContent = "Guardar nueva versión";
  }
}

/**
 * Abre el historial de versiones de un documento puntual, vía
 * GET /ciclos/:id_cycle/documentos/:title_file/historial?tipo=Lineamiento.
 * El título va URL-encoded porque es texto libre (puede traer
 * espacios o tildes).
 */
async function verHistorial(title_file_real) {
  document.getElementById("historial-titulo").textContent = `Historial — ${title_file_real}`;
  const cuerpo = document.getElementById("cuerpo-historial");
  cuerpo.innerHTML = `<p class="text-muted fst-italic">Cargando...</p>`;

  const modal = new bootstrap.Modal(document.getElementById("modal-historial"));
  modal.show();

  try {
    const res = await peticionApi(
      `/ciclos/${id_cycle_actual}/documentos/${encodeURIComponent(title_file_real)}/historial?tipo=${TIPO_DOCUMENTO}`
    );
    if (!res.ok) throw new Error();
    const historial = await res.json();

    if (!Array.isArray(historial) || historial.length === 0) {
      cuerpo.innerHTML = `<p class="text-muted fst-italic">Sin versiones anteriores.</p>`;
      return;
    }

    // uploaded_by llega como id de usuario, sin nombre — mismo patrón que
    // id_leader en propuestas. Pendiente de confirmar con backend si lo
    // traducen a un nombre; mientras tanto se muestra el id tal cual.
    cuerpo.innerHTML = `
        <ul class="list-group">
            ${historial
            .map(
                (version) => `
            <li class="list-group-item">
                <strong>${escaparHtml(version.version_label)}</strong>
                <span class="text-muted ms-2" style="font-size:.8rem;">
                ${escaparHtml(new Date(version.uploaded_at).toLocaleDateString("es-CO"))} — subido por ${escaparHtml(version.uploaded_by)}
                </span>
            </li>`
            )
            .join("")}
        </ul>`;
  } catch {
    cuerpo.innerHTML = `<p class="text-muted fst-italic">No fue posible cargar el historial.</p>`;
  }
}

/** Pinta la lista de documentos vigentes (visor, todos los roles). */
function pintarDocumentos(usuario) {
  const contenedor = document.getElementById("contenedor-lineamientos");

  if (documentos_vigentes.length === 0) {
    contenedor.innerHTML = `<p class="text-muted fst-italic">Este ciclo todavía no tiene lineamientos publicados.</p>`;
    return;
  }

  const es_admin = usuario && usuario.rol === "administrador";

  contenedor.innerHTML = documentos_vigentes
    .map((doc) => {
      const id_fila = `doc-${doc.id_document}`;
      return `
      <div class="card-resumen mb-3" id="fila-${id_fila}">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <span class="label">${escaparHtml(doc.title_file)}</span>
            <p style="margin:0;font-weight:700;">Versión ${escaparHtml(doc.version_label)}</p>
            ${doc.desc_file ? `<p class="text-muted mb-0 mt-1" style="font-size:.82rem;">${escaparHtml(doc.desc_file)}</p>` : ""}
            <div id="enlace-${id_fila}" class="mt-2"></div>
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-outline-secondary" onclick="verHistorial('${encodeURIComponent(doc.title_file)}')">
              Ver historial
            </button>
            ${
              es_admin
                ? `<button type="button" class="btn btn-sm btn-outline-primary" id="btn-actualizar-${id_fila}"
                           onclick="toggleFormularioActualizar('${id_fila}', true)">
                     Actualizar
                   </button>`
                : ""
            }
          </div>
        </div>

        ${
          es_admin
            ? `<form id="form-actualizar-${id_fila}" class="row g-2 mt-3 hidden" onsubmit="return false;">
                 <div class="col-12 col-md-4">
                   <label class="form-label">Título (no editable)</label>
                   <input type="text" class="form-control" value="${escaparHtml(doc.title_file)}" disabled>
                 </div>
                 <div class="col-12 col-md-4">
                   <label for="descripcion-actualizar-${id_fila}" class="form-label">Descripción</label>
                   <input type="text" class="form-control" id="descripcion-actualizar-${id_fila}" value="${escaparHtml(doc.desc_file || "")}">
                 </div>
                 <div class="col-6 col-md-2">
                   <label for="version-actualizar-${id_fila}" class="form-label">Nueva versión</label>
                   <input type="text" class="form-control" id="version-actualizar-${id_fila}" placeholder="V2">
                 </div>
                 <div class="col-6 col-md-2">
                   <label for="pdf-actualizar-${id_fila}" class="form-label">PDF</label>
                   <input type="file" class="form-control" id="pdf-actualizar-${id_fila}" accept="application/pdf">
                 </div>
                 <div class="col-12 d-flex gap-2">
                   <button type="button" class="btn btn-sm btn-primary" id="btn-guardar-actualizar-${id_fila}"
                           onclick="actualizarDocumento('${id_fila}', '${escaparHtml(doc.title_file).replace(/'/g, "\\'")}')">
                     Guardar nueva versión
                   </button>
                   <button type="button" class="btn btn-sm btn-outline-secondary" onclick="toggleFormularioActualizar('${id_fila}', false)">
                     Cancelar
                   </button>
                 </div>
               </form>`
            : ""
        }
      </div>`;
    })
    .join("");

  // El propio objeto "doc" ya trae { url, expira_en_segundos } sueltos
  // (no anidados en un url_file aparte) — se le pasa tal cual a renderEnlacePdf,
  // que solo lee esas dos propiedades e ignora el resto.
  documentos_vigentes.forEach((doc) => {
    renderEnlacePdf(
      document.getElementById(`enlace-doc-${doc.id_document}`),
      doc,
      "📄 Ver / descargar"
    );
  });
}

/** Carga los documentos vigentes del ciclo desde GET /ciclos/:id_cycle/documentos. */
async function cargarDocumentos() {
  const usuario = obtenerUsuario();
  try {
    const res = await peticionApi(`/ciclos/${id_cycle_actual}/documentos?tipo=${TIPO_DOCUMENTO}`);
    if (!res.ok) throw new Error();
    documentos_vigentes = await res.json(); // siempre una lista, nunca null
  } catch {
    document.getElementById("contenedor-lineamientos").innerHTML =
      `<p class="text-muted fst-italic">No fue posible cargar los lineamientos.</p>`;
    return;
  }
  pintarDocumentos(usuario);
}

async function inicializarLineamientos() {
  const usuario = obtenerUsuario();

  // El ciclo viene de ?ciclo= en la URL (lo pone ciclos.html para el
  // administrador) o, si no viene, del propio id_cycle del usuario
  // (Estudiante/Profesor consultando los lineamientos de su ciclo).
  const id_cycle_url = new URLSearchParams(window.location.search).get("ciclo");
  id_cycle_actual = id_cycle_url || (usuario && usuario.id_cycle);

  if (!id_cycle_actual) {
    document.getElementById("contenedor-lineamientos").innerHTML =
      `<p class="text-muted fst-italic">No se indicó para qué ciclo mostrar los lineamientos.</p>`;
    return;
  }

  if (usuario && usuario.rol === "administrador") {
    pintarFormularioAgregar();
  }

  await cargarDocumentos();
}