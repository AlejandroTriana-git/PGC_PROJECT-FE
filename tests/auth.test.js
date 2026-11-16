const { cargarBase, crearToken, iniciarSesionDePrueba, simularApi, ok, estado, falloDeRed, simularUbicacion } = require("./helpers/entorno");

beforeAll(() => cargarBase());

let ubicacion;
beforeEach(() => {
  localStorage.clear();
  ubicacion = simularUbicacion();
});

describe("token y contexto en localStorage", () => {
  test("guardar / obtener / eliminar token", () => {
    expect(obtenerToken()).toBeNull();
    guardarToken("abc");
    expect(obtenerToken()).toBe("abc");
    eliminarToken();
    expect(obtenerToken()).toBeNull();
  });

  test("el contexto activo es 'profesor' por defecto y se puede cambiar", () => {
    expect(obtenerContextoActivo()).toBe("profesor");
    establecerContextoActivo("jurado");
    expect(obtenerContextoActivo()).toBe("jurado");
  });

  test("eliminarToken también borra el contexto activo", () => {
    guardarToken("abc");
    establecerContextoActivo("encargado");
    eliminarToken();
    expect(obtenerContextoActivo()).toBe("profesor");
  });
});

describe("estaAutenticado", () => {
  test("false sin token", () => {
    expect(estaAutenticado()).toBe(false);
  });
  test("false con un token ilegible", () => {
    guardarToken("no-es-jwt");
    expect(estaAutenticado()).toBe(false);
  });
  test("false si el token no trae exp", () => {
    guardarToken(crearToken({ exp: undefined }));
    expect(estaAutenticado()).toBe(false);
  });
  test("false si el token ya venció", () => {
    guardarToken(crearToken({ exp: Math.floor(Date.now() / 1000) - 10 }));
    expect(estaAutenticado()).toBe(false);
  });
  test("true con un token vigente", () => {
    guardarToken(crearToken());
    expect(estaAutenticado()).toBe(true);
  });
});

describe("obtenerUsuario", () => {
  test("null sin sesión o con token ilegible", () => {
    expect(obtenerUsuario()).toBeNull();
    guardarToken("basura");
    expect(obtenerUsuario()).toBeNull();
  });

  test.each([
    ["Estudiante", "estudiante"],
    ["Profesor", "profesor"],
    ["Administrador", "administrador"],
  ])("traduce el rol %s a %s", (rolBackend, esperado) => {
    guardarToken(crearToken({ rol: rolBackend }));
    expect(obtenerUsuario().rol).toBe(esperado);
  });

  test("un rol desconocido se pasa a minúsculas", () => {
    guardarToken(crearToken({ rol: "Coordinador" }));
    expect(obtenerUsuario().rol).toBe("coordinador");
  });

  test("encargado_de y jurado_de quedan como arreglos vacíos si no vienen", () => {
    guardarToken(crearToken({ rol: "Profesor" }));
    const usuario = obtenerUsuario();
    expect(usuario.encargado_de).toEqual([]);
    expect(usuario.jurado_de).toEqual([]);
  });

  test("conserva encargado_de y jurado_de del backend", () => {
    guardarToken(crearToken({ rol: "Profesor", encargado_de: [1], jurado_de: [2, 3] }));
    const usuario = obtenerUsuario();
    expect(usuario.encargado_de).toEqual([1]);
    expect(usuario.jurado_de).toEqual([2, 3]);
  });
});

