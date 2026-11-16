// ============================================================
// FOOTER.JS — pie de página institucional. Obligatorio en toda
// pieza según el Manual de Imagen (imagotipo/URL + leyenda
// "Vigilada MinEducación"). Además, incluye el contacto de la
// sede sobre la que trabaja este proyecto (Extensión Facatativá).
// Se escribe una sola vez aquí:
//
//   <div id="footer"></div>
//   <script src="components/footer.js"></script>
//   <script> renderizarPiePagina("footer"); </script>
// ============================================================

function renderizarPiePagina(idContenedor) {
  const elemento = document.getElementById(idContenedor);
  if (!elemento) return;

  elemento.innerHTML = `
    <footer class="app-footer">
      <div>
        <strong>www.ucundinamarca.edu.co</strong> · Vigilada MinEducación — Plataforma PGC
      </div>
      <div class="footer-contacto">
        <a href="https://www.ucundinamarca.edu.co/index.php/sedes/ExtensionFacatativa" target="_blank" rel="noopener">Extensión Facatativá</a>
        · Calle 14 con Avenida 15 · (+57 1) 892 0706
      </div>
    </footer>
  `;
}