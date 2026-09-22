// ============================================================
// CICLOS.JS — HU: configuración de ciclos por el Coordinador
// del programa (máximo de integrantes, encargado, jurados).
// ============================================================

let profesores = [];       // se llena desde GET /profesores
let ciclos = [];           // se llena desde GET /ciclos
let cicloSeleccionado = null;
let modalCiclo = null;

function nombreProfesor(id) {
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
      (ciclo) => `
      <tr>
        <td>Ciclo ${ciclo.id}</td>
        <td>${ciclo.maxIntegrantes}</td>
        <td>${nombreProfesor(ciclo.idEncargado)}</td>
        <td>${(ciclo.idsJurados || []).map(nombreProfesor).join(", ") || "Sin asignar"}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="abrirEdicionCiclo(${ciclo.id})">Editar</button>
        </td>
      </tr>`
    )
    .join("");
}

function abrirEdicionCiclo(id) {
  cicloSeleccionado = ciclos.find((c) => c.id === id);
  if (!cicloSeleccionado) return;

  document.getElementById("ciclo-titulo").textContent = `Ciclo ${cicloSeleccionado.id}`;
  document.getElementById("input-max-integrantes").value = cicloSeleccionado.maxIntegrantes;

  const selectEncargado = document.getElementById("select-encargado");
  selectEncargado.innerHTML = profesores
    .map((p) => `<option value="${p.id}" ${p.id === cicloSeleccionado.idEncargado ? "selected" : ""}>${p.nombre}</option>`)
    .join("");

  const listaJurados = document.getElementById("lista-jurados");
  listaJurados.innerHTML = profesores
    .map(
      (p) => `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${p.id}" id="jurado-${p.id}" ${(cicloSeleccionado.idsJurados || []).includes(p.id) ? "checked" : ""}>
        <label class="form-check-label" for="jurado-${p.id}">${p.nombre}</label>
      </div>`
    )
    .join("");

  modalCiclo.show();
}

async function inicializarCiclos() {
  modalCiclo = new bootstrap.Modal(document.getElementById("modal-ciclo"));

  // ── Carga profesores y ciclos en paralelo ─────────────────
  try {
    const [resProfesores, resCiclos] = await Promise.all([
      peticionApi("/profesores"),
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
    const idsJurados = profesores
      .filter((p) => document.getElementById(`jurado-${p.id}`)?.checked)
      .map((p) => p.id);

    const boton = document.getElementById("btn-guardar-ciclo");
    boton.disabled = true;
    boton.textContent = "Guardando...";

    try {
      const res = await peticionApi(`/ciclos/${cicloSeleccionado.id}`, {
        method: "PUT",
        body: JSON.stringify({
          max_members: maxIntegrantes,
          id_encargado: idEncargado,
          id_jurados: idsJurados,
        }),
      });
      const json = await res.json().catch(() => ({}));

      mostrarBanner(
        "banner",
        res.ok ? "success" : "error",
        json.mensaje || (res.ok
          ? `Ciclo ${cicloSeleccionado.id} actualizado.`
          : "No fue posible guardar los cambios.")
      );

      if (res.ok) {
        // Actualiza el dato local para que la tabla se refresque sin recargar.
        const idx = ciclos.findIndex((c) => c.id === cicloSeleccionado.id);
        if (idx !== -1) ciclos[idx] = { ...ciclos[idx], maxIntegrantes, idEncargado, idsJurados };
        pintarTablaCiclos();
        modalCiclo.hide();
      }
    } catch {
      mostrarBanner("banner", "error", "No fue posible conectar con el servidor.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Guardar";
    }
  });
}