describe("iniciarSesion", () => {
  test("pide completar los campos si falta alguno (sin llamar a la API)", async () => {
    const fetchMock = simularApi();
    const r = await iniciarSesion("", "x");
    expect(r).toEqual({ ok: false, mensaje: "Debe completar todos los campos.", campos: ["f-correo", "f-clave"] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("login correcto: guarda el token y devuelve los datos", async () => {
    const fetchMock = simularApi({ "POST /auth/login": ok({ token: "TKN" }) });
    const r = await iniciarSesion("a@b.co", "clave");
    expect(r.ok).toBe(true);
    expect(obtenerToken()).toBe("TKN");
    const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(cuerpo).toEqual({ correo: "a@b.co", contrasena: "clave" });
  });

  test.each([
    [400, { mensaje: "Datos inválidos" }, "Datos inválidos", ["f-correo", "f-clave"]],
    [400, {}, "Debe completar todos los campos.", ["f-correo", "f-clave"]],
    [404, {}, "Correo electrónico no registrado.", ["f-correo"]],
    [404, { mensaje: "No existe" }, "No existe", ["f-correo"]],
    [401, {}, "Contraseña incorrecta.", ["f-clave"]],
    [401, { mensaje: "Clave mala" }, "Clave mala", ["f-clave"]],
    [500, {}, "No fue posible iniciar sesión.", []],
    [500, { mensaje: "Caído" }, "Caído", []],
  ])("estado %i → mensaje y campos correctos", async (status, body, mensaje, campos) => {
    simularApi({ "POST /auth/login": estado(status, body) });
    const r = await iniciarSesion("a@b.co", "clave");
    expect(r).toEqual({ ok: false, mensaje, campos });
    expect(obtenerToken()).toBeNull();
  });

  test("si el servidor no responde JSON igual da un mensaje claro", async () => {
    simularApi({ "POST /auth/login": { status: 401, body: undefined } });
    const r = await iniciarSesion("a@b.co", "clave");
    expect(r.mensaje).toBe("Contraseña incorrecta.");
  });

  test("si no hay conexión avisa que no se pudo conectar", async () => {
    simularApi({ "POST /auth/login": falloDeRed() });
    const r = await iniciarSesion("a@b.co", "clave");
    expect(r).toEqual({ ok: false, mensaje: "No fue posible conectar con el servidor.", campos: [] });
  });
});

describe("cerrarSesion", () => {
  test("limpia la sesión y va al login", () => {
    guardarToken("abc");
    cerrarSesion();
    expect(obtenerToken()).toBeNull();
    expect(ubicacion.href).toBe("index.html");
  });
  test("con mensaje lo manda codificado en la URL", () => {
    cerrarSesion("Sesión expirada.");
    expect(ubicacion.href).toBe(`index.html?msg=${encodeURIComponent("Sesión expirada.")}`);
  });
});

describe("cerrarSesionUsuario", () => {
  test("avisa al servidor y luego cierra la sesión local", async () => {
    guardarToken("TKN");
    const fetchMock = simularApi({ "POST /auth/logout": ok() });
    await cerrarSesionUsuario();
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe(`${URL_API}/auth/logout`);
    expect(opciones.headers.Authorization).toBe("Bearer TKN");
    expect(obtenerToken()).toBeNull();
    expect(ubicacion.href).toBe("index.html");
  });

  test("si el servidor falla, igual cierra la sesión local", async () => {
    guardarToken("TKN");
    simularApi({ "POST /auth/logout": falloDeRed() });
    await cerrarSesionUsuario();
    expect(obtenerToken()).toBeNull();
    expect(ubicacion.href).toBe("index.html");
  });

  test("sin token no llama al servidor", async () => {
    const fetchMock = simularApi();
    await cerrarSesionUsuario();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ubicacion.href).toBe("index.html");
  });
});

describe("rutas protegidas", () => {
  test("requerirAutenticacion manda al login si no hay sesión", () => {
    requerirAutenticacion();
    expect(ubicacion.href).toContain("index.html?msg=");
  });

  test("requerirAutenticacion no hace nada con sesión vigente", () => {
    iniciarSesionDePrueba();
    requerirAutenticacion();
    expect(ubicacion.href).toBe("http://localhost/");
  });

  test("requerirCapacidad deja pasar a un profesor con esa capacidad", () => {
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [1] });
    requerirCapacidad("encargado");
    expect(ubicacion.href).toBe("http://localhost/");
  });

  test("requerirCapacidad devuelve al dashboard si no la tiene", () => {
    iniciarSesionDePrueba({ rol: "Profesor", encargado_de: [] });
    requerirCapacidad("encargado");
    expect(ubicacion.href).toBe("dashboard.html");
  });

  test("requerirRol acepta un rol o una lista de roles", () => {
    iniciarSesionDePrueba({ rol: "Administrador" });
    requerirRol("administrador");
    requerirRol(["profesor", "administrador"]);
    expect(ubicacion.href).toBe("http://localhost/");
  });

  test("requerirRol devuelve al dashboard si el rol no coincide", () => {
    iniciarSesionDePrueba({ rol: "Estudiante" });
    requerirRol("administrador");
    expect(ubicacion.href).toBe("dashboard.html");
  });
});
