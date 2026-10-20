// ============================================================
// SIDEBAR.JS — menú lateral según rol y, para Profesor, según el
// contexto activo (Profesor / Encargado / Jurado). Cada página solo hace:
//
//   <div id="sidebar"></div>
//   <script src="components/sidebar.js"></script>
//   <script> renderizarBarraLateral("sidebar", "dashboard"); </script>
//
// El segundo argumento es el id de la página activa, para resaltar su enlace.
//
// Cada entrada del menú es un enlace suelto { id, label, href } o un grupo
// desplegable { grupo, opciones: [...] }. Un grupo que queda con una sola
// opción visible se muestra como enlace suelto, y uno sin opciones no se muestra.
//
// OPCIONES OCULTAS: si el estudiante no puede usar una opción (ya tiene una
// propuesta, o su etapa no está abierta), la opción NO aparece en el menú.
// Esto es solo comodidad: la protección real vive dentro de cada página.
// Si una consulta falla, la opción se muestra (no se oculta por error).
// ============================================================

const MENU_BASE_POR_ROL = {
  estudiante: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    {
      grupo: "Propuesta",
      opciones: [
        { id: "radicar-propuesta", label: "Radicar propuesta", href: "radicar-propuesta.html" },
        { id: "mis-propuestas", label: "Mi propuesta", href: "mis-propuestas.html" },
        { id: "propuestaAprobada", label: "Propuestas aprobadas", href: "propuestaAprobada.html" },
      ],
    },
    { grupo: "PGC", opciones: [{ id: "miPgc", label: "Mi PGC", href: "miPgc.html" }] },
    { id: "buscarPgc", label: "Buscar PGC", href: "buscarPgc.html" },
    { id: "lineamiento", label: "Lineamientos", href: "lineamiento.html" },
  ],
  administrador: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    {
      grupo: "Configuración",
      opciones: [
        { id: "ciclos", label: "Ciclos", href: "ciclos.html" },
        { id: "usuarios", label: "Usuarios", href: "usuarios.html" },
      ],
    },
    { id: "buscarPgc", label: "Buscar PGC", href: "buscarPgc.html" },
    { id: "lineamiento", label: "Lineamientos", href: "lineamiento.html" },
  ],
};

const MENU_POR_CONTEXTO = {
  profesor: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "buscarPgc", label: "Buscar PGC", href: "buscarPgc.html" },
    { id: "lineamiento", label: "Lineamientos", href: "lineamiento.html" },
  ],
  encargado: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    { id: "aprobaciones", label: "Aprobaciones", href: "aprobaciones.html" },
    {
      grupo: "Documentos del ciclo",
      opciones: [
        { id: "lineamiento", label: "Lineamientos", href: "lineamiento.html" },
        { id: "rubrica", label: "Rúbricas", href: "rubrica.html" },
        { id: "configurarFecha", label: "Configurar fechas", href: "configurarFecha.html" },
      ],
    },
    { id: "buscarPgc", label: "Buscar PGC", href: "buscarPgc.html" },
  ],
  jurado: [
    { id: "dashboard", label: "Inicio", href: "dashboard.html" },
    {
      grupo: "Evaluaciones",
      opciones: [
        { id: "calificar", label: "Calificar", href: "calificar.html" },
        { id: "calificado", label: "Calificados", href: "calificado.html" },
      ],
    },
    // El jurado califica con la rúbrica del ciclo: rubrica.js ya la deja leer en este contexto.
    {
      grupo: "Documentos",
      opciones: [
        { id: "lineamiento", label: "Lineamientos", href: "lineamiento.html" },
        { id: "rubrica", label: "Rúbricas", href: "rubrica.html" },
      ],
    },
    { id: "buscarPgc", label: "Buscar PGC", href: "buscarPgc.html" },
  ],
};

// Opciones del estudiante que solo existen mientras su etapa está abierta.
// Los nombres de etapa son los del ENUM de cycle_dates.stage (con tilde).
const MENU_ETAPA_POR_OPCION = {
  "radicar-propuesta": "Radicación",
  "propuestaAprobada": "Registro PGC",
};

/** Devuelve el menú del usuario: por contexto si es Profesor, fijo por rol si no. */
function construirMenu(usuario) {
  if (usuario.rol === "profesor") {
    return MENU_POR_CONTEXTO[obtenerContextoActivo()] || MENU_POR_CONTEXTO.profesor;
  }
  return MENU_BASE_POR_ROL[usuario.rol] || [];
}

/** Lista plana de opciones (saca las opciones de dentro de los grupos). */
function aplanarOpciones(menu) {
  return menu.flatMap((entrada) => (entrada.grupo ? entrada.opciones : [entrada]));
}

/** Quita las opciones ocultas; un grupo sin opciones desaparece. */
function filtrarMenu(menu, ocultas) {
  const resultado = [];
  menu.forEach((entrada) => {
    if (entrada.grupo) {
      const opciones = entrada.opciones.filter((opcion) => !ocultas.has(opcion.id));
      if (opciones.length > 0) resultado.push({ ...entrada, opciones });
    } else if (!ocultas.has(entrada.id)) {
      resultado.push(entrada);
    }
  });
  return resultado;
}

