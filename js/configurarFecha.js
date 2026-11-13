// ============================================================
// CONFIGURARFECHA.JS — configuración de las 4 etapas de cada ciclo
// (cycle_dates.stage) para el contexto Encargado de Ciclo.
//
// El backend guarda una fila por ciclo y etapa; GET /ciclos/:id/fechas
// devuelve hasta 4 filas { stage, start_date, end_date } y el PUT es por
// etapa: PUT /ciclos/:id/fechas/:stage. Los ciclos a cargo del usuario
// vienen en el JWT (usuario.encargado_de); no se pide ninguna lista aparte.
// ============================================================

// Literales exactos del ENUM de la base de datos (con tilde).
const ETAPAS_CONFIGURABLES = ["Radicación", "Registro PGC", "Sustentación", "Calificación"];

let ciclos_a_cargo = []; // [{ id_cycle, fechas: { [etapa]: { start_date, end_date } | null } }]
let seleccion = null;    // { id_cycle, etapa } de la fila que se está editando
let modal_fechas = null;

/** "2026-10-24 00:00:00" o ISO → "2026-10-24". */
function cortarFecha(valor) {
  return valor ? String(valor).slice(0, 10) : "";
}

/** "2026-10-24..." → "24/10/2026". */
function textoFecha(valor) {
  const corta = cortarFecha(valor);
  if (!corta) return "";
  const [anio, mes, dia] = corta.split("-");
  return `${dia}/${mes}/${anio}`;
}

function textoRango(fila) {
  return fila ? `${textoFecha(fila.start_date)} al ${textoFecha(fila.end_date)}` : "Sin definir";
}

function pintarTablaFechas() {
  const cuerpo = document.getElementById("tabla-fechas");

  if (ciclos_a_cargo.length === 0) {
    cuerpo.innerHTML = `<tr><td colspan="4" class="text-muted fst-italic">No tienes ciclos a cargo.</td></tr>`;
    return;
  }

  cuerpo.innerHTML = ciclos_a_cargo
    .flatMap((ciclo) =>
      ETAPAS_CONFIGURABLES.map(
        (etapa) => `
        <tr>
          <td>Ciclo ${escaparHtml(ciclo.id_cycle)}</td>
          <td>${escaparHtml(etapa)}</td>
          <td>${escaparHtml(textoRango(ciclo.fechas[etapa]))}</td>
          <td class="text-end">
            <button type="button" class="btn btn-sm btn-outline-primary"
                    data-ciclo="${escaparHtml(ciclo.id_cycle)}" data-etapa="${escaparHtml(etapa)}"
                    aria-label="Editar fechas de ${escaparHtml(etapa)} del ciclo ${escaparHtml(ciclo.id_cycle)}">
              Editar
            </button>
          </td>
        </tr>`
      )
    )
    .join("");
}

function abrirEdicion(id_cycle, etapa) {
  const ciclo = ciclos_a_cargo.find((c) => String(c.id_cycle) === String(id_cycle));
  if (!ciclo) return;

  seleccion = { id_cycle: ciclo.id_cycle, etapa };
  const fila = ciclo.fechas[etapa];

  document.getElementById("fechas-titulo").textContent = `Ciclo ${ciclo.id_cycle} — ${etapa}`;
  document.getElementById("input-fecha-inicio").value = fila ? cortarFecha(fila.start_date) : "";
  document.getElementById("input-fecha-fin").value = fila ? cortarFecha(fila.end_date) : "";
  ocultarBanner("banner-modal-fechas");
  modal_fechas.show();
}

async function guardarFechas() {
  const inicio = document.getElementById("input-fecha-inicio").value;
  const fin = document.getElementById("input-fecha-fin").value;

  if (!inicio || !fin) {
    mostrarBanner("banner-modal-fechas", "error", "Debes completar las dos fechas.");
    return;
  }
  if (fin < inicio) {
    mostrarBanner("banner-modal-fechas", "error", "La fecha de fin no puede ser anterior a la de inicio.");
    return;
  }

  const boton = document.getElementById("btn-guardar-fechas");
  boton.disabled = true;
  boton.textContent = "Guardando...";

  // El rango cubre días completos: inicio a las 00:00:00 y fin a las 23:59:59.
  const start_date = `${inicio}T00:00:00`;
  const end_date = `${fin}T23:59:59`;

  try {
    const res = await peticionApi(
      `/ciclos/${seleccion.id_cycle}/fechas/${encodeURIComponent(seleccion.etapa)}`,
      { method: "PUT", body: JSON.stringify({ start_date, end_date }) }
    );
    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      mostrarBanner("banner-modal-fechas", "error", datos.mensaje || "No fue posible guardar las fechas.");
      return;
    }

    const ciclo = ciclos_a_cargo.find((c) => String(c.id_cycle) === String(seleccion.id_cycle));
    ciclo.fechas[seleccion.etapa] = { start_date, end_date };

    pintarTablaFechas();
    modal_fechas.hide();
    mostrarBanner("banner", "success", datos.mensaje || `Fechas de ${seleccion.etapa} del ciclo ${seleccion.id_cycle} actualizadas.`);
  } catch {
    mostrarBanner("banner-modal-fechas", "error", "No fue posible conectar con el servidor.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Guardar cambios";
  }
}

async function inicializarConfigurarFecha() {
  modal_fechas = new bootstrap.Modal(document.getElementById("modal-fechas"));

  const usuario = obtenerUsuario();

  try {
    ciclos_a_cargo = await Promise.all(
      usuario.encargado_de.map(async (id_cycle) => {
        const res = await peticionApi(`/ciclos/${id_cycle}/fechas`);
        if (!res.ok) throw new Error("fechas");
        const filas = await res.json();

        const fechas = {};
        ETAPAS_CONFIGURABLES.forEach((etapa) => {
          const fila = (filas || []).find((f) => f.stage === etapa);
          fechas[etapa] = fila ? { start_date: fila.start_date, end_date: fila.end_date } : null;
        });
        return { id_cycle, fechas };
      })
    );
  } catch {
    // No se pinta "Sin definir": podría llevar a sobrescribir fechas reales.
    mostrarBanner("banner", "error", "No fue posible cargar las fechas de tus ciclos. Intenta recargar la página.");
    document.getElementById("tabla-fechas").innerHTML =
      `<tr><td colspan="4" class="text-muted fst-italic">No fue posible cargar las fechas.</td></tr>`;
    return;
  }

  pintarTablaFechas();

  document.getElementById("tabla-fechas").addEventListener("click", (evento) => {
    const boton = evento.target.closest("button[data-ciclo]");
    if (boton) abrirEdicion(boton.dataset.ciclo, boton.dataset.etapa);
  });
  document.getElementById("btn-guardar-fechas").addEventListener("click", guardarFechas);
}