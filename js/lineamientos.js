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
//
// CICLO A MOSTRAR (ver resolverCiclosDisponibles):
//   - Estudiante: su id_cycle (viene en el JWT).
//   - Profesor: los ciclos de encargado_de + jurado_de.
//   - Administrador: todos los ciclos de GET /ciclos.
// Si viene ?ciclo= en la URL (desde ciclos.html) y es uno de los
// disponibles, se usa ese. Si hay más de un ciclo posible se pinta
// un selector arriba para cambiar de ciclo sin salir de la página.
// ============================================================

const TIPO_DOCUMENTO = "Lineamiento";
const TAMANO_MAXIMO_LINEAMIENTO_MB = 10;

let id_cycle_actual = null;
let documentos_vigentes = [];
let ciclos_disponibles = []; // [{ id, nombre }]

// Prefijo fijo de la versión: el usuario solo escribe el número y al
// BE siempre se envía el texto completo (ej. "v2").
const PREFIJO_VERSION = "v";

/** Saca el número de un version_label ("v3", "V3", "3") → 3. Si no tiene número → 0. */
function numeroDeVersion(version_label) {
  const coincidencia = String(version_label || "").match(/\d+/);
  return coincidencia ? Number(coincidencia[0]) : 0;
}

/** Arma el version_label que se envía al BE a partir del número (2 → "v2"). */
function armarVersionLabel(numero) {
  return `${PREFIJO_VERSION}${numero}`;
}

/**
 * Lee el número escrito en un input de versión y lo valida.
 * Devuelve { numero } si está bien o { error } si no.
 * Si se pasa version_actual, el número debe ser mayor que esa versión.
 */
function leerNumeroVersion(id_input, version_actual = 0) {
  const texto = document.getElementById(id_input).value.trim();
  if (!/^[1-9]\d*$/.test(texto)) return { error: "La versión debe ser un número entero mayor a 0." };
  const numero = Number(texto);
  if (numero <= version_actual) {
    return { error: `La nueva versión debe ser mayor a la actual (${armarVersionLabel(version_actual)}).` };
  }
  return { numero };
}

/** HTML del campo de versión: "v" fijo a la izquierda y solo el número editable. */
function campoVersion(id_input, etiqueta, valor_inicial) {
  return `
    <label for="${id_input}" class="form-label">${etiqueta}</label>
    <div class="input-group">
      <span class="input-group-text">${PREFIJO_VERSION}</span>
      <input type="number" class="form-control" id="${id_input}" min="1" step="1" inputmode="numeric" value="${valor_inicial}">
    </div>`;
}

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
            ${campoVersion("version-nuevo", "Versión", 1)}
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
    const archivo = document.getElementById("pdf-nuevo").files[0];

    if (!titulo) {
      mostrarBanner("banner", "error", "El título es obligatorio.");
      return;
    }
    const lectura_version = leerNumeroVersion("version-nuevo");
    if (lectura_version.error) {
      mostrarBanner("banner", "error", lectura_version.error);
      return;
    }
    const version = armarVersionLabel(lectura_version.numero);
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
async function actualizarDocumento(title_file_id, id_document) {
  ocultarBanner("banner");

  // El título real se busca en los documentos ya cargados (no viaja
  // por el onclick, así no se rompe con comillas, tildes o espacios).
  const doc = documentos_vigentes.find((d) => d.id_document === id_document);
  if (!doc) return;
  const title_file_real = doc.title_file;

  const descripcion = document.getElementById(`descripcion-actualizar-${title_file_id}`).value.trim();
  const archivo = document.getElementById(`pdf-actualizar-${title_file_id}`).files[0];

  // La nueva versión tiene que ser mayor que la vigente (ej. vigente v2 → mínimo v3)
  const lectura_version = leerNumeroVersion(`version-actualizar-${title_file_id}`, numeroDeVersion(doc.version_label));
  if (lectura_version.error) {
    mostrarBanner("banner", "error", lectura_version.error);
    return;
  }
  const version = armarVersionLabel(lectura_version.numero);
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
async function verHistorial(id_document) {
  // Se busca el título real del documento; se codifica UNA sola vez
  // al armar la URL (antes se codificaba dos veces y el BE no lo encontraba).
  const doc = documentos_vigentes.find((d) => d.id_document === id_document);
  if (!doc) return;
  const title_file_real = doc.title_file;

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

    // uploaded_by ya llega como nombre (el BE hace JOIN con users).
    // uploaded_at llega como "YYYY-MM-DD HH:mm:ss"; se cambia el espacio
    // por "T" para que new Date() lo lea igual en todos los navegadores.
    cuerpo.innerHTML = `
        <ul class="list-group">
            ${historial
            .map(
                (version) => `
            <li class="list-group-item">
                <strong>${escaparHtml(version.version_label)}</strong>
                <span class="text-muted ms-2" style="font-size:.8rem;">
                ${escaparHtml(new Date(String(version.uploaded_at).replace(" ", "T")).toLocaleDateString("es-CO"))} — subido por ${escaparHtml(version.uploaded_by)}
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
            <button type="button" class="btn btn-sm btn-outline-secondary" onclick="verHistorial(${doc.id_document})">
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
                   ${campoVersion(`version-actualizar-${id_fila}`, "Nueva versión", numeroDeVersion(doc.version_label) + 1)}
                 </div>
                 <div class="col-6 col-md-2">
                   <label for="pdf-actualizar-${id_fila}" class="form-label">PDF</label>
                   <input type="file" class="form-control" id="pdf-actualizar-${id_fila}" accept="application/pdf">
                 </div>
                 <div class="col-12 d-flex gap-2">
                   <button type="button" class="btn btn-sm btn-primary" id="btn-guardar-actualizar-${id_fila}"
                           onclick="actualizarDocumento('${id_fila}', ${doc.id_document})">
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
  // (mismo nombre con guion bajo que usa el BE en todos los endpoints)
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
    const datos = await res.json();
    documentos_vigentes = Array.isArray(datos) ? datos : [];
  } catch {
    document.getElementById("contenedor-lineamientos").innerHTML =
      `<p class="text-muted fst-italic">No fue posible cargar los lineamientos.</p>`;
    return;
  }
  pintarDocumentos(usuario);
}