function construirEnlaceMenu(opcion, paginaActiva) {
  const activo = opcion.id === paginaActiva;
  return `
    <a class="nav-link${activo ? " active" : ""}" href="${opcion.href}"${activo ? ' aria-current="page"' : ""}>
      ${opcion.label}
    </a>`;
}

/** Grupo desplegable (<details>, operable con teclado); abierto si contiene la página activa. */
function construirGrupoMenu(grupo, paginaActiva) {
  if (grupo.opciones.length === 1) return construirEnlaceMenu(grupo.opciones[0], paginaActiva);

  const abierto = grupo.opciones.some((opcion) => opcion.id === paginaActiva);
  return `
    <details class="grupo-menu"${abierto ? " open" : ""}>
      <summary class="nav-link">${escaparHtml(grupo.grupo)}</summary>
      <div class="grupo-menu-items">
        ${grupo.opciones.map((opcion) => construirEnlaceMenu(opcion, paginaActiva)).join("")}
      </div>
    </details>`;
}

function construirItemMenu(entrada, paginaActiva) {
  return entrada.grupo ? construirGrupoMenu(entrada, paginaActiva) : construirEnlaceMenu(entrada, paginaActiva);
}

// ── Lectura de fechas para decidir qué opciones ocultar ──────────────

/** Convierte "YYYY-MM-DD HH:mm:ss" o ISO en Date (Safari no lee el espacio). */
function leerFechaMenu(valor) {
  if (!valor) return null;
  const fecha = new Date(String(valor).replace(" ", "T"));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

async function obtenerFechasMenu(id_cycle) {
  try {
    const res = await peticionApi(`/ciclos/${id_cycle}/fechas`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** true si la etapa existe y ahora mismo está dentro de su rango. */
function menuVentanaAbierta(filas, etapa) {
  const fila = (filas || []).find((f) => f.stage === etapa);
  if (!fila) return false; // etapa sin configurar: no se ofrece
  const inicio = leerFechaMenu(fila.start_date);
  const fin = leerFechaMenu(fila.end_date);
  if (!inicio || !fin) return false;
  const ahora = new Date();
  return ahora >= inicio && ahora <= fin;
}

async function estudianteTienePropuesta() {
  try {
    const res = await peticionApi("/propuestas/mia");
    return res.ok; // 404 = no tiene propuesta
  } catch {
    return false;
  }
}

/** Ids de las opciones que NO deben mostrarse a este usuario. */
async function obtenerOpcionesOcultas(usuario, opciones) {
  const ocultas = new Set();
  if (!usuario || usuario.rol !== "estudiante") return ocultas;

  const ids = new Set(opciones.map((opcion) => opcion.id));
  const necesita_fechas = Object.keys(MENU_ETAPA_POR_OPCION).some((id) => ids.has(id));

  const [tiene_propuesta, filas] = await Promise.all([
    ids.has("radicar-propuesta") ? estudianteTienePropuesta() : Promise.resolve(false),
    necesita_fechas && usuario.id_cycle ? obtenerFechasMenu(usuario.id_cycle) : Promise.resolve(null),
  ]);

  if (tiene_propuesta) ocultas.add("radicar-propuesta");

  if (filas) {
    Object.entries(MENU_ETAPA_POR_OPCION).forEach(([id, etapa]) => {
      if (ids.has(id) && !menuVentanaAbierta(filas, etapa)) ocultas.add(id);
    });
  }
  return ocultas;
}

async function renderizarBarraLateral(idContenedor, paginaActiva) {
  const elemento = document.getElementById(idContenedor);
  if (!elemento) return;

  const usuario = typeof obtenerUsuario === "function" ? obtenerUsuario() : null;
  const menu = usuario ? construirMenu(usuario) : [];

  elemento.innerHTML = `<nav class="sidebar" aria-label="Menú principal" aria-busy="true"></nav>`;

  // Se decide qué ocultar ANTES de pintar, para pintar el menú una sola vez.
  const ocultas = await obtenerOpcionesOcultas(usuario, aplanarOpciones(menu));
  const visible = filtrarMenu(menu, ocultas);

  elemento.innerHTML = `
    <nav class="sidebar" aria-label="Menú principal">
      ${visible.map((entrada) => construirItemMenu(entrada, paginaActiva)).join("")}
    </nav>`;
}

/**
 * Para páginas que también se pueden ver SIN sesión (buscarPgc, fichaPgc).
 * Con sesión pinta el menú normal; sin sesión quita la columna del menú
 * para que el contenido use todo el ancho. Devuelve true si hay sesión.
 */
function renderizarBarraLateralOpcional(idContenedor, paginaActiva) {
  if (estaAutenticado()) {
    renderizarBarraLateral(idContenedor, paginaActiva);
    return true;
  }
  const elemento = document.getElementById(idContenedor);
  if (elemento) elemento.remove();
  document.querySelector(".app-shell")?.classList.add("sin-sidebar");
  return false;
}