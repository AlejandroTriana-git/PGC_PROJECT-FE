// ============================================================
// CICLOS.JS — HU: configuración de ciclos por el Coordinador
// del programa (máximo de integrantes, encargado, jurados).
// ============================================================

let profesores = [];       // se llena desde GET /ciclos/profesores
let ciclos = [];           // se llena desde GET /ciclos
let cicloSeleccionado = null;
let modalCiclo = null;

function nombreProfesor(id) {
  // El repositorio devuelve { id, nombre } para cada profesor
  const profesor = profesores.find((p) => p.id === id);
  return profesor ? profesor.nombre : "Sin asignar";
}

function pintarTablaCiclos() {
  const cuerpo = document.getElementById("tabla-ciclos");
  if (ciclos.length === 0) {
    cuerpo.innerHTML = `<tr><td colspan="5" class="text-muted fst-italic">No hay ciclos disponibles.</td></tr>`;
    return;
  }
  cuerpo.innerHTML = ciclos
    .map(
      // Mapeo correcto: id_cycle, max_members, id_person_charge
      (ciclo) => `
      <tr>
        <td>Ciclo ${ciclo.id_cycle}</td>
        <td>${ciclo.max_members}</td>
        <td>${nombreProfesor(ciclo.id_person_charge)}</td>
        <td>${(ciclo.jurados || []).map((j) => nombreProfesor(j.id_juror)).join(", ") || "Sin asignar"}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="abrirEdicionCiclo(${ciclo.id_cycle})">Editar</button>
        </td>
      </tr>`
    )
    .join("");
}

function abrirEdicionCiclo(id) {
  // Usar id_cycle (no .id)
  cicloSeleccionado = ciclos.find((c) => c.id_cycle === id);
  if (!cicloSeleccionado) return;

  document.getElementById("ciclo-titulo").textContent = `Ciclo ${cicloSeleccionado.id_cycle}`;
  document.getElementById("input-max-integrantes").value = cicloSeleccionado.max_members;

  const selectEncargado = document.getElementById("select-encargado");
  selectEncargado.innerHTML = profesores
    .map((p) => `<option value="${p.id}" ${p.id === cicloSeleccionado.id_person_charge ? "selected" : ""}>${p.nombre}</option>`)
    .join("");

  // Los jurados se obtienen de ciclo.jurados (endpoint separado GET /:id/jurados)
  const juradosActuales = (cicloSeleccionado.jurados || []).map((j) => j.id_juror);
  const listaJurados = document.getElementById("lista-jurados");
  listaJurados.innerHTML = profesores
    .map(
      (p) => `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${p.id}" id="jurado-${p.id}" ${juradosActuales.includes(p.id) ? "checked" : ""}>
        <label class="form-check-label" for="jurado-${p.id}">${p.nombre}</label>
      </div>`
    )
    .join("");

  modalCiclo.show();
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
      // 1️⃣ PUT /ciclos/:id — actualizar datos básicos del ciclo
      // subject_cycle: se usa el name_cycle existente del ciclo (o se puede agregar un input)
      const resCiclo = await peticionApi(`/ciclos/${cicloSeleccionado.id_cycle}`, {
        method: "PUT",
        body: JSON.stringify({
          subject_cycle: cicloSeleccionado.name_cycle, // campo requerido por mapearDatosCiclo en el BE
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
        const resJurados = await peticionApi(`/ciclos/${cicloSeleccionado.id_cycle}/jurados`, {
          method: "POST",
          body: JSON.stringify({ id_jurados: idsJurados }),
        });
        const jsonJurados = await resJurados.json().catch(() => ({}));

        if (!resJurados.ok) {
          mostrarBanner("banner", "error", jsonJurados.mensaje || "Ciclo guardado, pero no se pudieron asignar los jurados.");
          return;
        }
      }

      mostrarBanner("banner", "success", `Ciclo ${cicloSeleccionado.id_cycle} actualizado.`);

      // Actualiza el dato local para que la tabla se refresque sin recargar.
      const idx = ciclos.findIndex((c) => c.id_cycle === cicloSeleccionado.id_cycle);
      if (idx !== -1) {
        ciclos[idx] = {
          ...ciclos[idx],
          max_members:      maxIntegrantes,
          id_person_charge: idEncargado,
          // jurados: se actualizará en la respuesta del BE si se hace fetch
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