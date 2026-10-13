// ============================================================
// PANCARTAFECHA.JS — pancarta de fechas del inicio (Issue 12).
// Muestra las etapas del ciclo que ya están habilitadas o que abren dentro
// de los próximos 15 días. Se usa así:
//
//   <div id="contenedor-pancarta"></div>
//   <script src="components/pancartaFecha.js"></script>
//   <script> renderizarPancartaFechas("contenedor-pancarta"); </script>
//
// Las funciones llevan prefijo "pancarta" para no chocar con las de otros
// scripts que se cargan en la misma página.
// ============================================================

const PANCARTA_DIAS_AVISO = 15;
const PANCARTA_MS_POR_DIA = 24 * 60 * 60 * 1000;

// Literales del ENUM cycle_dates.stage (con tilde) y cómo se nombran en el texto.
const PANCARTA_ETAPAS = {
  "Radicación":   { sujeto: "La radicación de propuestas", habilitado: "habilitada" },
  "Registro PGC": { sujeto: "El registro del PGC",         habilitado: "habilitado" },
  "Sustentación": { sujeto: "La sustentación",             habilitado: "habilitada" },
  "Calificación": { sujeto: "La calificación de los PGC",  habilitado: "habilitada" },
};
const PANCARTA_TODAS = ["Radicación", "Registro PGC", "Sustentación", "Calificación"];

function pancartaLeerFecha(valor) {
  if (!valor) return null;
  const fecha = new Date(String(valor).replace(" ", "T"));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function pancartaFormatear(fecha) {
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

/** Ciclos y etapas que le interesan a este usuario: Map(id_cycle → Set(etapas)). */
async function pancartaObtenerObjetivos(usuario) {
  const objetivos = new Map();
  const agregar = (id_cycle, etapas) => {
    if (!objetivos.has(id_cycle)) objetivos.set(id_cycle, new Set());
    etapas.forEach((etapa) => objetivos.get(id_cycle).add(etapa));
  };

  if (usuario.rol === "estudiante") {
    if (usuario.id_cycle) agregar(usuario.id_cycle, ["Radicación", "Registro PGC", "Sustentación"]);
  } else if (usuario.rol === "profesor") {
    usuario.encargado_de.forEach((id) => agregar(id, PANCARTA_TODAS));
    usuario.jurado_de.forEach((id) => agregar(id, ["Sustentación", "Calificación"]));
  } else if (usuario.rol === "administrador") {
    const res = await peticionApi("/ciclos");
    if (res.ok) (await res.json()).forEach((ciclo) => agregar(ciclo.id_cycle, PANCARTA_TODAS));
  }
  return objetivos;
}

/** "habilitada", "proxima" o null (no se muestra) según la fecha de hoy. */
function pancartaClasificar(fila, ahora) {
  const inicio = pancartaLeerFecha(fila.start_date);
  const fin = pancartaLeerFecha(fila.end_date);
  if (!inicio || !fin) return null;

  if (ahora >= inicio && ahora <= fin) return { tipo: "habilitada", inicio, fin };

  const dias_para_inicio = (inicio - ahora) / PANCARTA_MS_POR_DIA;
  if (dias_para_inicio > 0 && dias_para_inicio <= PANCARTA_DIAS_AVISO) return { tipo: "proxima", inicio, fin };

  return null;
}

function pancartaTexto(item) {
  const etapa = PANCARTA_ETAPAS[item.stage];
  if (item.tipo === "habilitada") {
    return `${etapa.sujeto} ya está ${etapa.habilitado}. Tienes hasta el ${pancartaFormatear(item.fin)}.`;
  }
  return `${etapa.sujeto} se habilitará el ${pancartaFormatear(item.inicio)} y estará disponible hasta el ${pancartaFormatear(item.fin)}.`;
}

async function renderizarPancartaFechas(idContenedor) {
  const contenedor = document.getElementById(idContenedor);
  if (!contenedor) return;

  const usuario = typeof obtenerUsuario === "function" ? obtenerUsuario() : null;
  if (!usuario) return;

  contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.85rem;">Cargando fechas...</p>`;

  let objetivos;
  try {
    objetivos = await pancartaObtenerObjetivos(usuario);
  } catch {
    contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.85rem;">No fue posible cargar las fechas.</p>`;
    return;
  }

  if (objetivos.size === 0) {
    contenedor.innerHTML = `<p class="text-muted fst-italic" style="font-size:.85rem;">Aquí verás las fechas de tu ciclo cuando estés asociado a uno.</p>`;
    return;
  }

  const ahora = new Date();
  const items = [];
  let consultas_fallidas = 0;

  await Promise.all(
    [...objetivos].map(async ([id_cycle, etapas]) => {
      try {
        const res = await peticionApi(`/ciclos/${id_cycle}/fechas`);
        if (!res.ok) throw new Error();
        const filas = await res.json();
        (filas || [])
          .filter((fila) => etapas.has(fila.stage) && PANCARTA_ETAPAS[fila.stage])
          .forEach((fila) => {
            const clasificada = pancartaClasificar(fila, ahora);
            if (clasificada) items.push({ id_cycle, stage: fila.stage, ...clasificada });
          });
      } catch {
        consultas_fallidas += 1;
      }
    })
  );

  if (items.length === 0) {
    contenedor.innerHTML =
      consultas_fallidas === objetivos.size
        ? `<p class="text-muted fst-italic" style="font-size:.85rem;">No fue posible cargar las fechas del ciclo.</p>`
        : `<p class="text-muted fst-italic" style="font-size:.85rem;">No hay etapas habilitadas ni próximas en los siguientes ${PANCARTA_DIAS_AVISO} días.</p>`;
    return;
  }

  // Primero las habilitadas; dentro de cada grupo, la que empieza antes.
  items.sort((a, b) => (a.tipo === b.tipo ? a.inicio - b.inicio : a.tipo === "habilitada" ? -1 : 1));

  const mostrar_ciclo = objetivos.size > 1;

  contenedor.innerHTML = `
    <ul class="pancarta-lista">
      ${items
        .map((item) => {
          const etiqueta = item.tipo === "habilitada" ? "Disponible ahora" : "Próximamente";
          const prefijo = mostrar_ciclo ? `<strong>Ciclo ${escaparHtml(item.id_cycle)}.</strong> ` : "";
          return `
          <li class="pancarta pancarta-${item.tipo}">
            <span class="pancarta-estado">${etiqueta}</span>
            <p class="pancarta-texto">${prefijo}${escaparHtml(pancartaTexto(item))}</p>
          </li>`;
        })
        .join("")}
    </ul>`;
}