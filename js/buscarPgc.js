// ============================================================
// BUSCARPGC.JS — HU-04: buscador general de PGC registrados,
// con filtros y resultados paginados (15 por página).
//
// Es una página PÚBLICA: funciona con o sin sesión. El backend
// usa autenticación opcional en GET /pgc/search, /pgc/:id,
// /categorias y /ciclos (mismos endpoints de siempre).
//
// Contrato de GET /pgc/search: query params q, categoria, ciclo,
// estado, pagina — responde:
//   {
//     resultados: [{ id_pgc, title_proposal, name_cycle, categorias, estado }],
//     pagina_actual, total_paginas, total_resultados
//   }
// Si llega vacío, "resultados" es un arreglo vacío (no un 404).
// ============================================================

const RESULTADOS_POR_PAGINA = 15;
let pagina_actual = 1;

/** Categorías de un resultado como chips (mismo estilo que la ficha y Mi PGC). */
function chipsCategoriasBusqueda(categorias) {
  const textos = Array.isArray(categorias)
    ? categorias.map((c) => (typeof c === "object" ? c.name_category : c))
    : [];
  return listaChips(textos, "Sin categorías");
}

/** Llena los selects de Categoría y Ciclo con datos reales. */
async function cargarFiltros() {
  try {
    const res = await peticionApi("/categorias");
    const categorias = res.ok ? await res.json() : [];
    const select = document.getElementById("filtro-categoria");
    categorias.forEach((c) => {
      const opcion = document.createElement("option");
      opcion.value = c.id_category;
      opcion.textContent = c.name_category;
      select.appendChild(opcion);
    });
  } catch { /* si falla, el filtro de categoría queda solo con "Todas" */ }

  try {
    const res = await peticionApi("/ciclos");
    const ciclos = res.ok ? await res.json() : [];
    const select = document.getElementById("filtro-ciclo");
    // GET /ciclos devuelve { id, subject_cycle, max_members, id_encargado }
    // (contrato del API, no nombres de columnas de la BD).
    ciclos.forEach((c) => {
      const opcion = document.createElement("option");
      opcion.value = c.id;
      opcion.textContent = c.subject_cycle || `Ciclo ${c.id}`;
      select.appendChild(opcion);
    });
  } catch { /* si falla, el filtro de ciclo queda solo con "Todos" */ }
}

/** Arma la query string a partir de los filtros actuales del formulario. */
function armarQueryBusqueda() {
  const parametros = new URLSearchParams();
  const texto = document.getElementById("filtro-texto").value.trim();
  const categoria = document.getElementById("filtro-categoria").value;
  const ciclo = document.getElementById("filtro-ciclo").value;
  const estado = document.getElementById("filtro-estado").value;

  if (texto) parametros.set("q", texto);
  if (categoria) parametros.set("categoria", categoria);
  if (ciclo) parametros.set("ciclo", ciclo);
  if (estado) parametros.set("estado", estado);
  parametros.set("pagina", pagina_actual);

  return parametros.toString();
}

/** Pinta los controles de paginación (anterior / número de página / siguiente). */
function pintarPaginacion(pagina_actual_resp, total_paginas) {
  const nav = document.getElementById("paginacion");

  if (!total_paginas || total_paginas <= 1) {
    nav.innerHTML = "";
    return;
  }

  nav.innerHTML = `
    <button class="btn btn-sm btn-outline-primary" id="btn-pagina-anterior" ${pagina_actual_resp <= 1 ? "disabled" : ""}>
      ← Anterior
    </button>
    <span class="align-self-center text-muted" style="font-size:.85rem;">
      Página ${pagina_actual_resp} de ${total_paginas}
    </span>
    <button class="btn btn-sm btn-outline-primary" id="btn-pagina-siguiente" ${pagina_actual_resp >= total_paginas ? "disabled" : ""}>
      Siguiente →
    </button>
  `;

  document.getElementById("btn-pagina-anterior")?.addEventListener("click", () => {
    pagina_actual -= 1;
    ejecutarBusqueda();
  });
  document.getElementById("btn-pagina-siguiente")?.addEventListener("click", () => {
    pagina_actual += 1;
    ejecutarBusqueda();
  });
}

