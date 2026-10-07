// ============================================================
// CICLOS.JS — HU: configuración de ciclos por el Coordinador
// del programa (máximo de integrantes, encargado, jurados).
//
// CONTRATO DEL BE (GET /ciclos, PUT /ciclos/:id): por la regla de
// mapeo del backend, el FE NUNCA ve nombres de columnas de la BD.
// Cada ciclo llega como:
//   { id, subject_cycle, max_members, id_encargado }
// (antes eran id_cycle / name_cycle / id_person_charge).
// Los jurados se piden aparte con GET /ciclos/:id/jurados, que
// devuelve un arreglo de ids de profesor: [3, 7, ...].
// ============================================================

let profesores = [];       // se llena desde GET /ciclos/profesores → [{ id, nombre }]
let ciclos = [];           // se llena desde GET /ciclos → [{ id, subject_cycle, max_members, id_encargado, jurados }]
let cicloSeleccionado = null;
let modalCiclo = null;

function nombreProfesor(id) {
  // El repositorio devuelve { id, nombre } para cada profesor
  const profesor = profesores.find((p) => p.id === id);
  return profesor ? profesor.nombre : "Sin asignar";
}

/** Nombre visible del ciclo: subject_cycle o, si no viene, "Ciclo {id}". */
function nombreCiclo(ciclo) {
  return ciclo.subject_cycle || `Ciclo ${ciclo.id}`;
}

function pintarTablaCiclos() {
  const cuerpo = document.getElementById("tabla-ciclos");
  if (ciclos.length === 0) {
    cuerpo.innerHTML = `<tr><td colspan="5" class="text-muted fst-italic">No hay ciclos disponibles.</td></tr>`;
    return;
  }
  cuerpo.innerHTML = ciclos
    .map(
      (ciclo) => `
      <tr>
        <td>${escaparHtml(nombreCiclo(ciclo))}</td>
        <td>${ciclo.max_members}</td>
        <td>${escaparHtml(nombreProfesor(ciclo.id_encargado))}</td>
        <td>${escaparHtml((ciclo.jurados || []).map((id_jurado) => nombreProfesor(id_jurado)).join(", ")) || "Sin asignar"}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="abrirEdicionCiclo(${ciclo.id})">Editar</button>
          <a class="btn btn-sm btn-outline-secondary" href="lineamientos.html?ciclo=${ciclo.id}">Lineamientos</a>
        </td>
      </tr>`
    )
    .join("");
}

function abrirEdicionCiclo(id) {
  cicloSeleccionado = ciclos.find((c) => c.id === id);
  if (!cicloSeleccionado) return;

  document.getElementById("ciclo-titulo").textContent = nombreCiclo(cicloSeleccionado);
  document.getElementById("input-max-integrantes").value = cicloSeleccionado.max_members;

  const selectEncargado = document.getElementById("select-encargado");
  selectEncargado.innerHTML = profesores
    .map((p) => `<option value="${p.id}" ${p.id === cicloSeleccionado.id_encargado ? "selected" : ""}>${escaparHtml(p.nombre)}</option>`)
    .join("");

  // jurados ya es un arreglo de ids (ver cargarJuradosDeCiclos)
  const juradosActuales = cicloSeleccionado.jurados || [];
  const listaJurados = document.getElementById("lista-jurados");
  listaJurados.innerHTML = profesores
    .map(
      (p) => `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${p.id}" id="jurado-${p.id}" ${juradosActuales.includes(p.id) ? "checked" : ""}>
        <label class="form-check-label" for="jurado-${p.id}">${escaparHtml(p.nombre)}</label>
      </div>`
    )
    .join("");

  modalCiclo.show();
}

/**
 * Pide los jurados de cada ciclo (GET /ciclos/:id/jurados) y los
 * guarda en ciclo.jurados como arreglo de ids. Si falla uno, ese
 * ciclo queda sin jurados en vez de romper toda la tabla.
 */
