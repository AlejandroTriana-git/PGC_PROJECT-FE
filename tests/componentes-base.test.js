// footer.js + navbar.js
const { cargarBase, cargar, iniciarSesionDePrueba, simularUbicacion } = require("./helpers/entorno");

beforeAll(() => {
  cargarBase();
  cargar("components/footer.js", "components/navbar.js");
});

let ubicacion;
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  ubicacion = simularUbicacion();
});

describe("renderizarPiePagina", () => {
  test("pinta el pie institucional en el contenedor", () => {
    document.body.innerHTML = '<div id="footer"></div>';
    renderizarPiePagina("footer");
    const texto = document.getElementById("footer").textContent;
    expect(texto).toContain("www.ucundinamarca.edu.co");
    expect(texto).toContain("Vigilada MinEducación");
    expect(document.querySelector("#footer a").getAttribute("target")).toBe("_blank");
  });
  test("no falla si el contenedor no existe", () => {
    expect(() => renderizarPiePagina("no-existe")).not.toThrow();
  });
});

describe("renderizarBarraSuperior", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="topbar"></div><main></main>';
  });

  test("no falla si el contenedor no existe", () => {
    expect(() => renderizarBarraSuperior("fantasma")).not.toThrow();
  });

  test("sin sesión muestra el botón 'Iniciar sesión'", () => {
    renderizarBarraSuperior("topbar");
    const enlace = document.querySelector("#topbar .btn-ingresar");
    expect(enlace.getAttribute("href")).toBe("index.html");
    expect(document.querySelector("#topbar .btn-salir")).toBeNull();
  });

  test("prepara el <main> para el enlace 'Saltar al contenido'", () => {
    renderizarBarraSuperior("topbar");
    const principal = document.querySelector("main");
    expect(principal.id).toBe("contenido-principal");
    expect(principal.getAttribute("tabindex")).toBe("-1");
  });

  test("estudiante: nombre (escapado) y chip fijo 'Estudiante'", () => {
    iniciarSesionDePrueba({ nombre: "<b>Ana</b>", rol: "Estudiante" });
    renderizarBarraSuperior("topbar");
    const caja = document.querySelector("#topbar .usuario-box");
    expect(caja.querySelector("b")).toBeNull();
    expect(caja.textContent).toContain("<b>Ana</b>");
    expect(caja.querySelector(".role-chip").textContent).toContain("Estudiante");
    expect(caja.querySelector(".btn-salir")).not.toBeNull();
  });

  test("si no hay nombre usa el correo y luego 'Usuario'", () => {
    iniciarSesionDePrueba({ nombre: undefined, correo: "ana@udec.edu.co", rol: "Estudiante" });
    renderizarBarraSuperior("topbar");
    expect(document.querySelector("#topbar .usuario-box span").textContent).toBe("ana@udec.edu.co");

    iniciarSesionDePrueba({ nombre: undefined, correo: undefined, rol: "Estudiante" });
    renderizarBarraSuperior("topbar");
    expect(document.querySelector("#topbar .usuario-box span").textContent).toBe("Usuario");
  });

  test("administrador: chip 'Administrador'", () => {
    iniciarSesionDePrueba({ rol: "Administrador" });
    renderizarBarraSuperior("topbar");
    expect(document.querySelector("#topbar .role-chip").textContent).toContain("Administrador");
  });

  test("un rol sin etiqueta base muestra el rol tal cual", () => {
    iniciarSesionDePrueba({ rol: "Coordinador" });
    renderizarBarraSuperior("topbar");
    expect(document.querySelector("#topbar .role-chip").textContent).toContain("coordinador");
  });

  test("un token vencido no se pinta como sesión", () => {
    iniciarSesionDePrueba({ exp: Math.floor(Date.now() / 1000) - 60 });
    renderizarBarraSuperior("topbar");
    expect(document.querySelector("#topbar .btn-ingresar")).not.toBeNull();
  });

  test("profesor sin capacidades extra: chip deshabilitado", () => {
    iniciarSesionDePrueba({ rol: "Profesor" });
    renderizarBarraSuperior("topbar");
    expect(document.querySelector("#topbar .role-chip-deshabilitado").textContent).toContain("Profesor");
    expect(document.querySelector("#topbar details")).toBeNull();
  });

  test("profesor con capacidades: menú con un contexto por capacidad y el activo marcado", () => {
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [1], jurado_de: [2] });
    establecerContextoActivo("jurado");
    renderizarBarraSuperior("topbar");
    const opciones = document.querySelectorAll("#topbar .opcion-contexto");
    expect([...opciones].map((o) => o.textContent.trim())).toEqual(["Profesor", "Encargado de Ciclo", "Jurado"]);
    expect(document.querySelector("#topbar .opcion-contexto.activa").textContent.trim()).toBe("Jurado");
    expect(document.querySelector("#topbar summary").textContent).toContain("Jurado");
  });

  test("si el contexto guardado ya no está disponible vuelve a 'Profesor'", () => {
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [1], jurado_de: [] });
    establecerContextoActivo("jurado");
    renderizarBarraSuperior("topbar");
    expect(document.querySelector("#topbar .opcion-contexto.activa").textContent.trim()).toBe("Profesor");
  });
});

describe("cambiarContexto", () => {
  test.each([
    ["profesor", "dashboard.html"],
    ["encargado", "aprobaciones.html"],
    ["jurado", "calificar.html"],
  ])("%s guarda el contexto y navega a %s", (contexto, destino) => {
    cambiarContexto(contexto);
    expect(obtenerContextoActivo()).toBe(contexto);
    expect(ubicacion.href).toBe(destino);
  });
});
