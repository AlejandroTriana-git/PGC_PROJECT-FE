// ============================================================
// REPORTES.JS — HU nueva (issue #132 BE): descarga el informe de
// avance de PGC en PDF, en dos variantes: general (todos los ciclos
// combinados en un solo totalizado) o por ciclos (una sección por
// cada ciclo). Rutas del backend (solo Profesor/Administrador):
//   GET /pgc/informe/general/pdf
//   GET /pgc/informe/ciclos/pdf
// ============================================================

/** Pide el PDF al backend y dispara la descarga en el navegador. */
async function descargarInformePdf(ruta, nombreArchivo) {
  try {
    const res = await peticionApi(ruta);
    if (!res.ok) {
      mostrarBanner("banner", "error", "No se pudo generar el informe. Intenta de nuevo.");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    mostrarBanner("banner", "error", "No se pudo generar el informe. Intenta de nuevo.");
  }
}

/** Conecta los botones de la página. Se llama desde el <script> de reportes.html. */
function inicializarReportes() {
  document.getElementById("btn-informe-general").addEventListener("click", () => {
    descargarInformePdf("/pgc/informe/general/pdf", "informe-avance-general.pdf").catch(console.error);
  });

  document.getElementById("btn-informe-ciclos").addEventListener("click", () => {
    descargarInformePdf("/pgc/informe/ciclos/pdf", "informe-avance-por-ciclos.pdf").catch(console.error);
  });
}