/** Ejecuta la búsqueda contra GET /pgc/search y pinta resultados + paginación. */
async function ejecutarBusqueda() {
  ocultarBanner("banner");
  const cuerpo = document.getElementById("tabla-resultados");
  const resumen = document.getElementById("resumen-resultados");
  cuerpo.innerHTML = `<tr><td colspan="5" class="text-muted fst-italic">Buscando...</td></tr>`;
  resumen.textContent = "";

  try {
    const query = armarQueryBusqueda();
    // Se guarda la búsqueda en la URL (sin recargar) para que "Volver" la conserve.
    history.replaceState(null, "", `${window.location.pathname}?${query}`);
    const res = await peticionApi(`/pgc/search?${query}`);
    if (!res.ok) throw new Error();
    const datos = await res.json();
    const resultados = datos.resultados || [];

    const total = datos.total_resultados ?? resultados.length;
    resumen.textContent = total === 1 ? "1 proyecto encontrado" : `${total} proyectos encontrados`;

    if (resultados.length === 0) {
      cuerpo.innerHTML = `<tr><td colspan="5" class="text-muted fst-italic">No se encontraron proyectos con esos filtros.</td></tr>`;
      document.getElementById("paginacion").innerHTML = "";
      return;
    }

    cuerpo.innerHTML = resultados
      .map(
        (p) => `
        <tr>
          <td><a class="titulo-resultado" href="fichaPgc.html?id=${encodeURIComponent(p.id_pgc)}">${escaparHtml(p.title_proposal)}</a></td>
          <td>${escaparHtml(p.name_cycle ?? p.id_cycle ?? "—")}</td>
          <td>${chipsCategoriasBusqueda(p.categorias)}</td>
          <td><span class="badge-estado ${p.estado === "Terminado" ? "aprobada" : "pendiente"}">${escaparHtml(p.estado)}</span></td>
          <td class="text-end">
            <a class="btn btn-sm btn-outline-primary" href="fichaPgc.html?id=${encodeURIComponent(p.id_pgc)}"
               aria-label="Ver ficha de ${escaparHtml(p.title_proposal)}">Ver ficha</a>
          </td>
        </tr>`
      )
      .join("");

    pintarPaginacion(datos.pagina_actual || pagina_actual, datos.total_paginas || 1);
  } catch {
    cuerpo.innerHTML = `<tr><td colspan="5" class="text-muted fst-italic">No fue posible cargar los resultados.</td></tr>`;
    mostrarBanner("banner", "error", "No fue posible conectar con el servidor.");
  }
}

/**
 * Rellena el formulario con los filtros que traiga la URL (?q=&categoria=...).
 * Así, al volver desde una ficha, la búsqueda sigue donde estaba.
 */
function aplicarFiltrosDeUrl() {
  const parametros = new URLSearchParams(window.location.search);
  const asignar = (id, valor) => {
    const campo = document.getElementById(id);
    if (campo && valor !== null) campo.value = valor;
  };
  asignar("filtro-texto", parametros.get("q"));
  asignar("filtro-categoria", parametros.get("categoria"));
  asignar("filtro-ciclo", parametros.get("ciclo"));
  asignar("filtro-estado", parametros.get("estado"));
  const pagina = parseInt(parametros.get("pagina"), 10);
  if (pagina > 0) pagina_actual = pagina;
}

async function inicializarBuscarPgc() {
  await cargarFiltros(); // primero las opciones, para poder marcar las de la URL
  aplicarFiltrosDeUrl();
  ejecutarBusqueda();

  document.getElementById("form-busqueda").addEventListener("submit", (evento) => {
    evento.preventDefault();
    pagina_actual = 1; // toda búsqueda nueva reinicia la paginación
    ejecutarBusqueda();
  });
}