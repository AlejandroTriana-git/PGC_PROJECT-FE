// ============================================================
// UTILS.JS — funciones genéricas reutilizables en todo el
// frontend, para no repetir lógica en cada página.
// ============================================================

// Iconos SVG reutilizados en banners de éxito/error (login,
// formularios, tablas, etc.)
const ICONO_ERROR = '<svg class="ic" aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>';
const ICONO_OK = '<svg class="ic" aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
/**
 * Escapa un texto antes de meterlo dentro de un template que se asigna
 * a innerHTML. Evita que un título como  Sistema "PGC" <b>  rompa un
 * atributo (value="...") o inyecte HTML. Devuelve "" si llega null/undefined.
 */
function escaparHtml(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Muestra un mensaje de estado (éxito o error) dentro de un
 * contenedor <div id="banner"></div>. Se usa en login,
 * formularios de registro/edición, etc.
 * El mensaje se inserta como TEXTO (no como HTML): puede venir de la
 * URL (?msg=) o del backend y nunca debe interpretarse como código.
 * @param {string} idContenedor - id del elemento contenedor
 * @param {'success'|'error'} tipo
 * @param {string} mensaje
 * @param {{ texto: string, href: string }} [enlace]
 */
function mostrarBanner(idContenedor, tipo, mensaje, enlace) {
  const banner = document.getElementById(idContenedor);
  if (!banner) return;
  banner.className = "banner " + tipo;
  // Los errores se anuncian de inmediato (alert); los éxitos, sin interrumpir (status).
  banner.setAttribute("role", tipo === "error" ? "alert" : "status");
  banner.innerHTML = tipo === "error" ? ICONO_ERROR : ICONO_OK;
  const texto = document.createElement("span");
  texto.textContent = mensaje;
  if (enlace) {
    texto.appendChild(document.createTextNode(" "));
    const vinculo = document.createElement("a");
    vinculo.href = enlace.href;
    vinculo.textContent = enlace.texto;
    vinculo.style.color = "inherit";
    vinculo.style.fontWeight = "700";
    texto.appendChild(vinculo);
  }
  banner.appendChild(texto);
}

/** Oculta el banner de estado. */
function ocultarBanner(idContenedor) {
  const banner = document.getElementById(idContenedor);
  if (banner) banner.classList.add("hidden");
}

/**
 * Decodifica el payload de un JWT (sin verificar la firma;
 * la verificación real la hace siempre el backend). Sirve
 * para leer el rol/nombre del usuario y pintar la interfaz.
 */
function decodificarJWT(token) {
  try {
    const payload = token.split(".")[1];
    const json = decodeURIComponent(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

/**
 * Wrapper de fetch que agrega automáticamente el token JWT
 * en el header Authorization. Úsalo en vez de fetch() a
 * secas para cualquier llamada a la API que requiera sesión.
 */
async function peticionApi(ruta, opciones = {}) {
  const token = obtenerToken();
  // Si el body es FormData, NO se fija Content-Type: el navegador lo hace
  // automáticamente con el boundary correcto (multipart/form-data).
  const esFormData = opciones.body instanceof FormData;
  const encabezados = Object.assign(
    esFormData ? {} : { "Content-Type": "application/json" },
    opciones.headers || {},
    token ? { Authorization: `Bearer ${token}` } : {}
  );
  const res = await fetch(`${URL_API}${ruta}`, { ...opciones, headers: encabezados });

  // Sesión vencida o inválida: el backend responde 401. Solo se cierra la
  // sesión si había token: un visitante en una página pública (buscar PGC)
  // no tiene sesión que cerrar y no debe ser expulsado al login.
  if (res.status === 401 && token) {
    cerrarSesion("Sesión expirada. Por favor, inicie sesión nuevamente.");
    throw new Error("No autenticado");
  }
  return res;
}

/**
 * Renderiza el bloque del enlace a un archivo dentro de un elemento
 * contenedor. Muestra el link y una nota de expiración discreta.
 *
 * @param {HTMLElement} contenedor - Elemento donde se inyecta el HTML.
 * @param {{ url: string, expira_en_segundos: number } | null | undefined} pdf
 *   Formato que usa el backend en TODOS los endpoints (propuestas,
 *   archivos de PGC, lineamientos): expira_en_segundos con guion bajo.
 *   Objeto tal como lo devuelve el backend.
 * @param {string} [etiqueta] - Texto del enlace. Se inserta como HTML: si
 *   trae texto del usuario (ej. un nombre de archivo), escápalo antes.
 */
function renderEnlacePdf(contenedor, pdf, etiqueta = "📄 Ver documento PDF") {
  if (!contenedor) return;

  if (!pdf || !pdf.url) {
    contenedor.innerHTML = `<span class="text-muted fst-italic" style="font-size:.82rem;">Sin documento adjunto.</span>`;
    return;
  }

  const segundos = pdf.expira_en_segundos ?? 0;

  if (segundos <= 0) {
    contenedor.innerHTML = `
      <span class="text-muted fst-italic" style="font-size:.82rem;">
        El enlace ha expirado. Recarga la página para obtener uno nuevo.
      </span>`;
    return;
  }

  const minutos = Math.round(segundos / 60);
  const textoExpira = minutos >= 60
    ? `Disponible por ${Math.round(minutos / 60)} h`
    : `Disponible por ${minutos} min`;

  contenedor.innerHTML = `
    <a href="${escaparHtml(pdf.url)}" target="_blank" rel="noopener"
       style="font-weight:600;color:var(--verde-medio);">
      ${etiqueta}
    </a>
    <span class="text-muted ms-2" style="font-size:.75rem;">(${textoExpira})</span>`;
}



// ============================================================
// Piezas de interfaz reutilizables (Issues 7 y 11). Las usan miPgc.js
// y, cuando rediseñemos esa pantalla, mis-propuestas.js.
// ============================================================

/** Un dato: etiqueta con icono decorativo (no lo lee el lector de pantalla) + contenido ya armado. */
function bloqueCampo(icono, etiqueta, contenido_html) {
  return `
    <div class="campo-bloque">
      <span class="campo-etiqueta"><span aria-hidden="true">${icono}</span>${escaparHtml(etiqueta)}</span>
      ${contenido_html}
    </div>`;
}

/** Un dato de texto largo; "—" si viene vacío. */
function bloqueTexto(icono, etiqueta, texto) {
  const contenido = String(texto ?? "").trim() ? escaparHtml(texto) : "—";
  return bloqueCampo(icono, etiqueta, `<p class="campo-texto">${contenido}</p>`);
}

/** Lista de etiquetas cortas (categorías, integrantes). `vacio` es el texto si no hay nada. */
function listaChips(textos, vacio) {
  if (!Array.isArray(textos) || textos.length === 0) {
    return `<p class="campo-texto text-muted">${escaparHtml(vacio)}</p>`;
  }
  return `<ul class="lista-chips">${textos.map((t) => `<li class="chip-dato">${escaparHtml(t)}</li>`).join("")}</ul>`;
}

/**
 * Valida un formulario campo por campo (WCAG 3.3.1: el error debe decir
 * CUÁL campo falló). Marca cada campo con error, lo anuncia en el banner y
 * lleva el foco al primero.
 *
 * @param {Array<{ id: string, error: string|null }>} campos - en el orden de la
 *   pantalla; `error` es el mensaje si el campo falla, o null si está bien.
 *   El id puede ser el de un control (input, textarea, select) o el de un
 *   contenedor de casillas (en ese caso el foco va a su primer control).
 * @param {string} idBanner - banner donde se muestran los mensajes.
 * @returns {boolean} true si todos los campos están bien.
 */
function validarCampos(campos, idBanner) {
  let primero = null;
  const mensajes = [];

  campos.forEach(({ id, error }) => {
    const elemento = document.getElementById(id);
    if (!elemento) return;
    const es_control = elemento.matches("input, textarea, select");

    // Se limpian las marcas anteriores, para que un campo corregido deje de verse en error.
    elemento.classList.remove("is-invalid", "border-danger");
    elemento.removeAttribute("aria-invalid");

    if (!error) return;

    if (es_control) {
      elemento.classList.add("is-invalid");
      elemento.setAttribute("aria-invalid", "true");
    } else {
      elemento.classList.add("border-danger"); // contenedor de casillas
    }
    mensajes.push(error);
    if (!primero) primero = es_control ? elemento : elemento.querySelector("input, textarea, select, button") || elemento;
  });

  if (mensajes.length === 0) return true;

  mostrarBanner(idBanner, "error", mensajes.join(" "));
  if (primero && typeof primero.focus === "function") primero.focus();
  return false;
}

/**
 * Lleva el foco al banner (WCAG 2.4.3). Se usa tras repintar la pantalla:
 * el botón que el usuario pulsó ya no existe y, sin esto, el foco se pierde.
 */
function enfocarBanner(idContenedor) {
  const banner = document.getElementById(idContenedor);
  if (!banner) return;
  banner.setAttribute("tabindex", "-1");
  banner.focus();
}