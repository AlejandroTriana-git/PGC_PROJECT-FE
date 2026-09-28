// ============================================================
// CONFIGURARFECHA.JS — configuración de fechas de Radicación y
// Registro PGC por ciclo, para el contexto Encargado de Ciclo.
//
// El backend maneja las fechas como filas por etapa (cycle_dates),
// no como columnas planas: GET /ciclos/:id/fechas devuelve hasta
// 4 filas { stage, start_date, end_date }, y PUT es granular por
// etapa (/ciclos/:id/fechas/:stage). Aquí armamos la vista "plana"
// (una fila por ciclo con sus 2 rangos) combinando esos datos.
//
// Los ciclos a cargo del usuario ya vienen en el JWT
// (usuario.encargado_de), así que no se pide ninguna lista aparte.
// ============================================================

// Nombres exactos del ENUM de stage en la base de datos —
// deben coincidir letra por letra.
const ETAPA_RADICACION = "Radicacion";
const ETAPA_REGISTRO_PGC = "Registro PGC";

let ciclos_encargado = [];
let ciclo_seleccionado = null;
let modal_fechas = null;

/** Formatea un rango de fechas para mostrarlo en la tabla (solo la parte de fecha, sin hora). */
function formatearRango(inicio, fin) {
  if (!inicio || !fin) return "Sin definir";
  return `${inicio.slice(0, 10)} al ${fin.slice(0, 10)}`;
}

/** Busca dentro de las filas de cycle_dates la que corresponda a una etapa puntual. */
function buscarEtapa(filas_fecha, nombre_etapa) {
  return (filas_fecha || []).find((fila) => fila.stage === nombre_etapa) || null;
}

function pintarTablaFechas() {
  const cuerpo = document.getElementById("tabla-fechas");

  if (ciclos_encargado.length === 0) {
    cuerpo.innerHTML = `<tr><td colspan="4" class="text-muted fst-italic">No tienes ciclos a cargo.</td></tr>`;
    return;
  }

  cuerpo.innerHTML = ciclos_encargado
    .map(
      (ciclo) => `
      <tr>
        <td>Ciclo ${ciclo.id_cycle}</td>
        <td>${formatearRango(ciclo.fecha_inicio_radicacion, ciclo.fecha_fin_radicacion)}</td>
        <td>${formatearRango(ciclo.fecha_inicio_registro_pgc, ciclo.fecha_fin_registro_pgc)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="abrirEdicionFecha(${ciclo.id_cycle})">Editar</button>
        </td>
      </tr>`
    )
    .join("");
}

function abrirEdicionFecha(id_cycle) {
  ciclo_seleccionado = ciclos_encargado.find((c) => c.id_cycle === id_cycle);
  if (!ciclo_seleccionado) return;

  document.getElementById("fechas-titulo").textContent = `Ciclo ${ciclo_seleccionado.id_cycle}`;
  // .slice(0, 10) porque el <input type="date"> solo acepta YYYY-MM-DD,
  // y el backend devuelve el DATETIME completo con la hora incluida.
  document.getElementById("input-inicio-radicacion").value = (ciclo_seleccionado.fecha_inicio_radicacion || "").slice(0, 10);
  document.getElementById("input-fin-radicacion").value = (ciclo_seleccionado.fecha_fin_radicacion || "").slice(0, 10);
  document.getElementById("input-inicio-registro").value = (ciclo_seleccionado.fecha_inicio_registro_pgc || "").slice(0, 10);
  document.getElementById("input-fin-registro").value = (ciclo_seleccionado.fecha_fin_registro_pgc || "").slice(0, 10);

  ocultarBanner("banner-modal-fechas");
  modal_fechas.show();
}

/** Valida que cada rango tenga la fecha de fin después (o igual) a la de inicio. */
function validarRangoFechas(inicio_radicacion, fin_radicacion, inicio_registro, fin_registro) {
  if (!inicio_radicacion || !fin_radicacion || !inicio_registro || !fin_registro) {
    return "Debes completar las 4 fechas.";
  }
  if (fin_radicacion < inicio_radicacion) {
    return "La fecha de fin de Radicación no puede ser anterior a la de inicio.";
  }
  if (fin_registro < inicio_registro) {
    return "La fecha de fin de Registro PGC no puede ser anterior a la de inicio.";
  }
  return null;
}

/**
 * Actualiza una sola etapa contra PUT /ciclos/:id/fechas/:stage.
 * El nombre de la etapa va codificado en la URL porque trae tilde
 * y espacio (encodeURIComponent evita que se rompa la petición).
 */
