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
        <td>${propuesta.titulo}</td>
        <td>${propuesta.lider}</td>
        <td>${propuesta.integrantes}</td>
        <td>${propuesta.ciclo}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="abrirDetalle(${propuesta.id})">Ver detalle</button>
        </td>
      </tr>`
    )
    .join("");
}

function abrirDetalle(id) {
  propuestaSeleccionada = propuestas.find((p) => p.id === id);
  if (!propuestaSeleccionada) return;

  document.getElementById("detalle-titulo").textContent = propuestaSeleccionada.titulo;
  document.getElementById("detalle-problema").textContent = propuestaSeleccionada.problema;
  document.getElementById("detalle-justificacion").textContent = propuestaSeleccionada.justificacion;
  document.getElementById("detalle-objetivos").textContent = propuestaSeleccionada.objetivos;
  document.getElementById("detalle-solucion").textContent = propuestaSeleccionada.solucion;
  renderEnlacePdf(
    document.getElementById("detalle-pdf-contenedor"),
    propuestaSeleccionada.pdf   // { url, "expira-en-segundos": 3600 }
  );

  document.getElementById("zona-rechazo").classList.add("hidden");
  document.getElementById("comentario-rechazo").value = "";
  document.getElementById("btn-mostrar-rechazo").classList.remove("d-none");
  document.getElementById("btn-confirmar-rechazo").classList.add("d-none");

  modalDetalle.show();
}

function quitarDeLaLista(id) {
  propuestas = propuestas.filter((p) => p.id !== id);
  pintarTabla();
  modalDetalle.hide();
}

async function inicializarAprobaciones() {
  modalDetalle = new bootstrap.Modal(document.getElementById("modal-detalle"));

  // ── Carga las propuestas pendientes desde la API ──────────
  try {
    const res = await peticionApi("/propuestas?estado=Pendiente de validación");
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
      const res = await peticionApi(`/propuestas/${propuestaSeleccionada.id}/aprobar`, { method: "PATCH" });
      const json = await res.json().catch(() => ({}));

      mostrarBanner(
        "banner",
        res.ok ? "success" : "error",
        json.mensaje || (res.ok
          ? `Propuesta "${propuestaSeleccionada.titulo}" aprobada.`
          : "No fue posible aprobar la propuesta.")
      );

      if (res.ok) quitarDeLaLista(propuestaSeleccionada.id);
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
      const res = await peticionApi(`/propuestas/${propuestaSeleccionada.id}/rechazar`, {
        method: "PATCH",
        body: JSON.stringify({ comentario }),
      });
      const json = await res.json().catch(() => ({}));

      mostrarBanner(
        "banner",
        res.ok ? "success" : "error",
        json.mensaje || (res.ok
          ? `Propuesta "${propuestaSeleccionada.titulo}" rechazada.`
          : "No fue posible rechazar la propuesta.")
      );

      if (res.ok) quitarDeLaLista(propuestaSeleccionada.id);
    } catch {
      mostrarBanner("banner", "error", "No fue posible conectar con el servidor.");
    } finally {
      boton.disabled = false;
      boton.textContent = "Confirmar rechazo";
    }
  });
}