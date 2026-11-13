// ============================================================
// DASHBOARD.JS — lógica propia de dashboard.html (Inicio).
//
// Pinta tres bloques según el rol y, para el Profesor, según el
// contexto activo (Profesor / Encargado / Jurado):
//   1. Saludo + un subtítulo que explica para qué sirve el panel.
//   2. Tarjetas de resumen con datos REALES de endpoints que ya
//      existen (no hay un /dashboard en el backend).
//   3. Accesos rápidos: las mismas opciones del menú lateral, con
//      una línea que dice para qué sirve cada una.
// La pancarta de fechas la pinta components/pancartaFecha.js.
// ============================================================

// Subtítulo de cada panel (reemplaza el genérico "Este es tu panel según tu rol...").
const SUBTITULO_PANEL = {
  estudiante: "Aquí ves en qué va tu propuesta y tu PGC, y las fechas que se vienen en tu ciclo.",
  profesor: "Consulta el catálogo de proyectos de grado y los lineamientos vigentes.",
  profesor_con_capacidades: "Consulta el catálogo de proyectos. Para aprobar propuestas o calificar, cambia de rol en el menú de arriba.",
  encargado: "Resumen de los ciclos a tu cargo: propuestas por validar, rúbricas y fechas.",
  jurado: "Resumen de tus evaluaciones: lo que tienes por calificar y lo que ya calificaste.",
  administrador: "Resumen general de la plataforma: ciclos, proyectos registrados y lineamientos.",
};

// Una línea por opción del menú, para los accesos rápidos.
const DESCRIPCION_ACCESO = {
  "radicar-propuesta": "Envía la propuesta inicial de tu equipo.",
  "mis-propuestas": "Revisa el estado de tu propuesta y reenvíala si fue rechazada.",
  "propuestaAprobada": "Registra el PGC a partir de tu propuesta aprobada.",
  miPgc: "Sube evidencias de avance y consulta tus calificaciones.",
  buscarPgc: "Busca proyectos de grado por palabra clave, categoría, ciclo o estado.",
  lineamiento: "Documentos institucionales vigentes del proceso de grado.",
  rubrica: "Criterios con los que se califican los PGC del ciclo.",
  ciclos: "Crea y edita ciclos, encargados y jurados.",
  usuarios: "Gestión de usuarios de la plataforma.",
  aprobaciones: "Aprueba o rechaza las propuestas pendientes de tu ciclo.",
  configurarFecha: "Define las ventanas de radicación, registro, sustentación y calificación.",
  calificar: "Califica los PGC habilitados en el periodo de calificación.",
  calificado: "Consulta las notas y comentarios que ya registraste.",
};

const CLASE_ESTADO_PANEL = {
  "Pendiente de validación": "pendiente",
  "Aprobada": "aprobada",
  "Rechazada": "rechazada",
  "Anulada": "anulada",
  "En Proceso": "pendiente",
  "Terminado": "aprobada",
};

// ── Utilidades de este panel ─────────────────────────────────────────

/** Contexto efectivo: el rol, o el "sombrero" activo si es Profesor. */
function contextoPanel(usuario) {
  return usuario.rol === "profesor" ? obtenerContextoActivo() : usuario.rol;
}

