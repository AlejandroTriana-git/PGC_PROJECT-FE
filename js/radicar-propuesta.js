// ============================================================
// RADICAR-PROPUESTA.JS — HU-09: lógica del formulario de
// radicación inicial de un PGC.
// ============================================================

const TAMANO_MAXIMO_PDF_MB = 10;

// Nombre exacto del ENUM de stage en la base de datos — con tilde,
// confirmado por backend (ver cycle_dates.stage).
const ETAPA_RADICACION = "Radicación";

/** Arma el texto "habilitado del X al Y" a partir de dos fechas, si existen. */
function formatearRangoFechas(inicio, fin) {
  if (!inicio || !fin) return "";
  return ` (habilitado del ${inicio} al ${fin})`;
}

/**
 * Carga las categorías de proyecto desde la API y renderiza
 * checkboxes en #lista-categorias para selección múltiple.
 */
async function pintarCategorias() {
  const contenedor = document.getElementById("lista-categorias");
  if (!contenedor) return;

  try {
    const res = await peticionApi("/categorias");
    const categorias = await res.json();

    if (!res.ok || !Array.isArray(categorias) || categorias.length === 0) {
      contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.82rem;">No se pudieron cargar las categorías.</p>`;
      return;
    }

    contenedor.innerHTML = categorias
      .map((c) => `
        <div class="form-check">
          <input class="form-check-input" type="checkbox"
                 value="${c.id_category}" id="cat-${c.id_category}">
          <label class="form-check-label" for="cat-${c.id_category}">${escaparHtml(c.name_category)}</label>
        </div>`)
      .join("");

    // Guardamos la lista para el submit
    contenedor.dataset.categorias = JSON.stringify(categorias);
  } catch {
    contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.82rem;">Error al cargar categorías.</p>`;
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
          <label class="form-check-label" for="integrante-${estudiante.id_user}">${escaparHtml(estudiante.full_name)}</label>
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

/**
 * Revisa si la etapa "Radicación" del ciclo del estudiante está
 * abierta ahora mismo. Devuelve null si puede radicar, o el mensaje
 * de bloqueo (con fechas) si no. Esto es un bloqueo REAL: si da
 * bloqueado, el formulario ni siquiera se pinta — no es decorativo.
 */
async function obtenerBloqueoPorFecha() {
  const usuario = obtenerUsuario();
  if (!usuario || !usuario.id_cycle) return null; // sin id_cycle no se puede validar; se deja pasar

  try {
    const res = await peticionApi(`/ciclos/${usuario.id_cycle}/fechas`);
    if (!res.ok) return null; // si falla la consulta, no bloqueamos por las dudas
    const filas = await res.json();
    const fila = (filas || []).find((f) => f.stage === ETAPA_RADICACION);

    if (!fila) return "El periodo de radicación todavía no ha sido configurado para tu ciclo.";

    const ahora = new Date();
    const inicio = new Date(fila.start_date);
    const fin = new Date(fila.end_date);

    if (ahora < inicio || ahora > fin) {
      return `El periodo para radicar propuestas no está disponible.${formatearRangoFechas(fila.start_date, fila.end_date)}`;
    }
    return null;
  } catch {
    return null; // si falla la consulta, no bloqueamos por las dudas; el submit lo validará igual
  }
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

      // Si la propuesta está Aprobada, redirigir directamente a "Mi propuesta"
      // para que el estudiante pueda registrar su PGC desde ahí.
      if (propuesta.estado === "Aprobada") {
        sessionStorage.setItem("banner_info", "¡Tu propuesta ya fue aprobada! Aquí puedes ver su estado y registrar tu PGC.");
        window.location.href = "mis-propuestas.html";
        return;
      }

      const estadoTextos = {
        "Pendiente de validación": "una propuesta pendiente de validación",
        "Rechazada": "una propuesta rechazada (puedes editarla desde \"Mi propuesta\")",
        "Anulada": "una propuesta anulada",
      };
      const descripcion = estadoTextos[propuesta.estado] || "una propuesta registrada";

      mostrarBanner(
        "banner",
        "error",
        `Ya tienes ${descripcion}. No puedes radicar una nueva propuesta.`,
        { texto: "Ver mi propuesta →", href: "mis-propuestas.html" }
      );
      return; // No inicializar el formulario
    }

    // Si es 404 no hay propuesta → sigue al chequeo de fecha
  } catch {
    // Si falla la consulta previa, dejamos que el submit la maneje
  }

  // ── Bloqueo real por fecha: si la etapa "Radicación" está cerrada,
  // el formulario ni se muestra (no es un candado solo visual) ──────
  const motivoBloqueo = await obtenerBloqueoPorFecha();
  if (motivoBloqueo) {
    const form = document.getElementById("form-propuesta");
    if (form) form.classList.add("hidden");
    mostrarBanner("banner", "error", motivoBloqueo);
    return;
  }

  pintarCategorias();
  pintarIntegrantes();

  document.getElementById("form-propuesta").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    ocultarBanner("banner");

    const titulo        = document.getElementById("titulo").value.trim();
    const descripcion   = document.getElementById("descripcion").value.trim();
    const problema      = document.getElementById("problema").value.trim();
    const justificacion = document.getElementById("justificacion").value.trim();
    const objetivos     = document.getElementById("objetivos").value.trim();
    const solucion      = document.getElementById("solucion").value.trim();
    const archivoPdf    = document.getElementById("pdf").files[0];

    // Leer categorías marcadas (checkboxes)
    const contenedorCats = document.getElementById("lista-categorias");
    const todasLasCats   = JSON.parse(contenedorCats.dataset.categorias || "[]");
    const categorias = todasLasCats
      .filter((c) => document.getElementById(`cat-${c.id_category}`)?.checked)
      .map((c) => c.id_category);

    // Leer los integrantes marcados desde los checkboxes generados dinámicamente.
    const contenedorIntegrantes = document.getElementById("lista-integrantes");
    const estudiantesDisponibles = JSON.parse(contenedorIntegrantes.dataset.estudiantes || "[]");
    // Usar id_user (no .id) para identificar integrantes
    const integrantes = estudiantesDisponibles
      .filter((e) => document.getElementById(`integrante-${e.id_user}`)?.checked)
      .map((e) => e.id_user);

    if (!titulo || !descripcion || !problema || !justificacion || !objetivos || !solucion) {
      mostrarBanner("banner", "error", "Debes completar todos los campos.");
      return;
    }
    if (categorias.length === 0) {
      mostrarBanner("banner", "error", "Debes seleccionar al menos una categoría.");
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
      fd.append("descr_proposal",           descripcion);
      fd.append("problem_proposal",         problema);
      fd.append("justification_proposal",   justificacion);
      fd.append("objectives_proposal",      objetivos);
      fd.append("solution_proposal",        solucion);
      fd.append("integrantes",              JSON.stringify(integrantes));
      fd.append("categorias",              JSON.stringify(categorias));
      // NOTA: id_cycle NO se envía — el BE lo obtiene del líder en la BD
      fd.append("pdf", archivoPdf);

      const res = await peticionApi("/propuestas", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        document.getElementById("form-propuesta").classList.add("hidden");
        mostrarBanner(
          "banner",
          "success",
          json.mensaje || "Propuesta radicada correctamente.",
          { texto: "Ver mi propuesta →", href: "mis-propuestas.html" }
        );
      } else {
        // El BE manda las fechas por separado (fecha_inicio_radicacion /
        // fecha_fin_radicacion), igual que en el registro de PGC — se arman
        // aquí dentro del mensaje, en vez de asumir que ya vienen incluidas.
        const rango = formatearRangoFechas(json.fecha_inicio_radicacion, json.fecha_fin_radicacion);
        mostrarBanner(
          "banner",
          "error",
          (json.mensaje || "No fue posible radicar la propuesta.") + rango
        );
      }
    } catch {
      mostrarBanner("banner", "error", "No fue posible conectar con el servidor.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Radicar propuesta";
    }
  });
}