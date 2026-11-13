# Pruebas unitarias del FE — Plataforma PGC

Copia estos archivos en la **raíz del proyecto** (junto a `index.html`):

```
package.json
jest.config.js
.gitignore
tests/
```

## Uso

```bash
npm install            # una sola vez (instala Jest + jsdom)
npm test               # corre todas las pruebas
npm run cobertura      # pruebas + informe y verificación del 70 %
```

`npm run cobertura` termina con error (código 1) si líneas, sentencias o funciones
quedan por debajo del 70 % de **todo** `js/` y `components/`, o si algún archivo
del FE no aparece en el reporte. Las ramas se muestran pero no bloquean.
El detalle HTML queda en `coverage/lcov-report/index.html`.

## Cómo está armado

- `tests/*.test.js` — una prueba por archivo (o grupo) del FE.
- `tests/helpers/transformadorScripts.js` — los scripts del proyecto no son módulos
  (se cargan con `<script>`). Este transformador publica sus funciones en `window` al
  hacer `require`, sin modificar tu código fuente, y así Jest puede medirlos.
- `tests/helpers/entorno.js` — utilidades: `simularApi` (fetch falso por ruta),
  `iniciarSesionDePrueba` (JWT), `cargarHtml` (usa el `<body>` real de cada página),
  `simularUbicacion`, `congelarFecha`, etc.
- `tests/verificarCobertura.js` — la función que analiza la cobertura (`analizarCobertura`)
  y el script que la ejecuta. Tiene sus propias pruebas.

## Si algo falla en la primera corrida

Estas pruebas se escribieron sin poder ejecutar Jest (el entorno no tenía internet).
Si una falla, pega aquí el mensaje y se ajusta. Dos puntos a vigilar:

- `simularUbicacion` usa `delete window.location`, que funciona con Jest 29 (el de
  `package.json`); no lo subas a Jest 30 sin cambiarlo.
- Si el total queda por debajo del 70 %, el informe marca con `←` los archivos
  con menos cobertura.