/**
 * Arma la lista de ciclos que este usuario puede consultar, con su
 * nombre. GET /ciclos devuelve { id, subject_cycle, ... } (contrato
 * del API, no nombres de la BD).
 */
async function resolverCiclosDisponibles(usuario) {
  let todos = [];
  try {
    const res = await peticionApi("/ciclos");
    todos = res.ok ? await res.json() : [];
  } catch {
    todos = [];
  }
  const nombre_de = (id) => {
    const c = todos.find((x) => x.id === Number(id));
    return c && c.subject_cycle ? c.subject_cycle : `Ciclo ${id}`;
  };

  if (usuario.rol === "administrador") {
    return todos.map((c) => ({ id: c.id, nombre: c.subject_cycle || `Ciclo ${c.id}` }));
  }
  if (usuario.rol === "profesor") {
    const ids = [...new Set([...(usuario.encargado_de || []), ...(usuario.jurado_de || [])].map(Number))];
    return ids.map((id) => ({ id, nombre: nombre_de(id) }));
  }
  // Estudiante: solo su ciclo
  return usuario.id_cycle ? [{ id: Number(usuario.id_cycle), nombre: nombre_de(usuario.id_cycle) }] : [];
}

/** Pinta el selector de ciclo (solo si hay más de una opción). */
function pintarSelectorCiclo(usuario) {
  let contenedor = document.getElementById("contenedor-selector-ciclo");
  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "contenedor-selector-ciclo";
    contenedor.className = "mb-3";
    const ancla = document.getElementById("contenedor-agregar");
    ancla.parentNode.insertBefore(contenedor, ancla);
  }

  if (ciclos_disponibles.length <= 1) {
    const unico = ciclos_disponibles[0];
    contenedor.innerHTML = unico
      ? `<p class="mb-0"><strong>Ciclo:</strong> ${escaparHtml(unico.nombre)}</p>`
      : "";
    return;
  }

  contenedor.innerHTML = `
    <label for="selector-ciclo" class="form-label fw-semibold">Ciclo</label>
    <select id="selector-ciclo" class="form-select" style="max-width:320px;">
      ${ciclos_disponibles
        .map((c) => `<option value="${c.id}" ${c.id === Number(id_cycle_actual) ? "selected" : ""}>${escaparHtml(c.nombre)}</option>`)
        .join("")}
    </select>`;

  document.getElementById("selector-ciclo").addEventListener("change", async (evento) => {
    id_cycle_actual = Number(evento.target.value);
    // Se deja el ciclo en la URL para que un recargo mantenga la selección
    history.replaceState(null, "", `?ciclo=${id_cycle_actual}`);
    ocultarBanner("banner");
    if (usuario.rol === "administrador") pintarFormularioAgregar();
    await cargarDocumentos();
  });
}

async function inicializarLineamientos() {
  const usuario = obtenerUsuario();
  if (!usuario) return;

  ciclos_disponibles = await resolverCiclosDisponibles(usuario);

  // ?ciclo= solo se respeta si es un número y está entre los disponibles
  const id_cycle_url = Number(new URLSearchParams(window.location.search).get("ciclo"));
  const url_valida = Number.isInteger(id_cycle_url) && ciclos_disponibles.some((c) => c.id === id_cycle_url);
  id_cycle_actual = url_valida ? id_cycle_url : (ciclos_disponibles[0] ? ciclos_disponibles[0].id : null);

  if (!id_cycle_actual) {
    document.getElementById("contenedor-lineamientos").innerHTML =
      `<p class="text-muted fst-italic">No tienes un ciclo asociado para consultar lineamientos.</p>`;
    return;
  }

  pintarSelectorCiclo(usuario);

  if (usuario.rol === "administrador") {
    pintarFormularioAgregar();
  }

  await cargarDocumentos();
}