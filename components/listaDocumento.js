// ============================================================
// LISTADOCUMENTO.JS — componente reutilizable: lista de documentos
// vigentes (uno por title_file) con historial de versiones y, si el
// usuario tiene permiso, subir una nueva versión de uno existente o
// agregar un documento nuevo.
//
// Lo usa rubrica.html (por ciclo, Encargado de ese ciclo). En el
// Issue 9 lo usará también lineamientos (global, Administrador).
//
// Regla clave: al ACTUALIZAR un documento, el título viaja fijo
// (nunca se vuelve a escribir) para no romper el amarre entre
// versiones; solo "Agregar documento nuevo" permite escribir título.
//
// Requiere en la página: bootstrap.bundle (para el modal de historial),
// utils.js, auth.js y un <div> contenedor + un banner.
// ============================================================

const TAMANO_MAXIMO_DOCUMENTO_MB = 10;

/**
 * @param {object} config
 * @param {string} config.idContenedor - id del <div> donde se pinta todo.
 * @param {string} config.idBanner - id del banner de mensajes de la página.
 * @param {string} config.textoVacio - texto cuando no hay documentos.
 * @param {() => boolean} config.puedeEditar - se evalúa cada vez que se pinta.
 * @param {() => string} config.rutaLista - GET: lista de documentos vigentes.
 * @param {() => string} config.rutaSubir - POST: nueva versión o documento nuevo.
 * @param {(titulo: string) => string} config.rutaHistorial - GET: historial de un documento.
 * @returns {{ recargar: () => Promise<void> }}
 */
