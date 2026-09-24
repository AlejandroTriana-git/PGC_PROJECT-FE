// ============================================================
// CONFIGURARFECHA.JS — configuración de fechas de Radicación y
// Registro PGC por ciclo, para el contexto Encargado de Ciclo.
// ============================================================

let ciclos_encargado = [];   // se llena desde GET /ciclos/encargado
let ciclo_seleccionado = null;
let modal_fechas = null;

/** Formatea un rango de fechas para mostrarlo en la tabla. */
function formatearRango(inicio, fin) {
  if (!inicio || !fin) return "Sin definir";
  return `${inicio} al ${fin}`;
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
  document.getElementById("input-inicio-radicacion").value = ciclo_seleccionado.fecha_inicio_radicacion || "";
  document.getElementById("input-fin-radicacion").value = ciclo_seleccionado.fecha_fin_radicacion || "";
  document.getElementById("input-inicio-registro").value = ciclo_seleccionado.fecha_inicio_registro_pgc || "";
  document.getElementById("input-fin-registro").value = ciclo_seleccionado.fecha_fin_registro_pgc || "";

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
    const res = await peticionApi(`/ciclos/${ciclo_seleccionado.id_cycle}/fechas`, {
      method: "PUT",
      body: JSON.stringify({
        fecha_inicio_radicacion: inicio_radicacion,
        fecha_fin_radicacion: fin_radicacion,
        fecha_inicio_registro_pgc: inicio_registro,
        fecha_fin_registro_pgc: fin_registro,
      }),
    });
    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      mostrarBanner("banner-modal-fechas", "error", datos.mensaje || "No fue posible guardar las fechas.");
      return;
    }

    mostrarBanner("banner", "success", datos.mensaje || `Fechas del ciclo ${ciclo_seleccionado.id_cycle} actualizadas.`);

    const idx = ciclos_encargado.findIndex((c) => c.id_cycle === ciclo_seleccionado.id_cycle);
    if (idx !== -1) {
      ciclos_encargado[idx] = {
        ...ciclos_encargado[idx],
        fecha_inicio_radicacion: inicio_radicacion,
        fecha_fin_radicacion: fin_radicacion,
        fecha_inicio_registro_pgc: inicio_registro,
        fecha_fin_registro_pgc: fin_registro,
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

async function inicializarConfigurarFecha() {
  modal_fechas = new bootstrap.Modal(document.getElementById("modal-fechas"));

  try {
    const res = await peticionApi("/ciclos/encargado");
    if (!res.ok) throw new Error("Error al cargar ciclos.");
    ciclos_encargado = await res.json();
  } catch {
    mostrarBanner("banner", "error", "No fue posible cargar tus ciclos. Intenta recargar la página.");
    ciclos_encargado = [];
  }

  pintarTablaFechas();

  document.getElementById("btn-guardar-fechas").addEventListener("click", guardarFechas);
}