async function cargarJuradosDeCiclos() {
  await Promise.all(
    ciclos.map(async (ciclo) => {
      try {
        const res = await peticionApi(`/ciclos/${ciclo.id}/jurados`);
        ciclo.jurados = res.ok ? await res.json() : [];
      } catch {
        ciclo.jurados = [];
      }
    })
  );
}

async function inicializarCiclos() {
  modalCiclo = new bootstrap.Modal(document.getElementById("modal-ciclo"));

  // ── Carga profesores y ciclos en paralelo ─────────────────
  // El endpoint de profesores es /ciclos/profesores (definido en ciclosRoutes)
  try {
    const [resProfesores, resCiclos] = await Promise.all([
      peticionApi("/ciclos/profesores"),
      peticionApi("/ciclos"),
    ]);

    if (!resProfesores.ok) throw new Error("profesores");
    if (!resCiclos.ok) throw new Error("ciclos");

    profesores = await resProfesores.json();
    ciclos = await resCiclos.json();
    await cargarJuradosDeCiclos();
  } catch {
    mostrarBanner("banner", "error", "No fue posible cargar los datos. Intenta recargar la página.");
  }

  pintarTablaCiclos();

  // ── Guardar cambios del ciclo ─────────────────────────────
  document.getElementById("btn-guardar-ciclo").addEventListener("click", async () => {
    const maxIntegrantes = Number(document.getElementById("input-max-integrantes").value);
    const idEncargado = Number(document.getElementById("select-encargado").value);

    // Jurados seleccionados (para la llamada separada al endpoint de jurados)
    const idsJurados = profesores
      .filter((p) => document.getElementById(`jurado-${p.id}`)?.checked)
      .map((p) => p.id);

    const boton = document.getElementById("btn-guardar-ciclo");
    boton.disabled = true;
    boton.textContent = "Guardando...";

    try {
      // 1️⃣ PUT /ciclos/:id — actualizar datos básicos del ciclo.
      // subject_cycle es obligatorio en el BE: se reenvía el que ya tenía.
      const resCiclo = await peticionApi(`/ciclos/${cicloSeleccionado.id}`, {
        method: "PUT",
        body: JSON.stringify({
          subject_cycle: cicloSeleccionado.subject_cycle,
          max_members:   maxIntegrantes,
          id_encargado:  idEncargado,
        }),
      });
      const jsonCiclo = await resCiclo.json().catch(() => ({}));

      if (!resCiclo.ok) {
        mostrarBanner("banner", "error", jsonCiclo.mensaje || "No fue posible guardar los cambios del ciclo.");
        return;
      }

      // 2️⃣ POST /ciclos/:id/jurados — asignar jurados (endpoint separado del BE)
      // Solo se envía si hay jurados seleccionados
      if (idsJurados.length > 0) {
        const resJurados = await peticionApi(`/ciclos/${cicloSeleccionado.id}/jurados`, {
          method: "POST",
          body: JSON.stringify({ id_jurados: idsJurados }),
        });
        const jsonJurados = await resJurados.json().catch(() => ({}));

        if (!resJurados.ok) {
          mostrarBanner("banner", "error", jsonJurados.mensaje || "Ciclo guardado, pero no se pudieron asignar los jurados.");
          return;
        }
      }

      mostrarBanner("banner", "success", `${nombreCiclo(cicloSeleccionado)} actualizado.`);

      // Actualiza el dato local con lo que devolvió el BE (mismo contrato que GET /ciclos)
      const idx = ciclos.findIndex((c) => c.id === cicloSeleccionado.id);
      if (idx !== -1) {
        ciclos[idx] = {
          ...ciclos[idx],
          ...(jsonCiclo && jsonCiclo.id ? jsonCiclo : { max_members: maxIntegrantes, id_encargado: idEncargado }),
          jurados: [...new Set([...(ciclos[idx].jurados || []), ...idsJurados])],
        };
      }
      pintarTablaCiclos();
      modalCiclo.hide();
    } catch {
      mostrarBanner("banner", "error", "No fue posible conectar con el servidor.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Guardar";
    }
  });
}