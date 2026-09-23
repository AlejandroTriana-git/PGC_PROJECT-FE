// ============================================================
// APROBACIONES.JS — HU-08: listado y aprobación/rechazo de
// propuestas para el contexto "Encargado de Ciclo".
// ============================================================

let propuestas = [];       // se llena desde GET /propuestas?estado=Pendiente
let propuestaSeleccionada = null;
let modalDetalle = null;

function pintarTabla() {
  const cuerpo = document.getElementById("tabla-propuestas");

  if (propuestas.length === 0) {
    cuerpo.innerHTML = `<tr><td colspan="5" class="text-muted fst-italic">No hay propuestas pendientes.</td></tr>`;
    return;
  }

  cuerpo.innerHTML = propuestas
    .map(
      (propuesta) => `
      <tr>
        <td>${propuesta.title_proposal}</td>
        <td>${propuesta.leader_name}</td>
        <td>${propuesta.num_integrantes}</td>
        <td>${propuesta.ciclo}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="abrirDetalle(${propuesta.id_proposal})">Ver detalle</button>
        </td>
      </tr>`
    )
    .join("");
}

async function abrirDetalle(id) {
  // Usar id_proposal (no .id) tal como lo devuelve el BE
  propuestaSeleccionada = propuestas.find((p) => p.id_proposal === id);
  if (!propuestaSeleccionada) return;

  // Mapeo de campos del BE al detalle del modal
  document.getElementById("detalle-titulo").textContent          = propuestaSeleccionada.title_proposal;
  document.getElementById("detalle-lider").textContent           = propuestaSeleccionada.leader_name || "—";
  document.getElementById("detalle-integrantes").textContent     = propuestaSeleccionada.nombres_integrantes || "Solo el líder";
  document.getElementById("detalle-categorias").textContent      = propuestaSeleccionada.categorias || "Sin categorías";
  document.getElementById("detalle-descripcion").textContent     = propuestaSeleccionada.descr_proposal || "—";
  document.getElementById("detalle-problema").textContent        = propuestaSeleccionada.problem_proposal;
  document.getElementById("detalle-justificacion").textContent   = propuestaSeleccionada.justification_proposal;
  document.getElementById("detalle-objetivos").textContent       = propuestaSeleccionada.objectives_proposal;
  document.getElementById("detalle-solucion").textContent        = propuestaSeleccionada.solution_proposal;

  // Bug 2: cargar URL firmada del PDF desde el BE al abrir el modal
  const pdfContenedor = document.getElementById("detalle-pdf-contenedor");
  pdfContenedor.innerHTML = `<span class="text-muted fst-italic" style="font-size:.82rem;">Cargando enlace del PDF…</span>`;
  try {
    const resPdf = await peticionApi(`/propuestas/${propuestaSeleccionada.id_proposal}/pdf`);
    if (resPdf.ok) {
      const pdfData = await resPdf.json();
      renderEnlacePdf(pdfContenedor, pdfData);
    } else {
      renderEnlacePdf(pdfContenedor, null);
    }
  } catch {
    renderEnlacePdf(pdfContenedor, null);
  }

  document.getElementById("zona-rechazo").classList.add("hidden");
  document.getElementById("comentario-rechazo").value = "";
  document.getElementById("btn-mostrar-rechazo").classList.remove("d-none");
  document.getElementById("btn-confirmar-rechazo").classList.add("d-none");

  modalDetalle.show();
}


function quitarDeLaLista(id) {
  // Usar id_proposal (no .id)
  propuestas = propuestas.filter((p) => p.id_proposal !== id);
  pintarTabla();
  modalDetalle.hide();
}

async function inicializarAprobaciones() {
  modalDetalle = new bootstrap.Modal(document.getElementById("modal-detalle"));

  // ── Carga las propuestas pendientes desde la API ──────────
  // El ciclo del encargado se obtiene del JWT decodificado
  try {
    const usuario = obtenerUsuario();
    // El encargado tiene en su JWT el campo encargado_de con el ciclo asignado
    const id_cycle = usuario && usuario.encargado_de ? usuario.encargado_de[0] : null;

    if (!id_cycle) {
      mostrarBanner("banner", "error", "No tienes un ciclo asignado como encargado.");
      return;
    }

    const res = await peticionApi(`/propuestas?cycle=${id_cycle}&estado=Pendiente de validación`);
    if (!res.ok) throw new Error();
    propuestas = await res.json();
  } catch {
    mostrarBanner("banner", "error", "No fue posible cargar las propuestas. Intenta recargar la página.");
  }

  pintarTabla();

  // ── Aprobar ───────────────────────────────────────────────
  document.getElementById("btn-aprobar").addEventListener("click", async () => {
    const boton = document.getElementById("btn-aprobar");
    boton.disabled = true;
    boton.textContent = "Aprobando...";

    try {
      const res = await peticionApi(`/propuestas/${propuestaSeleccionada.id_proposal}/aprobar`, { method: "PATCH" });
      const json = await res.json().catch(() => ({}));

      mostrarBanner(
        "banner",
        res.ok ? "success" : "error",
        json.mensaje || (res.ok
          ? `Propuesta "${propuestaSeleccionada.title_proposal}" aprobada.`
          : "No fue posible aprobar la propuesta.")
      );

      if (res.ok) quitarDeLaLista(propuestaSeleccionada.id_proposal);
    } catch {
      mostrarBanner("banner", "error", "No fue posible conectar con el servidor.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Aprobar";
    }
  });

  // ── Mostrar zona de rechazo ───────────────────────────────
  document.getElementById("btn-mostrar-rechazo").addEventListener("click", () => {
    document.getElementById("zona-rechazo").classList.remove("hidden");
    document.getElementById("btn-mostrar-rechazo").classList.add("d-none");
    document.getElementById("btn-confirmar-rechazo").classList.remove("d-none");
  });

  // ── Confirmar rechazo ─────────────────────────────────────
  document.getElementById("btn-confirmar-rechazo").addEventListener("click", async () => {
    const comentario = document.getElementById("comentario-rechazo").value.trim();
    if (!comentario) {
      document.getElementById("comentario-rechazo").classList.add("is-invalid");
      return;
    }
    document.getElementById("comentario-rechazo").classList.remove("is-invalid");

    const boton = document.getElementById("btn-confirmar-rechazo");
    boton.disabled = true;
    boton.textContent = "Rechazando...";

    try {
      const res = await peticionApi(`/propuestas/${propuestaSeleccionada.id_proposal}/rechazar`, {
        method: "PATCH",
        body: JSON.stringify({ comentario }),
      });
      const json = await res.json().catch(() => ({}));

      mostrarBanner(
        "banner",
        res.ok ? "success" : "error",
        json.mensaje || (res.ok
          ? `Propuesta "${propuestaSeleccionada.title_proposal}" rechazada.`
          : "No fue posible rechazar la propuesta.")
      );

      if (res.ok) quitarDeLaLista(propuestaSeleccionada.id_proposal);
    } catch {
      mostrarBanner("banner", "error", "No fue posible conectar con el servidor.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Confirmar rechazo";
    }
  });
}