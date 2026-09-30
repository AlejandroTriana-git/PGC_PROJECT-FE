// ============================================================
// CONFIGURARFECHA.JS — configuración de fechas de Radicación y
// Registro PGC por ciclo, para el contexto Encargado de Ciclo.
//
// Cada etapa tiene su propio botón "Editar" en la tabla.
// Al hacer clic se abre UN solo modal reutilizable que muestra
// las 2 fechas (inicio/fin) de la etapa seleccionada y lanza
// UN SOLO PUT /ciclos/:id/fechas/:stage — exactamente el endpoint
// que expone el backend para actualizar de forma granular.
//
// Los ciclos a cargo del usuario ya vienen en el JWT
// (usuario.encargado_de), así que no se pide ninguna lista aparte.
// ============================================================

// Nombres exactos del ENUM de stage en la base de datos —
// deben coincidir letra por letra.
const ETAPA_RADICACION    = "Radicación";
const ETAPA_REGISTRO_PGC  = "Registro PGC";

let ciclos_encargado   = [];
let ciclo_seleccionado = null;
let etapa_seleccionada = null;   // "Radicación" | "Registro PGC"
let modal_fechas       = null;

/** Formatea un rango de fechas para la tabla (solo YYYY-MM-DD, sin hora). */
function formatearRango(inicio, fin) {
  if (!inicio || !fin) return "Sin definir";
  return `${inicio.slice(0, 10)} al ${fin.slice(0, 10)}`;
}

/** Busca dentro de las filas de cycle_dates la que corresponde a la etapa. */
function buscarEtapa(filas_fecha, nombre_etapa) {
  return (filas_fecha || []).find((fila) => fila.stage === nombre_etapa) || null;
}

/**
 * Pinta la tabla con UNA fila por ciclo y DOS botones "Editar":
 * uno para Radicación y otro para Registro PGC.
 */
function pintarTablaFechas() {
  const cuerpo = document.getElementById("tabla-fechas");

  if (ciclos_encargado.length === 0) {
    cuerpo.innerHTML = `<tr><td colspan="5" class="text-muted fst-italic">No tienes ciclos a cargo.</td></tr>`;
    return;
  }

  cuerpo.innerHTML = ciclos_encargado
    .map(
      (ciclo) => `
      <tr>
        <td><strong>Ciclo ${ciclo.id_cycle}</strong></td>
        <td>${formatearRango(ciclo.fecha_inicio_radicacion, ciclo.fecha_fin_radicacion)}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary"
                  onclick="abrirEdicionFecha(${ciclo.id_cycle}, '${ETAPA_RADICACION}')">
            Editar
          </button>
        </td>
        <td>${formatearRango(ciclo.fecha_inicio_registro_pgc, ciclo.fecha_fin_registro_pgc)}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary"
                  onclick="abrirEdicionFecha(${ciclo.id_cycle}, '${ETAPA_REGISTRO_PGC}')">
            Editar
          </button>
        </td>
      </tr>`
    )
    .join("");
}

/**
 * Abre el modal de edición para UNA etapa específica de un ciclo.
 * @param {number|string} id_cycle  - ID del ciclo (puede llegar como string desde el onclick)
 * @param {string}        nombre_etapa - "Radicación" | "Registro PGC"
 */
function abrirEdicionFecha(id_cycle, nombre_etapa) {
  // Coercionar a número para que el find funcione igual sin importar
  // si el onclick pasa el ID como number o como string.
  ciclo_seleccionado = ciclos_encargado.find((c) => c.id_cycle === Number(id_cycle));
  if (!ciclo_seleccionado) return;

  etapa_seleccionada = nombre_etapa;

  // Título del modal: "Ciclo 1 — Radicación"
  document.getElementById("fechas-titulo").textContent =
    `Ciclo ${ciclo_seleccionado.id_cycle} — ${nombre_etapa}`;

  // Prellenar las fechas de la etapa seleccionada.
  // .slice(0, 10) porque <input type="date"> solo acepta YYYY-MM-DD.
  let fecha_inicio, fecha_fin;
  if (nombre_etapa === ETAPA_RADICACION) {
    fecha_inicio = ciclo_seleccionado.fecha_inicio_radicacion;
    fecha_fin    = ciclo_seleccionado.fecha_fin_radicacion;
  } else {
    fecha_inicio = ciclo_seleccionado.fecha_inicio_registro_pgc;
    fecha_fin    = ciclo_seleccionado.fecha_fin_registro_pgc;
  }

  document.getElementById("input-fecha-inicio").value = (fecha_inicio || "").slice(0, 10);
  document.getElementById("input-fecha-fin").value    = (fecha_fin    || "").slice(0, 10);

  ocultarBanner("banner-modal-fechas");
  modal_fechas.show();
}

