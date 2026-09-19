// ============================================================
// FOOTER.JS — pie de página institucional. Obligatorio en toda
// pieza según el Manual de Imagen (logosímbolo/URL + leyenda
// "Vigilada MinEducación"). Se escribe una sola vez aquí:
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
      <strong>www.ucundinamarca.edu.co</strong> · Vigilada MinEducación — Plataforma PGC
    </footer>
  `;
}
