// ============================================================
// UTILS.JS — funciones genéricas reutilizables en todo el
// frontend, para no repetir lógica en cada página.
// ============================================================

// Iconos SVG reutilizados en banners de éxito/error (login,
// formularios, tablas, etc.)
const ICONO_ERROR = '<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>';
const ICONO_OK = '<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';

/**
 * Muestra un mensaje de estado (éxito o error) dentro de un
 * contenedor <div id="banner"></div>. Se usa en login,
 * formularios de registro/edición, etc.
 * @param {string} idContenedor - id del elemento contenedor
 * @param {'success'|'error'} tipo
 * @param {string} mensaje
 */
function mostrarBanner(idContenedor, tipo, mensaje) {
  const banner = document.getElementById(idContenedor);
  if (!banner) return;
  banner.classList.remove("hidden");
  banner.className = "banner " + tipo;
  banner.innerHTML = (tipo === "error" ? ICONO_ERROR : ICONO_OK) + "<span>" + mensaje + "</span>";
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

  // Sesión vencida o inválida: el backend responde 401.
  if (res.status === 401) {
    cerrarSesion("Sesión expirada. Por favor, inicie sesión nuevamente.");
    throw new Error("No autenticado");
  }
  return res;
}

/**
 * Renderiza el bloque del enlace al PDF dentro de un elemento
 * contenedor. Muestra el link y una nota de expiración discreta.
 *
 * @param {HTMLElement} contenedor - Elemento donde se inyecta el HTML.
 * @param {{ url: string, "expira-en-segundos": number } | null | undefined} pdf
 *   Objeto tal como lo devuelve el backend.
 */
function renderEnlacePdf(contenedor, pdf) {
  if (!contenedor) return;

  if (!pdf || !pdf.url) {
    contenedor.innerHTML = `<span class="text-muted fst-italic" style="font-size:.82rem;">Sin documento adjunto.</span>`;
    return;
  }

  const segundos = pdf["expira-en-segundos"] ?? pdf.expira_en_segundos ?? 0;

  if (segundos <= 0) {
    contenedor.innerHTML = `
      <span class="text-muted fst-italic" style="font-size:.82rem;">
        El enlace del PDF ha expirado. Recarga la página para obtener uno nuevo.
      </span>`;
    return;
  }

  const minutos = Math.round(segundos / 60);
  const textoExpira = minutos >= 60
    ? `Disponible por ${Math.round(minutos / 60)} h`
    : `Disponible por ${minutos} min`;

  contenedor.innerHTML = `
    <a href="${pdf.url}" target="_blank" rel="noopener"
       style="font-weight:600;color:var(--verde-medio);">
      📄 Ver documento PDF
    </a>
    <span class="text-muted ms-2" style="font-size:.75rem;">(${textoExpira})</span>`;
}