function crearListaDocumento(config) {
  const contenedor = document.getElementById(config.idContenedor);
  const prefijo = config.idContenedor;
  let documentos = [];

  contenedor.innerHTML = `<div data-zona="agregar"></div><div data-zona="lista"></div>`;
  const zona_agregar = contenedor.querySelector('[data-zona="agregar"]');
  const zona_lista = contenedor.querySelector('[data-zona="lista"]');

  // ── Modal de historial (se crea una sola vez, el componente lo trae) ──
  const id_modal = `${prefijo}-modal-historial`;
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="modal fade" id="${id_modal}" tabindex="-1" aria-labelledby="${id_modal}-titulo" aria-hidden="true">
       <div class="modal-dialog">
         <div class="modal-content">
           <div class="modal-header">
             <h5 class="modal-title" id="${id_modal}-titulo"></h5>
             <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
           </div>
           <div class="modal-body" id="${id_modal}-cuerpo"></div>
         </div>
       </div>
     </div>`
  );
  const modal_historial = new bootstrap.Modal(document.getElementById(id_modal));

  /** Valida que el archivo sea un PDF dentro del tamaño máximo. */
  function validarPdf(archivo) {
    if (!archivo) return "Debes seleccionar el PDF del documento.";
    if (archivo.type !== "application/pdf") return "El archivo debe ser un PDF.";
    if (archivo.size / (1024 * 1024) > TAMANO_MAXIMO_DOCUMENTO_MB) {
      return `El PDF no debe superar ${TAMANO_MAXIMO_DOCUMENTO_MB} MB.`;
    }
    return null;
  }

  /**
   * Campo de versión con la "V" fija (no editable): el usuario solo escribe
   * el número (1, 1.0, 2.1...) y al guardar se envía "V" + número.
   */
  function campoVersion(id, sugerencia) {
    //aca el campo ya viene lleno con la siguiente version (se puede cambiar si hace falta)
    return `
      <div class="input-group">
        <span class="input-group-text" aria-hidden="true">V</span>
        <input type="text" class="form-control" id="${id}" name="version" inputmode="decimal"
               value="${escaparHtml(sugerencia)}" data-sugerida="${escaparHtml(sugerencia)}"
               aria-describedby="${id}-ayuda" autocomplete="off">
      </div>
      <span id="${id}-ayuda" class="visually-hidden">Se llena sola con la siguiente versión; la V se agrega sola.</span>`;
  }

  /** Sugerencia de la siguiente versión a partir de la vigente ("V2.0" → "3.0"). */
  function siguienteVersion(version_actual) {
    const numero = String(version_actual ?? "").replace(/^v\s*/i, "");
    const mayor = parseInt(numero, 10);
    if (Number.isNaN(mayor)) return "1.0";
    const tiene_decimal = numero.includes(".");
    return tiene_decimal ? `${mayor + 1}.0` : String(mayor + 1);
  }

  /**
   * Toma lo que escribió el usuario y devuelve { version, error }.
   * Si pegó la V por costumbre ("v2"), se la quita para no guardar "VV2".
   */
  function leerVersion(texto) {
    const numero = String(texto ?? "").trim().replace(/^v\s*/i, "");
    if (!numero) return { version: null, error: "La versión es obligatoria." };
    if (!/^\d+(\.\d+)*$/.test(numero)) {
      return { version: null, error: "La versión debe ser un número, por ejemplo 1.0 o 2." };
    }
    return { version: `V${numero}`, error: null };
  }

  function formatearFecha(valor) {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? "" : fecha.toLocaleDateString("es-CO");
  }

  /**
   * Envía una versión al backend (mismo endpoint para "actualizar uno
   * existente" y "agregar uno nuevo"). Devuelve true si se guardó.
   */
  async function publicar(datos, boton, texto_boton) {
    ocultarBanner(config.idBanner);
    boton.disabled = true;
    boton.textContent = "Guardando...";

    try {
      const fd = new FormData();
      fd.append("title_file", datos.title_file);
      if (datos.desc_file) fd.append("desc_file", datos.desc_file);
      fd.append("version_label", datos.version_label);
      fd.append("archivo", datos.archivo);

      const res = await peticionApi(config.rutaSubir(), { method: "POST", body: fd });
      const respuesta = await res.json().catch(() => ({}));

      if (!res.ok) {
        mostrarBanner(config.idBanner, "error", respuesta.mensaje || "No fue posible guardar el documento.");
        return false;
      }
      mostrarBanner(config.idBanner, "success", respuesta.mensaje || "Documento guardado correctamente.");
      return true;
    } catch {
      mostrarBanner(config.idBanner, "error", "No fue posible conectar con el servidor.");
      return false;
    } finally {
      boton.disabled = false;
      boton.textContent = texto_boton;
    }
  }

  /** Botón + formulario de "Agregar documento nuevo" (título en blanco y editable). */
  function pintarZonaAgregar() {
    if (!config.puedeEditar()) {
      zona_agregar.innerHTML = "";
      return;
    }

    zona_agregar.innerHTML = `
      <button type="button" class="btn btn-outline-primary mb-3" data-accion="mostrar-agregar">+ Agregar documento nuevo</button>

      <div class="card-resumen mb-3 hidden" data-zona="form-agregar">
        <h3 style="font-size:1rem;font-weight:700;color:var(--verde-udec);margin-bottom:.75rem;">Nuevo documento</h3>
        <form class="row g-2" data-form="agregar" novalidate>
          <div class="col-12 col-md-4">
            <label for="${prefijo}-titulo-nuevo" class="form-label">Título</label>
            <input type="text" class="form-control" id="${prefijo}-titulo-nuevo" name="titulo">
          </div>
          <div class="col-12 col-md-4">
            <label for="${prefijo}-desc-nuevo" class="form-label">Descripción (opcional)</label>
            <input type="text" class="form-control" id="${prefijo}-desc-nuevo" name="descripcion">
          </div>
          <div class="col-6 col-md-2">
            <label for="${prefijo}-version-nuevo" class="form-label">Versión</label>
            ${campoVersion(`${prefijo}-version-nuevo`, "1.0")}
          </div>
          <div class="col-6 col-md-2">
            <label for="${prefijo}-pdf-nuevo" class="form-label">PDF</label>
            <input type="file" class="form-control" id="${prefijo}-pdf-nuevo" name="archivo" accept="application/pdf">
          </div>
          <div class="col-12 d-flex gap-2">
            <button type="submit" class="btn btn-primary">Publicar</button>
            <button type="button" class="btn btn-outline-secondary" data-accion="cancelar-agregar">Cancelar</button>
          </div>
        </form>
      </div>`;
  }

  /** Lista de documentos vigentes, con historial y (si hay permiso) actualizar. */
  function pintarLista() {
    if (documentos.length === 0) {
      zona_lista.innerHTML = `<p class="text-muted fst-italic">${escaparHtml(config.textoVacio)}</p>`;
      return;
    }

    const editable = config.puedeEditar();

    zona_lista.innerHTML = documentos
      .map((doc) => {
        const id = escaparHtml(doc.id_document);
        const base = `${prefijo}-${id}`;
        return `
        <div class="card-resumen mb-3" data-doc="${id}">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <span class="label">${escaparHtml(doc.title_file)}</span>
              <p style="margin:0;font-weight:700;">Versión ${escaparHtml(doc.version_label)}</p>
              ${doc.desc_file ? `<p class="text-muted mb-0 mt-1" style="font-size:.82rem;">${escaparHtml(doc.desc_file)}</p>` : ""}
              <div data-zona="enlace" class="mt-2"></div>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <button type="button" class="btn btn-sm btn-outline-secondary" data-accion="historial" data-id="${id}">Ver historial</button>
              ${editable ? `<button type="button" class="btn btn-sm btn-outline-primary" data-accion="mostrar-actualizar" data-id="${id}">Actualizar</button>` : ""}
            </div>
          </div>

          ${
            editable
              ? `<form class="row g-2 mt-3 hidden" data-form="actualizar" data-id="${id}" novalidate>
                   <div class="col-12 col-md-4">
                     <label for="${base}-titulo" class="form-label">Título (no editable)</label>
                     <input type="text" class="form-control" id="${base}-titulo" value="${escaparHtml(doc.title_file)}" disabled>
                   </div>
                   <div class="col-12 col-md-4">
                     <label for="${base}-desc" class="form-label">Descripción</label>
                     <input type="text" class="form-control" id="${base}-desc" name="descripcion" value="${escaparHtml(doc.desc_file || "")}">
                   </div>
                   <div class="col-6 col-md-2">
                     <label for="${base}-version" class="form-label">Nueva versión</label>
                     ${campoVersion(`${base}-version`, siguienteVersion(doc.version_label))}
                   </div>
                   <div class="col-6 col-md-2">
                     <label for="${base}-pdf" class="form-label">PDF</label>
                     <input type="file" class="form-control" id="${base}-pdf" name="archivo" accept="application/pdf">
                   </div>
                   <div class="col-12 d-flex gap-2">
                     <button type="submit" class="btn btn-sm btn-primary">Guardar nueva versión</button>
                     <button type="button" class="btn btn-sm btn-outline-secondary" data-accion="cancelar-actualizar" data-id="${id}">Cancelar</button>
                   </div>
                 </form>`
              : ""
          }
        </div>`;
      })
      .join("");

    // El backend manda url y expira_en_segundos sueltos en el propio documento,
    // que es justo lo que lee renderEnlacePdf. Mismo orden que el .map de arriba.
    zona_lista.querySelectorAll("[data-doc]").forEach((tarjeta, i) => {
      renderEnlacePdf(tarjeta.querySelector('[data-zona="enlace"]'), documentos[i], "📄 Ver / descargar");
    });
  }

  /** Pide al backend los documentos vigentes y los pinta. */
  async function cargar() {
    try {
      const res = await peticionApi(config.rutaLista());
      if (res.status === 403) {
        documentos = [];
        zona_lista.innerHTML = `<p class="text-muted fst-italic">No tienes acceso a los documentos de este ciclo.</p>`;
        return;
      }
      if (!res.ok) throw new Error();
      const datos = await res.json();
      documentos = Array.isArray(datos) ? datos : [];
    } catch {
      documentos = [];
      zona_lista.innerHTML = `<p class="text-muted fst-italic">No fue posible cargar los documentos.</p>`;
      return;
    }
    pintarLista();
  }

  /** Abre el historial de versiones (solo metadata) de un documento. */
  async function abrirHistorial(titulo) {
    document.getElementById(`${id_modal}-titulo`).textContent = `Historial — ${titulo}`;
    const cuerpo = document.getElementById(`${id_modal}-cuerpo`);
    cuerpo.innerHTML = `<p class="text-muted fst-italic">Cargando...</p>`;
    modal_historial.show();

    try {
      const res = await peticionApi(config.rutaHistorial(titulo));
      if (!res.ok) throw new Error();
      const historial = await res.json();

      if (!Array.isArray(historial) || historial.length === 0) {
        cuerpo.innerHTML = `<p class="text-muted fst-italic">Sin versiones anteriores.</p>`;
        return;
      }

      // uploaded_by ya llega como nombre (confirmado con backend).
      cuerpo.innerHTML = `
        <ul class="list-group">
          ${historial
            .map(
              (v) => `
            <li class="list-group-item">
              <strong>${escaparHtml(v.version_label)}</strong>
              <span class="text-muted ms-2" style="font-size:.8rem;">
                ${escaparHtml(formatearFecha(v.uploaded_at))} — subido por ${escaparHtml(v.uploaded_by)}
              </span>
            </li>`
            )
            .join("")}
        </ul>`;
    } catch {
      cuerpo.innerHTML = `<p class="text-muted fst-italic">No fue posible cargar el historial.</p>`;
    }
  }

  // ── Eventos delegados: un solo listener, sin onclick en el HTML ──────────
  contenedor.addEventListener("click", (evento) => {
    const control = evento.target.closest("[data-accion]");
    if (!control) return;

    const accion = control.dataset.accion;
    const id = control.dataset.id;

    if (accion === "mostrar-agregar") {
      zona_agregar.querySelector('[data-zona="form-agregar"]').classList.remove("hidden");
      control.classList.add("hidden");
    } else if (accion === "cancelar-agregar") {
      zona_agregar.querySelector('[data-zona="form-agregar"]').classList.add("hidden");
      zona_agregar.querySelector('[data-accion="mostrar-agregar"]').classList.remove("hidden");
    } else if (accion === "mostrar-actualizar") {
      zona_lista.querySelector(`form[data-form="actualizar"][data-id="${id}"]`).classList.remove("hidden");
      control.classList.add("hidden");
    } else if (accion === "cancelar-actualizar") {
      //al cancelar se devuelve la version a la sugerida, por si la habian cambiado
      const campo = zona_lista.querySelector(`form[data-form="actualizar"][data-id="${id}"] [name="version"]`);
      if (campo) campo.value = campo.dataset.sugerida || "";
      zona_lista.querySelector(`form[data-form="actualizar"][data-id="${id}"]`).classList.add("hidden");
      zona_lista.querySelector(`[data-accion="mostrar-actualizar"][data-id="${id}"]`).classList.remove("hidden");
    } else if (accion === "historial") {
      const doc = documentos.find((d) => String(d.id_document) === id);
      if (doc) abrirHistorial(doc.title_file);
    }
  });

  contenedor.addEventListener("submit", async (evento) => {
    const form = evento.target.closest("form[data-form]");
    if (!form) return;
    evento.preventDefault();

    const boton = form.querySelector('button[type="submit"]');
    const texto_boton = boton.textContent;
    const descripcion = form.elements["descripcion"].value.trim();
    const { version, error: error_version } = leerVersion(form.elements["version"].value);
    const archivo = form.elements["archivo"].files[0];

    let titulo;
    if (form.dataset.form === "agregar") {
      titulo = form.elements["titulo"].value.trim();
      if (!titulo) {
        mostrarBanner(config.idBanner, "error", "El título es obligatorio.");
        return;
      }
    } else {
      // Actualizar: el título sale del documento en memoria, jamás del teclado.
      const doc = documentos.find((d) => String(d.id_document) === form.dataset.id);
      if (!doc) return;
      titulo = doc.title_file;
    }

    if (error_version) {
      mostrarBanner(config.idBanner, "error", error_version);
      form.elements["version"].focus();
      return;
    }
    const error_pdf = validarPdf(archivo);
    if (error_pdf) {
      mostrarBanner(config.idBanner, "error", error_pdf);
      return;
    }

    const guardado = await publicar(
      { title_file: titulo, desc_file: descripcion, version_label: version, archivo },
      boton,
      texto_boton
    );

    if (guardado) {
      if (form.dataset.form === "agregar") pintarZonaAgregar(); // vuelve a pintarla cerrada y limpia
      await cargar();
    }
  });

  return {
    /** Repinta el formulario de agregar y vuelve a pedir la lista (úsalo al cambiar de ciclo). */
    recargar: async () => {
      pintarZonaAgregar();
      await cargar();
    },
  };
}