async function guardarEtapa(id_cycle, nombre_etapa, fecha_inicio, fecha_fin) {
  const res = await peticionApi(`/ciclos/${id_cycle}/fechas/${encodeURIComponent(nombre_etapa)}`, {
    method: "PUT",
    body: JSON.stringify({
      // Se completa la hora para que el rango cubra el día entero:
      // el inicio desde la medianoche, el fin hasta el final del día.
      start_date: `${fecha_inicio}T00:00:00`,
      end_date: `${fecha_fin}T23:59:59`,
    }),
  });
  const datos = await res.json().catch(() => ({}));
  return { ok: res.ok, datos };
}

async function guardarFechas() {
  const inicio_radicacion = document.getElementById("input-inicio-radicacion").value;
  const fin_radicacion = document.getElementById("input-fin-radicacion").value;
  const inicio_registro = document.getElementById("input-inicio-registro").value;
  const fin_registro = document.getElementById("input-fin-registro").value;

  const error_validacion = validarRangoFechas(inicio_radicacion, fin_radicacion, inicio_registro, fin_registro);
  if (error_validacion) {
    mostrarBanner("banner-modal-fechas", "error", error_validacion);
    return;
  }

  const boton = document.getElementById("btn-guardar-fechas");
  boton.disabled = true;
  boton.textContent = "Guardando...";

  try {
    const resultado_radicacion = await guardarEtapa(ciclo_seleccionado.id_cycle, ETAPA_RADICACION, inicio_radicacion, fin_radicacion);
    if (!resultado_radicacion.ok) {
      mostrarBanner("banner-modal-fechas", "error", resultado_radicacion.datos.mensaje || `No fue posible guardar la etapa "${ETAPA_RADICACION}".`);
      return;
    }

    const resultado_registro = await guardarEtapa(ciclo_seleccionado.id_cycle, ETAPA_REGISTRO_PGC, inicio_registro, fin_registro);
    if (!resultado_registro.ok) {
      // La etapa de Radicación ya quedó guardada en este punto — se le
      // avisa al usuario que el guardado quedó a medias, tal como lo
      // señaló backend: esto no es una transacción, son 2 updates.
      mostrarBanner("banner-modal-fechas", "error", `Se guardó Radicación, pero no fue posible guardar "${ETAPA_REGISTRO_PGC}": ${resultado_registro.datos.mensaje || "intenta de nuevo"}.`);
      return;
    }

    mostrarBanner("banner", "success", `Fechas del ciclo ${ciclo_seleccionado.id_cycle} actualizadas.`);

    const idx = ciclos_encargado.findIndex((c) => c.id_cycle === ciclo_seleccionado.id_cycle);
    if (idx !== -1) {
      ciclos_encargado[idx] = {
        ...ciclos_encargado[idx],
        fecha_inicio_radicacion: `${inicio_radicacion}T00:00:00`,
        fecha_fin_radicacion: `${fin_radicacion}T23:59:59`,
        fecha_inicio_registro_pgc: `${inicio_registro}T00:00:00`,
        fecha_fin_registro_pgc: `${fin_registro}T23:59:59`,
      };
    }
    pintarTablaFechas();
    modal_fechas.hide();
  } catch {
    mostrarBanner("banner-modal-fechas", "error", "No fue posible conectar con el servidor.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Guardar cambios";
  }
}

/**
 * Carga los ciclos a cargo del usuario. Los ids vienen en el JWT
 * (usuario.encargado_de); por cada uno se piden sus fechas por etapa.
 * Si alguna petición falla se muestra el error: una tabla con "Sin definir"
 * podría llevar al encargado a sobrescribir fechas reales.
 */
async function inicializarConfigurarFecha() {
  modal_fechas = new bootstrap.Modal(document.getElementById("modal-fechas"));

  const usuario = obtenerUsuario();
  const ids_a_cargo = usuario.encargado_de;

  try {
    ciclos_encargado = await Promise.all(
      ids_a_cargo.map(async (id_cycle) => {
        const res_fechas = await peticionApi(`/ciclos/${id_cycle}/fechas`);
        if (!res_fechas.ok) throw new Error("fechas");
        const filas_fecha = await res_fechas.json();

        const fila_radicacion = buscarEtapa(filas_fecha, ETAPA_RADICACION);
        const fila_registro = buscarEtapa(filas_fecha, ETAPA_REGISTRO_PGC);

        return {
          id_cycle,
          fecha_inicio_radicacion: fila_radicacion?.start_date || null,
          fecha_fin_radicacion: fila_radicacion?.end_date || null,
          fecha_inicio_registro_pgc: fila_registro?.start_date || null,
          fecha_fin_registro_pgc: fila_registro?.end_date || null,
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