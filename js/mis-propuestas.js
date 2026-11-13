// ============================================================
// MIS-PROPUESTAS.JS — vista de estado de la propuesta del
// estudiante (HU-09), con el mismo diseño de "Mi PGC" (Issue 11):
// cabecera + dos columnas + formulario de reenvío accesible (Issue 7).
// Usa las piezas reutilizables de utils.js (bloqueCampo, bloqueTexto,
// listaChips, validarCampos, enfocarBanner).
// ============================================================

const TAMANO_MAXIMO_PDF_REENVIO_MB = 10;

const CLASE_POR_ESTADO = {
  "Pendiente de validación": "pendiente",
  "Aprobada": "aprobada",
  "Rechazada": "rechazada",
  "Anulada": "anulada",
};

/**
 * Normaliza un nombre para compararlo sin depender de mayúsculas,
 * tildes sueltas o espacios sobrantes.
 */
function normalizarNombre(nombre) {
  return String(nombre ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Valida el PDF del reenvío: obligatorio, tipo PDF y tamaño máximo. */
function validarPdfReenvio(archivo) {
  if (!archivo) return "Debes adjuntar el PDF actualizado de la propuesta.";
  if (archivo.type !== "application/pdf") return "El archivo debe ser un PDF.";
  if (archivo.size / (1024 * 1024) > TAMANO_MAXIMO_PDF_REENVIO_MB) {
    return `El PDF no debe superar ${TAMANO_MAXIMO_PDF_REENVIO_MB} MB.`;
  }
  return null;
}

/**
 * Carga las categorías desde la API y renderiza checkboxes en el formulario
 * de reenvío, preseleccionando las que ya tiene la propuesta.
 * @param {Array<{id_category:number}>} categoriasActuales - Categorías guardadas.
 */
async function pintarCategoriasReenvio(categoriasActuales) {
  const contenedor = document.getElementById("lista-categorias-reenvio");
  if (!contenedor) return;

  const idsActuales = (categoriasActuales || []).map((c) =>
    typeof c === "object" ? c.id_category : Number(c)
  );

  try {
    const res = await peticionApi("/categorias");
    const categorias = await res.json();

    if (!res.ok || !Array.isArray(categorias) || categorias.length === 0) {
      contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.82rem;">No se pudieron cargar las categorías.</p>`;
      return;
    }

    contenedor.innerHTML = categorias
      .map((c) => {
        const marcado = idsActuales.includes(c.id_category) ? "checked" : "";
        return `
          <div class="form-check">
            <input class="form-check-input" type="checkbox"
                   value="${c.id_category}" id="rcat-${c.id_category}" ${marcado}>
            <label class="form-check-label" for="rcat-${c.id_category}">${escaparHtml(c.name_category)}</label>
          </div>`;
      })
      .join("");

    contenedor.dataset.categorias = JSON.stringify(categorias);
  } catch {
    contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.82rem;">Error al cargar categorías.</p>`;
  }
}

/**
 * Muestra u oculta el formulario de edición y mueve el foco con él:
 * al abrir, al primer campo; al cerrar, de vuelta al botón (WCAG 2.4.3).
 */
function toggleFormularioReenvio(visible) {
  const form = document.getElementById("form-reenvio");
  const btnAbrir = document.getElementById("btn-abrir-reenvio");
  if (!form || !btnAbrir) return;
  form.classList.toggle("hidden", !visible);
  btnAbrir.classList.toggle("hidden", visible);
  const destino = visible ? document.getElementById("re-titulo") : btnAbrir;
  if (destino) destino.focus();
}

/**
 * Pinta los checkboxes de integrantes desde la API y marca
 * los que ya pertenecen a la propuesta.
 * @param {Array<number|{id_user:number}>} seleccionados - IDs o objetos de integrantes ya en la propuesta.
 */
async function pintarIntegrantesReenvio(seleccionados) {
  const contenedor = document.getElementById("lista-integrantes-reenvio");
  if (!contenedor) return;

  // Normalizar seleccionados: puede ser array de objetos {id_user} o de números
  const idsSeleccionados = seleccionados.map((s) => (typeof s === "object" ? s.id_user : s));

  try {
    // El BE obtiene el ciclo del estudiante a través del token (no se envía ?ciclo)
    const res = await peticionApi("/estudiantes");
    const estudiantes = await res.json();

    if (!res.ok || !Array.isArray(estudiantes) || estudiantes.length === 0) {
      contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.82rem;">No hay otros estudiantes disponibles en tu ciclo.</p>`;
      return;
    }

    contenedor.innerHTML = estudiantes
      .map((e) => {
        // Mapeo correcto: id_user (no .id), full_name (no .nombre)
        const marcado = idsSeleccionados.includes(e.id_user) ? "checked" : "";
        return `
          <div class="form-check">
            <input class="form-check-input" type="checkbox" value="${e.id_user}" id="ri-${e.id_user}" ${marcado}>
            <label class="form-check-label" for="ri-${e.id_user}">${escaparHtml(e.full_name)}</label>
          </div>`;
      })
      .join("");

    // Guardamos la lista en el DOM para poder leerla al hacer submit.
    contenedor.dataset.estudiantes = JSON.stringify(estudiantes);
  } catch {
    contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.82rem;">No fue posible cargar los integrantes.</p>`;
  }
}

/**
 * Carga y pinta la propuesta del estudiante.
 * @param {string} [mensaje_exito] - si se pasa, se muestra como banner de éxito
 *   arriba de la tarjeta una vez repintada (se usa tras un reenvío correcto).
 */
async function inicializarMiPropuesta(mensaje_exito) {
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

  // id_leader llega como id_student (tabla students), no como id_user, así
  // que no se puede comparar con usuario.id del JWT. Se compara por nombre:
  // el nombre del JWT contra leader_name. Se exige que no esté vacío para que
  // dos nombres ausentes no cuenten como coincidencia.
  const nombre_usuario = normalizarNombre(usuario && usuario.nombre);
  const esLider = nombre_usuario !== "" && nombre_usuario === normalizarNombre(propuesta.leader_name);

  const puedeReenviar = esLider && propuesta.estado === "Rechazada";
  const reenviosRestantes = 3 - (propuesta.resubmit_count || 0);

  const textos_categorias = Array.isArray(propuesta.categorias)
    ? propuesta.categorias.map((c) => (typeof c === "object" ? c.name_category : c))
    : [];
  const textos_integrantes = Array.isArray(propuesta.integrantes)
    ? propuesta.integrantes.map((i) => (typeof i === "object" ? i.full_name : `#${i}`))
    : [];

  // "Aprobada por X el dd/mm/aaaa" (solo si el backend manda reviewer_name).
  const fecha_revision = propuesta.reviewed_at ? new Date(propuesta.reviewed_at) : null;
  const texto_fecha_revision =
    fecha_revision && !Number.isNaN(fecha_revision.getTime())
      ? ` el ${fecha_revision.toLocaleDateString("es-CO")}`
      : "";

  // ── Formulario de edición y reenvío (solo el líder, solo si fue rechazada) ──
  const bloque_reenvio = puedeReenviar
    ? `
    <div class="campo-bloque mt-4">
      <button id="btn-abrir-reenvio" class="btn btn-primary" type="button"
              onclick="toggleFormularioReenvio(true)">
        <span aria-hidden="true">✏️</span> Editar y reenviar
      </button>

      <div id="banner-reenvio" class="banner hidden" style="margin-top:1rem;"></div>

      <form id="form-reenvio" class="row g-3 hidden" style="margin-top:1.2rem;" novalidate>

        <div class="col-12">
          <h3 class="titulo-seccion mb-1">Editar y reenviar propuesta</h3>
          <p class="text-muted mb-0" style="font-size:.82rem;">
            Reenvíos restantes: <strong>${reenviosRestantes}</strong> de 3.
            Corrige los campos observados y adjunta el PDF actualizado.
            Todos los campos son obligatorios, excepto los integrantes.
          </p>
        </div>

        <div class="col-12">
          <label for="re-titulo" class="form-label">Título del proyecto</label>
          <input type="text" class="form-control" id="re-titulo" required
                 value="${escaparHtml(propuesta.titulo)}">
        </div>

        <div class="col-12">
          <span id="etiqueta-categorias-reenvio" class="form-label d-block">Categorías <span class="text-danger" aria-hidden="true">*</span><span class="visually-hidden">(obligatorio)</span></span>
          <div id="lista-categorias-reenvio" class="border rounded p-3" role="group" aria-labelledby="etiqueta-categorias-reenvio" aria-describedby="ayuda-categorias-reenvio">
            <span class="text-muted fst-italic" style="font-size:.82rem;">Cargando categorías…</span>
          </div>
          <div id="ayuda-categorias-reenvio" class="form-text">Selecciona una o más categorías.</div>
        </div>

        <div class="col-12">
          <label for="re-descripcion" class="form-label">Descripción general</label>
          <textarea class="form-control" id="re-descripcion" rows="2" required>${escaparHtml(propuesta.descr_proposal)}</textarea>
        </div>

        <div class="col-12">
          <label for="re-problema" class="form-label">Problema</label>
          <textarea class="form-control" id="re-problema" rows="3" required>${escaparHtml(propuesta.problem_proposal)}</textarea>
        </div>

        <div class="col-12">
          <label for="re-justificacion" class="form-label">Justificación</label>
          <textarea class="form-control" id="re-justificacion" rows="3" required>${escaparHtml(propuesta.justification_proposal)}</textarea>
        </div>

        <div class="col-12">
          <label for="re-objetivos" class="form-label">Objetivos</label>
          <textarea class="form-control" id="re-objetivos" rows="3" required>${escaparHtml(propuesta.objectives_proposal)}</textarea>
        </div>

        <div class="col-12">
          <label for="re-solucion" class="form-label">Solución propuesta</label>
          <textarea class="form-control" id="re-solucion" rows="3" required>${escaparHtml(propuesta.solution_proposal)}</textarea>
        </div>

        <div class="col-12">
          <span id="etiqueta-integrantes-reenvio" class="form-label d-block">Integrantes</span>
          <div id="lista-integrantes-reenvio" class="border rounded p-3" role="group" aria-labelledby="etiqueta-integrantes-reenvio" aria-describedby="ayuda-integrantes-reenvio">
            <span class="text-muted fst-italic" style="font-size:.82rem;">Cargando integrantes…</span>
          </div>
          <div id="ayuda-integrantes-reenvio" class="form-text">Solo se muestran estudiantes de tu mismo ciclo.</div>
        </div>

        <div class="col-12">
          <label for="re-pdf" class="form-label">Documento PDF actualizado</label>
          <input type="file" class="form-control" id="re-pdf" accept="application/pdf" required aria-describedby="ayuda-re-pdf">
          <div id="ayuda-re-pdf" class="form-text">Solo archivos .pdf, máximo ${TAMANO_MAXIMO_PDF_REENVIO_MB} MB.</div>
        </div>

        <div class="col-12 d-flex gap-2 flex-wrap">
          <button type="submit" class="btn btn-primary" id="btn-reenviar">Reenviar propuesta</button>
          <button type="button" class="btn btn-outline-secondary"
                  onclick="toggleFormularioReenvio(false)">Cancelar</button>
        </div>

      </form>
    </div>`
    : "";

  contenedor.innerHTML = `
    <!-- Banner de resultado general (por ejemplo, tras un reenvío correcto) -->
    <div id="banner-propuesta" class="banner hidden"></div>

    <div class="pgc-cabecera">
      <h2>${escaparHtml(propuesta.titulo)}</h2>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <span class="badge-estado ${claseEstado}">${escaparHtml(propuesta.estado)}</span>
        ${propuesta.resubmit_count > 0
          ? `<span class="text-muted" style="font-size:.82rem;">Reenvíos realizados: ${escaparHtml(propuesta.resubmit_count)} de 3</span>`
          : ""}
      </div>
      ${propuesta.estado === "Aprobada" && propuesta.reviewer_name
        ? `<p class="text-muted mt-2 mb-0" style="font-size:.85rem;">
             Aprobada por <strong>${escaparHtml(propuesta.reviewer_name)}</strong>${escaparHtml(texto_fecha_revision)}
           </p>`
        : ""}
    </div>

    ${propuesta.estado === "Rechazada"
      ? `<div class="banner error" style="margin-bottom:1.25rem;">
           <span><strong>Motivo del rechazo:</strong> ${escaparHtml(propuesta.comentario)}</span>
         </div>`
      : ""}

    <div class="row g-4">
      <div class="col-lg-8">
        <h3 class="titulo-seccion">Descripción de la propuesta</h3>
        <div class="d-grid gap-3">
          ${bloqueTexto("📝", "Descripción general", propuesta.descr_proposal)}
          ${bloqueTexto("🧩", "Problema", propuesta.problem_proposal)}
          ${bloqueTexto("💡", "Justificación", propuesta.justification_proposal)}
          ${bloqueTexto("🎯", "Objetivos", propuesta.objectives_proposal)}
          ${bloqueTexto("🛠️", "Solución propuesta", propuesta.solution_proposal)}
        </div>
      </div>
      <div class="col-lg-4">
        <h3 class="titulo-seccion">Datos generales</h3>
        <div class="d-grid gap-3">
          ${bloqueCampo("👤", "Líder", `<p class="campo-texto">${escaparHtml(propuesta.leader_name) || "—"}</p>`)}
          ${bloqueCampo("👥", "Integrantes", listaChips(textos_integrantes, "Solo el líder"))}
          ${bloqueCampo("🏷️", "Categorías", listaChips(textos_categorias, "Sin categorías"))}
          ${bloqueCampo("📄", "Documento PDF", `<div id="mis-pdf-contenedor"></div>`)}
        </div>
      </div>
    </div>

    ${bloque_reenvio}
  `;

  // Enlace al PDF con nota de expiración: { url, expira_en_segundos }.
  renderEnlacePdf(
    document.getElementById("mis-pdf-contenedor"),
    propuesta.pdf,
    `<span aria-hidden="true">📄</span> Ver documento de la propuesta`
  );

  // Si venimos de un reenvío correcto, el mensaje se muestra DESPUÉS de
  // repintar (antes se mostraba y el repintado lo borraba al instante).
  // El botón que se pulsó ya no existe, así que el foco va al aviso.
  if (mensaje_exito) {
    mostrarBanner("banner-propuesta", "success", mensaje_exito);
    enfocarBanner("banner-propuesta");
  }

  // Cargar integrantes, categorías y conectar el submit solo si aplica.
  if (puedeReenviar) {
    pintarIntegrantesReenvio(propuesta.integrantes || []);
    pintarCategoriasReenvio(propuesta.categorias || []);
    document.getElementById("form-reenvio").addEventListener("submit", (ev) =>
      manejarReenvio(ev, propuesta)
    );
  }
}

/** Valida y envía el formulario de reenvío contra PATCH /propuestas/:id/reenviar. */
async function manejarReenvio(evento, propuesta) {
  evento.preventDefault();
  ocultarBanner("banner-reenvio");

  const titulo        = document.getElementById("re-titulo").value.trim();
  const descripcion   = document.getElementById("re-descripcion").value.trim();
  const problema      = document.getElementById("re-problema").value.trim();
  const justificacion = document.getElementById("re-justificacion").value.trim();
  const objetivos     = document.getElementById("re-objetivos").value.trim();
  const solucion      = document.getElementById("re-solucion").value.trim();
  const archivoPdf    = document.getElementById("re-pdf").files[0];

  // Leer categorías marcadas desde checkboxes
  const contenedorCats = document.getElementById("lista-categorias-reenvio");
  const todasLasCats   = JSON.parse(contenedorCats?.dataset.categorias || "[]");
  const categorias     = todasLasCats
    .filter((c) => document.getElementById(`rcat-${c.id_category}`)?.checked)
    .map((c) => c.id_category);

  // Leer los integrantes marcados desde los checkboxes generados dinámicamente.
  const contenedorIntegrantes = document.getElementById("lista-integrantes-reenvio");
  const estudiantesDisponibles = JSON.parse(contenedorIntegrantes?.dataset.estudiantes || "[]");
  // Usar id_user para identificar integrantes
  const integrantes = estudiantesDisponibles
    .filter((e) => document.getElementById(`ri-${e.id_user}`)?.checked)
    .map((e) => e.id_user);

  // ── Validaciones: cada mensaje nombra su campo y el foco va al primero con error ──
  const campos_ok = validarCampos(
    [
      { id: "re-titulo", error: titulo ? null : "El título es obligatorio." },
      { id: "lista-categorias-reenvio", error: categorias.length > 0 ? null : "Selecciona al menos una categoría." },
      { id: "re-descripcion", error: descripcion ? null : "La descripción es obligatoria." },
      { id: "re-problema", error: problema ? null : "El problema es obligatorio." },
      { id: "re-justificacion", error: justificacion ? null : "La justificación es obligatoria." },
      { id: "re-objetivos", error: objetivos ? null : "Los objetivos son obligatorios." },
      { id: "re-solucion", error: solucion ? null : "La solución propuesta es obligatoria." },
      { id: "re-pdf", error: validarPdfReenvio(archivoPdf) },
    ],
    "banner-reenvio"
  );
  if (!campos_ok) return;

  const boton = document.getElementById("btn-reenviar");
  boton.disabled = true;
  boton.textContent = "Reenviando...";

  try {
    const fd = new FormData();
    // Nombres de campo tal como los espera el BE
    fd.append("title_proposal",           titulo);
    fd.append("descr_proposal",           descripcion);
    fd.append("problem_proposal",         problema);
    fd.append("justification_proposal",   justificacion);
    fd.append("objectives_proposal",      objetivos);
    fd.append("solution_proposal",        solucion);
    fd.append("integrantes",              JSON.stringify(integrantes));
    fd.append("categorias",               JSON.stringify(categorias));
    fd.append("pdf",                      archivoPdf);

    // PATCH /propuestas/:id/reenviar
    const res = await peticionApi(`/propuestas/${propuesta.id_proposal}/reenviar`, { method: "PATCH", body: fd });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      mostrarBanner("banner-reenvio", "error", json.mensaje || "No fue posible reenviar la propuesta.");
      enfocarBanner("banner-reenvio");
      return;
    }

    // Re-renderiza la sección completa para reflejar el nuevo estado
    // "Pendiente de validación". El mensaje de éxito se pasa a
    // inicializarMiPropuesta para que se muestre (y reciba el foco) al final.
    await inicializarMiPropuesta(json.mensaje || "Propuesta reenviada correctamente.");
  } catch {
    mostrarBanner("banner-reenvio", "error", "No fue posible conectar con el servidor.");
    enfocarBanner("banner-reenvio");
  } finally {
    boton.disabled = false;
    boton.textContent = "Reenviar propuesta";
  }
}