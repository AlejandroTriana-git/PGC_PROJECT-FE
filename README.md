# Plataforma Web Gestión PGC — Frontend

Interfaz web de la plataforma para la gestión, seguimiento y continuidad de los **Proyectos de Gestión del Conocimiento (PGC)** del programa de Ingeniería de Sistemas y Computación de la Universidad de Cundinamarca.

La plataforma centraliza la información de los proyectos, facilita su seguimiento durante los ciclos académicos y permite consultar proyectos anteriores para fomentar su continuidad y reutilización.

El backend está en el repositorio [PGC_PROJECT-BE](https://github.com/AlejandroTriana-git/PGC_PROJECT-BE).

## Objetivo

Ofrecer a estudiantes, profesores, encargados de ciclo, jurados y administradores las pantallas para radicar y aprobar propuestas, registrar el PGC, subir evidencias, calificar y consultar el catálogo de proyectos.

## Tecnologías

- HTML, CSS y JavaScript, sin framework ni paso de compilación
- Bootstrap 5.3.3 (cargado desde CDN)
- Jest y jsdom para las pruebas unitarias
- ESLint, HTMLHint y Stylelint para la calidad del código
- Accesibilidad: WCAG 2.1 nivel AA, verificada con axe DevTools
- Metodología: Scrum

## Requisitos

- Un navegador actualizado
- El backend en ejecución (local o desplegado)
- Node.js 22 y npm, solo para correr las pruebas y los linters

## Instalación

### 1. Clonar

```bash
git clone https://github.com/AlejandroTriana-git/PGC_PROJECT-FE.git
cd PGC_PROJECT-FE
```

### 2. Apuntar al backend

La URL del API vive en un solo lugar, `js/config.js`. Para trabajar en local:

```js
const URL_API = "http://localhost:3000/api";
```

### 3. Abrir la aplicación

Abrir `index.html` con un servidor estático, por ejemplo la extensión Live Server de Visual Studio Code.

## Pruebas y calidad

```bash
npm install
npm test
npm run cobertura
npm run lint
```

| Comando | Qué hace |
| --- | --- |
| `npm test` | Ejecuta las pruebas unitarias |
| `npm run cobertura` | Pruebas más verificación de cobertura; falla si `js/` y `components/` bajan del 70 % |
| `npm run lint` | ESLint, HTMLHint y Stylelint |

Más detalle en `LEEME-pruebas.md`.

## Estructura del proyecto

```
PGC_PROJECT-FE/
├── index.html           inicio de sesión
├── *.html               una página por pantalla
├── components/          navbar, sidebar, footer, listaDocumento, pancartaFecha
├── css/                 estilos globales y por pantalla
├── js/
│   ├── config.js        URL base del API
│   ├── auth.js          sesión, token y contexto del profesor
│   ├── utils.js         peticiones al API, banners y utilidades
│   └── un script por pantalla
└── tests/               pruebas unitarias
```

## Pantallas por tipo de usuario

| Usuario | Pantallas |
| --- | --- |
| Visitante | Buscar PGC y ficha del proyecto, sin iniciar sesión |
| Estudiante | Inicio, Radicar propuesta, Mi propuesta, Propuestas aprobadas, Mi PGC, Buscar PGC, Lineamientos |
| Profesor | Inicio, Buscar PGC, Lineamientos |
| Encargado de ciclo | Aprobaciones, Lineamientos, Rúbricas, Configurar fechas, Buscar PGC |
| Jurado | Calificar, Calificados, Lineamientos, Rúbricas, Buscar PGC |
| Administrador | Ciclos, Usuarios, Buscar PGC, Lineamientos |

"Encargado de ciclo" y "Jurado" son capacidades de un Profesor; se eligen en el selector de la barra superior.

## Sesión

- El token JWT se guarda en `localStorage` con la clave `pgc_token`.
- Todas las llamadas al API pasan por `peticionApi` (`js/utils.js`), que agrega el encabezado `Authorization`.
- El menú lateral se arma en `components/sidebar.js` según el rol y el contexto activo.

## Flujo de trabajo

- `main` es la rama estable y `develop` la de integración.
- Cada tarea se trabaja en su propia rama y se une a `develop` mediante pull request.
- GitHub Actions ejecuta los linters y las pruebas con cobertura en cada push y pull request hacia `main` y `develop`.

## Equipo

Proyecto desarrollado bajo la metodología **Scrum** por:

- Kevin Esteban Peña Baron
- Jose Alejandro Triana Velasquez
- Joseph Camilo Quitora Orjuela
- Dioneiver Linares Fernandez

## Estado

Versión 1.0. Seis sprints completados.