/**
 * Envía PUT /ciclos/:id/fechas/:stage solo para la etapa que el
 * encargado eligió editar. No toca la otra etapa.
 */
async function guardarFechas() {
  const fecha_inicio = document.getElementById("input-fecha-inicio").value;
  const fecha_fin    = document.getElementById("input-fecha-fin").value;

  // ── Validaciones ──────────────────────────────────────────
  if (!fecha_inicio || !fecha_fin) {
    mostrarBanner("banner-modal-fechas", "error", "Debes completar las 2 fechas.");
    return;
  }
  if (fecha_fin < fecha_inicio) {
    mostrarBanner(
      "banner-modal-fechas",
      "error",
      `La fecha de fin de "${etapa_seleccionada}" no puede ser anterior a la de inicio.`
    );
    return;
  }

  const boton = document.getElementById("btn-guardar-fechas");
  boton.disabled    = true;
  boton.textContent = "Guardando...";

  try {
    // Un solo PUT para la etapa seleccionada.
    // Se pasa el nombre de la etapa directamente en la URL (sin encodeURIComponent)
    // para evitar doble codificación: fetch() ya maneja tildes y espacios.
    const res = await peticionApi(
      `/ciclos/${ciclo_seleccionado.id_cycle}/fechas/${etapa_seleccionada}`,
      {
        method: "PUT",
        body: JSON.stringify({
          start_date: `${fecha_inicio}T00:00:00`,
          end_date:   `${fecha_fin}T23:59:59`,
        }),
      }
    );
    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      mostrarBanner(
        "banner-modal-fechas",
        "error",
        datos.mensaje || `No fue posible guardar "${etapa_seleccionada}".`
      );
      return;
    }

    // Éxito: mostrar banner en la página (no en el modal) y refrescar la tabla.
    mostrarBanner(
      "banner",
      "success",
      `"${etapa_seleccionada}" del Ciclo ${ciclo_seleccionado.id_cycle} actualizada.`
    );

    // Actualizar el dato local para que la tabla refleje las fechas nuevas
    // sin tener que recargar la página.
    const idx = ciclos_encargado.findIndex((c) => c.id_cycle === ciclo_seleccionado.id_cycle);
    if (idx !== -1) {
      if (etapa_seleccionada === ETAPA_RADICACION) {
        ciclos_encargado[idx].fecha_inicio_radicacion = `${fecha_inicio}T00:00:00`;
        ciclos_encargado[idx].fecha_fin_radicacion    = `${fecha_fin}T23:59:59`;
      } else {
        ciclos_encargado[idx].fecha_inicio_registro_pgc = `${fecha_inicio}T00:00:00`;
        ciclos_encargado[idx].fecha_fin_registro_pgc    = `${fecha_fin}T23:59:59`;
      }
    }

    pintarTablaFechas();
    modal_fechas.hide();
  } catch {
    mostrarBanner("banner-modal-fechas", "error", "No fue posible conectar con el servidor.");
  } finally {
    boton.disabled    = false;
    boton.textContent = "Guardar cambios";
  }
}

/**
 * Carga los ciclos a cargo del usuario. Los IDs vienen en el JWT
 * (usuario.encargado_de); por cada uno se piden sus fechas de etapa
 * desde GET /ciclos/:id/fechas (devuelve array de {stage, start_date, end_date}).
 */
async function inicializarConfigurarFecha() {
  modal_fechas = new bootstrap.Modal(document.getElementById("modal-fechas"));

  const usuario     = obtenerUsuario();
  const ids_a_cargo = usuario ? usuario.encargado_de : [];

  if (ids_a_cargo.length === 0) {
    mostrarBanner("banner", "error", "No tienes ciclos asignados como encargado.");
    return;
  }

  try {
    ciclos_encargado = await Promise.all(
      ids_a_cargo.map(async (id_cycle) => {
        const res_fechas = await peticionApi(`/ciclos/${id_cycle}/fechas`);
        if (!res_fechas.ok) throw new Error("fechas");
        const filas_fecha = await res_fechas.json();

        const fila_radicacion = buscarEtapa(filas_fecha, ETAPA_RADICACION);
        const fila_registro   = buscarEtapa(filas_fecha, ETAPA_REGISTRO_PGC);

        return {
          id_cycle,
          fecha_inicio_radicacion:   fila_radicacion?.start_date || null,
          fecha_fin_radicacion:      fila_radicacion?.end_date   || null,
          fecha_inicio_registro_pgc: fila_registro?.start_date   || null,
          fecha_fin_registro_pgc:    fila_registro?.end_date     || null,
        };
      })
    );
  } catch {
    mostrarBanner("banner", "error", "No fue posible cargar tus ciclos. Intenta recargar la página.");
    ciclos_encargado = [];
  }

  pintarTablaFechas();

  document.getElementById("btn-guardar-fechas").addEventListener("click", guardarFechas);
}