/** GET que devuelve el JSON, o null si falla (el panel nunca se rompe por un dato). */
async function pedirDatoPanel(ruta) {
  try {
    const res = await peticionApi(ruta);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Mapa id → nombre de ciclo, para mostrar "Fundamentación" y no "1". */
async function nombresCiclosPanel() {
  const ciclos = await pedirDatoPanel("/ciclos");
  const nombres = {};
  (ciclos || []).forEach((c) => { nombres[c.id] = c.subject_cycle; });
  return nombres;
}

function listarNombresCiclo(ids, nombres) {
  return ids.map((id) => nombres[id] || `Ciclo ${id}`).join(", ");
}

/**
 * Una tarjeta de resumen. `valor` y `detalle` son TEXTO (se escapan aquí).
 * Si trae href, toda la tarjeta es un enlace a la pantalla correspondiente.
 */
function tarjetaResumen({ etiqueta, valor, detalle, href, estado }) {
  const valor_html = estado
    ? `<span class="badge-estado ${CLASE_ESTADO_PANEL[valor] || "pendiente"} valor-badge">${escaparHtml(valor)}</span>`
    : `<span class="valor">${escaparHtml(valor)}</span>`;
  const contenido = `
    <span class="label">${escaparHtml(etiqueta)}</span>
    ${valor_html}
    ${detalle ? `<span class="detalle">${escaparHtml(detalle)}</span>` : ""}`;
  return `
    <div class="col-12 col-md-6 col-xl-4">
      ${href
        ? `<a class="card-resumen card-enlace" href="${escaparHtml(href)}">${contenido}</a>`
        : `<div class="card-resumen">${contenido}</div>`}
    </div>`;
}

function formatearNotaPanel(nota) {
  const numero = Number(nota);
  return nota === null || nota === undefined || Number.isNaN(numero) ? null : numero.toFixed(1);
}

// ── Tarjetas por rol / contexto ──────────────────────────────────────

async function tarjetasEstudiante() {
  const tarjetas = [];

  // 1) Propuesta: GET /propuestas/mia responde 404 si no ha radicado.
  let propuesta = null;
  try {
    const res = await peticionApi("/propuestas/mia");
    if (res.ok) propuesta = await res.json();
  } catch { /* se trata como "sin propuesta" */ }

  tarjetas.push(
    propuesta
      ? tarjetaResumen({ etiqueta: "Mi propuesta", valor: propuesta.estado, estado: true, detalle: propuesta.title_proposal, href: "mis-propuestas.html" })
      : tarjetaResumen({ etiqueta: "Mi propuesta", valor: "Sin radicar", detalle: "Cuando radiques tu propuesta verás aquí su estado.", href: "radicar-propuesta.html" })
  );

  // 2) PGC: GET /pgc/mine devuelve un arreglo (el más reciente primero).
  const pgcs = await pedirDatoPanel("/pgc/mine");
  const pgc = Array.isArray(pgcs) && pgcs.length > 0 ? pgcs[0] : null;

  if (!pgc) {
    tarjetas.push(tarjetaResumen({
      etiqueta: "Mi PGC",
      valor: "Sin registrar",
      detalle: propuesta && propuesta.estado === "Aprobada"
        ? "Tu propuesta ya fue aprobada: puedes registrar el PGC."
        : "Se habilita cuando tu propuesta sea aprobada.",
      href: propuesta && propuesta.estado === "Aprobada" ? "propuestaAprobada.html" : null,
    }));
    return tarjetas;
  }

  tarjetas.push(tarjetaResumen({ etiqueta: "Mi PGC", valor: pgc.state_pgc, estado: true, detalle: pgc.name_cycle, href: "miPgc.html" }));

  // 3) Nota: GET /pgc/:id/calificaciones → { nota_global, calificaciones }
  const notas = await pedirDatoPanel(`/pgc/${pgc.id_pgc}/calificaciones`);
  const total = notas && Array.isArray(notas.calificaciones) ? notas.calificaciones.length : 0;
  const nota = notas ? formatearNotaPanel(notas.nota_global) : null;
  tarjetas.push(tarjetaResumen({
    etiqueta: "Nota global",
    valor: nota ? `${nota} / 5.0` : "Pendiente",
    detalle: total > 0 ? `${total} jurado(s) ya calificaron` : "Aún no hay calificaciones de jurado.",
    href: "miPgc.html",
  }));
  return tarjetas;
}

async function tarjetasProfesor(usuario) {
  const [nombres, busqueda] = await Promise.all([nombresCiclosPanel(), pedirDatoPanel("/pgc/search?pagina=1")]);
  return [
    tarjetaResumen({
      etiqueta: "PGC en el catálogo",
      valor: busqueda ? String(busqueda.total_resultados ?? 0) : "—",
      detalle: "Proyectos registrados en todos los ciclos.",
      href: "buscarPgc.html",
    }),
    tarjetaResumen({
      etiqueta: "Encargado de",
      valor: String(usuario.encargado_de.length),
      detalle: usuario.encargado_de.length ? listarNombresCiclo(usuario.encargado_de, nombres) : "No eres encargado de ningún ciclo.",
    }),
    tarjetaResumen({
      etiqueta: "Jurado en",
      valor: String(usuario.jurado_de.length),
      detalle: usuario.jurado_de.length ? listarNombresCiclo(usuario.jurado_de, nombres) : "No eres jurado de ningún ciclo.",
    }),
  ];
}

async function tarjetasEncargado(usuario) {
  const ciclos = usuario.encargado_de;
  const estado = encodeURIComponent("Pendiente de validación");
  const tipo = encodeURIComponent("Rúbrica");

  const [nombres, pendientes, rubricas] = await Promise.all([
    nombresCiclosPanel(),
    Promise.all(ciclos.map((id) => pedirDatoPanel(`/propuestas?cycle=${id}&estado=${estado}`))),
    Promise.all(ciclos.map((id) => pedirDatoPanel(`/ciclos/${id}/documentos?tipo=${tipo}`))),
  ]);

  const contar = (listas) => (listas.some((l) => l === null) ? null : listas.reduce((suma, l) => suma + (l || []).length, 0));
  const total_pendientes = contar(pendientes);
  const total_rubricas = contar(rubricas);

  return [
    tarjetaResumen({
      etiqueta: "Propuestas por validar",
      valor: total_pendientes === null ? "—" : String(total_pendientes),
      detalle: total_pendientes ? "Revísalas en Aprobaciones." : "No tienes propuestas pendientes.",
      href: "aprobaciones.html",
    }),
    tarjetaResumen({
      etiqueta: "Rúbricas vigentes",
      valor: total_rubricas === null ? "—" : String(total_rubricas),
      detalle: total_rubricas ? "Publicadas para tus jurados y estudiantes." : "Aún no has publicado rúbricas.",
      href: "rubrica.html",
    }),
    tarjetaResumen({
      etiqueta: "Ciclos a tu cargo",
      valor: String(ciclos.length),
      detalle: listarNombresCiclo(ciclos, nombres),
      href: "configurarFecha.html",
    }),
  ];
}

async function tarjetasJurado(usuario) {
  const [nombres, pendientes, calificados] = await Promise.all([
    nombresCiclosPanel(),
    pedirDatoPanel("/pgc/pendientes-calificacion"),
    pedirDatoPanel("/pgc/calificados-por-mi"),
  ]);

  const notas = (calificados || []).map((c) => Number(c.grade)).filter((n) => !Number.isNaN(n));
  const promedio = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : null;

  return [
    tarjetaResumen({
      etiqueta: "Por calificar ahora",
      valor: pendientes ? String(pendientes.length) : "—",
      detalle: "PGC dentro del periodo de calificación que aún no calificas.",
      href: "calificar.html",
    }),
    tarjetaResumen({
      etiqueta: "Ya calificados",
      valor: calificados ? String(calificados.length) : "—",
      detalle: promedio ? `Promedio de las notas que diste: ${promedio}` : "Todavía no has calificado ningún PGC.",
      href: "calificado.html",
    }),
    tarjetaResumen({
      etiqueta: "Jurado en",
      valor: String(usuario.jurado_de.length),
      detalle: listarNombresCiclo(usuario.jurado_de, nombres),
    }),
  ];
}

async function tarjetasAdministrador() {
  const [ciclos, todos, terminados, lineamientos] = await Promise.all([
    pedirDatoPanel("/ciclos"),
    pedirDatoPanel("/pgc/search?pagina=1"),
    pedirDatoPanel(`/pgc/search?pagina=1&estado=${encodeURIComponent("Terminado")}`),
    pedirDatoPanel("/lineamientos"),
  ]);

  const total = todos ? todos.total_resultados ?? 0 : null;
  const total_terminados = terminados ? terminados.total_resultados ?? 0 : null;

  return [
    tarjetaResumen({
      etiqueta: "Ciclos",
      valor: ciclos ? String(ciclos.length) : "—",
      detalle: ciclos ? ciclos.map((c) => c.subject_cycle).join(", ") : "",
      href: "ciclos.html",
    }),
    tarjetaResumen({
      etiqueta: "PGC registrados",
      valor: total === null ? "—" : String(total),
      detalle: total_terminados === null ? "" : `${total_terminados} terminado(s) · ${total - total_terminados} en proceso`,
      href: "buscarPgc.html",
    }),
    tarjetaResumen({
      etiqueta: "Lineamientos vigentes",
      valor: lineamientos ? String(lineamientos.length) : "—",
      detalle: "Documentos institucionales publicados.",
      href: "lineamiento.html",
    }),
  ];
}

// ── Pintado ──────────────────────────────────────────────────────────

async function pintarResumen(usuario) {
  const contenedor = document.getElementById("contenedor-resumen");
  contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.85rem;">Cargando tu resumen...</p>`;

  const contexto = contextoPanel(usuario);
  const por_contexto = {
    estudiante: () => tarjetasEstudiante(),
    profesor: () => tarjetasProfesor(usuario),
    encargado: () => tarjetasEncargado(usuario),
    jurado: () => tarjetasJurado(usuario),
    administrador: () => tarjetasAdministrador(),
  };

  const tarjetas = por_contexto[contexto] ? await por_contexto[contexto]() : [];
  contenedor.innerHTML = tarjetas.length
    ? tarjetas.join("")
    : `<p class="text-muted fst-italic" style="font-size:.85rem;">No hay datos para mostrar.</p>`;
}

/** Accesos rápidos: las opciones visibles del menú lateral (menos Inicio), con su descripción. */
async function pintarAccesos(usuario) {
  const contenedor = document.getElementById("contenedor-accesos");
  const opciones = aplanarOpciones(construirMenu(usuario)).filter((o) => o.id !== "dashboard");
  const ocultas = await obtenerOpcionesOcultas(usuario, opciones);

  contenedor.innerHTML = opciones
    .filter((o) => !ocultas.has(o.id))
    .map((o) => `
      <div class="col-12 col-sm-6 col-xl-4">
        <a class="acceso-rapido" href="${escaparHtml(o.href)}">
          <span class="acceso-titulo">${escaparHtml(o.label)} →</span>
          <span class="acceso-texto">${escaparHtml(DESCRIPCION_ACCESO[o.id] || "")}</span>
        </a>
      </div>`)
    .join("");
}

function inicializarPanel() {
  const usuario = obtenerUsuario();
  if (!usuario) return;

  const saludo = document.getElementById("saludo");
  const primer_nombre = String(usuario.nombre || usuario.correo || "").split(" ")[0];
  saludo.textContent = primer_nombre ? `Hola, ${primer_nombre}` : "Bienvenido";

  let clave = contextoPanel(usuario);
  if (clave === "profesor" && (usuario.encargado_de.length || usuario.jurado_de.length)) clave = "profesor_con_capacidades";
  document.getElementById("subtitulo-panel").textContent = SUBTITULO_PANEL[clave] || "";

  pintarResumen(usuario);
  pintarAccesos(usuario);
}