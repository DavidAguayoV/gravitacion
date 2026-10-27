/*
 * app.js — Une el motor (fisica.js), los datos (mundos.js) y el dibujo (dibujo.js) con la página:
 * controles, arrastre de la flecha, bucle de animación y tiempo.
 */
(function () {
  'use strict';
  const { MUNDOS, SITUACIONES, fmt, crearSonda, avanzar, vEscape, energias, escalaEnergia, tipoEnergia } = Grav;
  const $ = (id) => document.getElementById(id);

  // Colores y patrones de línea de las sondas: se distinguen aunque no se vean los colores.
  const COLORES = ['#ece8df', '#eb4789', '#7fd18b', '#b79cff', '#f2955a'];
  const GUIONES = [[], [9, 5], [2, 4], [12, 4, 2, 4], [5, 3]];

  // ---------- Estado de la página ----------
  const estado = {
    mundo: { ...MUNDOS.tierra },
    lanz: { h: 400e3, v: 7000, angulo: 0, m: 100 }, // m: masa de la sonda (kg)
    sondas: [],
    elegida: -1,         // índice de la sonda que muestran el panel y el reloj
    corriendo: true,
    mult: 100,           // segundos simulados por segundo real
    autoVista: true,     // la vista se aleja sola si la sonda sale del cuadro
    varias: false,       // true = cada lanzamiento agrega una sonda
    creadas: 0,
    ver: { fuerza: true, velocidad: true, circulo: false, regla: true },
    reto: false,
  };

  const dibujo = new Grav.Dibujo($('lienzo'));

  // ---------- Deslizadores: posición 0…1000 ↔ valor físico ----------
  // Masa y radio abarcan muchas potencias de diez: el deslizador es logarítmico.
  const LOG_M = [10, 28];   // de 10¹⁰ kg a 10²⁸ kg
  const LOG_R = [2, 8];     // de 100 m a 10⁸ m
  const log = (x, [a, b]) => ((Math.log10(x) - a) / (b - a)) * 1000;
  const exp = (u, [a, b]) => 10 ** (a + (u / 1000) * (b - a));

  // La altura se reparte de 0 a 5R con más resolución cerca de la superficie.
  const H_MAX = 5;
  const hDesde = (u) => (estado.mundo.R * H_MAX * (10 ** (3 * u / 1000) - 1)) / 999;
  const hHacia = (h) => (1000 / 3) * Math.log10(1 + (999 * h) / (estado.mundo.R * H_MAX));
  // La rapidez va de 0 a 2 veces la velocidad de escape desde la superficie (lineal).
  const vMax = () => 2 * vEscape(estado.mundo.M, estado.mundo.R);

  // Unidades del campo según el tamaño del mundo: Bennu y Deimos se miden en m y m/s.
  const unidadL = () => (estado.mundo.R >= 1e5 ? 1000 : 1);
  const unidadV = () => (vEscape(estado.mundo.M, estado.mundo.R) >= 1000 ? 1000 : 1);

  /** Copia el estado a todos los controles (deslizadores y campos). */
  function mostrarControles() {
    const { mundo, lanz } = estado;
    $('rangoM').value = log(mundo.M, LOG_M);
    $('rangoR').value = log(mundo.R, LOG_R);
    $('campoM').value = fmt.numero(mundo.M, 3);
    $('campoR').value = fmt.numero(mundo.R / 1000, 3);
    $('rangoH').value = hHacia(lanz.h);
    $('rangoV').value = (lanz.v / vMax()) * 1000;
    $('rangoA').value = lanz.angulo;
    const uL = unidadL(), uV = unidadV();
    $('uH').textContent = uL === 1000 ? 'km' : 'm';
    $('uV').textContent = uV === 1000 ? 'km/s' : 'm/s';
    $('campoH').value = fmt.numero(lanz.h / uL, 3);
    $('campoV').value = fmt.numero(lanz.v / uV, 3);
    $('campoA').value = fmt.decimal(lanz.angulo, 3);
    $('campoMs').value = fmt.numero(lanz.m, 3);
    $('nombreMundo').textContent = mundo.nombre;
    document.querySelectorAll('#mundos button').forEach((b) =>
      b.setAttribute('aria-pressed', String(MUNDOS[b.dataset.clave].nombre === mundo.nombre)));
    document.querySelectorAll('.campo.malo').forEach((c) => c.classList.remove('malo'));
  }

  /** Conecta un deslizador y su campo numérico con una propiedad del estado. */
  function enlazar(rango, campo, alMover, alEscribir) {
    $(rango).addEventListener('input', (e) => {
      alMover(Number(e.target.value));
      mostrarControles();
    });
    $(campo).addEventListener('change', (e) => {
      const x = fmt.leer(e.target.value);
      if (!isFinite(x) || !alEscribir(x)) {
        e.target.parentElement.classList.add('malo');
        return;
      }
      mostrarControles();
    });
  }

  /** Cambia el mundo. Las sondas en vuelo sienten el nuevo campo de inmediato. */
  function cambiarMundo(cambios) {
    Object.assign(estado.mundo, cambios);
    estado.lanz.h = Math.min(estado.lanz.h, H_MAX * estado.mundo.R);
    // Con otro mundo cambia la profundidad del pozo: se rehace la escala de las barras.
    for (const s of estado.sondas) s.escalaE = escalaEnergia(s, estado.mundo);
    // Si el mundo quedó muy grande o muy chico para la vista, se vuelve a encuadrar.
    const rp = estado.mundo.R * dibujo.escala;
    const lado = Math.min(dibujo.w, dibujo.h);
    if (rp > 0.42 * lado || rp < 0.03 * lado) encuadrar();
  }

  enlazar('rangoM', 'campoM',
    (u) => cambiarMundo({ M: exp(u, LOG_M), nombre: 'Mundo propio' }),
    (x) => x > 0 && (cambiarMundo({ M: x, nombre: 'Mundo propio' }), true));
  enlazar('rangoR', 'campoR',
    (u) => cambiarMundo({ R: exp(u, LOG_R), nombre: 'Mundo propio' }),
    (x) => x > 0 && (cambiarMundo({ R: x * 1000, nombre: 'Mundo propio' }), true));
  enlazar('rangoH', 'campoH',
    (u) => (estado.lanz.h = hDesde(u)),
    (x) => x >= 0 && ((estado.lanz.h = x * unidadL()), true));
  enlazar('rangoV', 'campoV',
    (u) => (estado.lanz.v = (u / 1000) * vMax()),
    (x) => x >= 0 && ((estado.lanz.v = x * unidadV()), true));
  enlazar('rangoA', 'campoA',
    (u) => (estado.lanz.angulo = u),
    (x) => x >= -180 && x <= 180 && ((estado.lanz.angulo = x), true));
  $('campoMs').addEventListener('change', (e) => {
    const x = fmt.leer(e.target.value);
    if (x > 0) { estado.lanz.m = x; mostrarControles(); }
    else e.target.parentElement.classList.add('malo');
  });

  // ---------- Sondas ----------

  function lanzar() {
    const { mundo, lanz } = estado;
    if (!estado.varias) estado.sondas = [];
    marcarSituacion(null);
    if (estado.sondas.length >= COLORES.length) estado.sondas.shift(); // máximo 5 a la vez
    const s = crearSonda(mundo, lanz.h, lanz.v, lanz.angulo, lanz.m);
    const k = estado.creadas++ % COLORES.length;
    s.color = COLORES[k];
    s.guiones = GUIONES[k];
    s.escalaE = escalaEnergia(s, mundo);
    estado.sondas.push(s);
    estado.elegida = estado.sondas.length - 1;
    estado.autoVista = true;
    ponerPlay(true);
  }

  /** Vuelve a lanzar cada sonda desde su punto de partida. */
  function reiniciar() {
    estado.sondas = estado.sondas.map((s) => {
      const L = s.lanzamiento;
      const n = crearSonda(estado.mundo, L.h, L.v, L.angulo, L.m);
      n.color = s.color;
      n.guiones = s.guiones;
      n.escalaE = escalaEnergia(n, estado.mundo);
      return n;
    });
    estado.autoVista = true;
    ponerPlay(true);
  }

  function borrarEstelas() {
    for (const s of estado.sondas) s.estela = [s.x, s.y];
  }

  // ---------- Vista ----------

  /** Encuadra el mundo y el punto de partida, con aire alrededor. */
  function encuadrar() {
    const { mundo, lanz } = estado;
    let radio = 1.5 * (mundo.R + lanz.h);
    for (const s of estado.sondas) radio = Math.max(radio, 1.1 * Math.hypot(s.x, s.y));
    dibujo.encuadrar(radio);
  }

  function zoom(factor) {
    dibujo.escala *= factor;
    estado.autoVista = false;
  }

  // ---------- Escalas de las flechas ----------
  // vRef es una rapidez redonda cerca de 1,3 v_e: una flecha de largo Lref la representa.

  function redondo(x) {
    const p = 10 ** Math.floor(Math.log10(x));
    const m = x / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }

  function escalas() {
    const { M, R } = estado.mundo;
    const Lref = 0.3 * Math.min(dibujo.w, dibujo.h);
    const vRef = redondo(1.3 * vEscape(M, R));
    // La fuerza en la superficie, GMm/R², mide 0,45 Lref.
    const fRef = (Grav.G * M * estado.lanz.m) / (R * R);
    return { Lref, vRef, vPx: Lref / vRef, fPx: (0.45 * Lref) / fRef };
  }

  // ---------- Arrastre de la flecha y gestos ----------

  const lienzo = $('lienzo');
  const punteros = new Map(); // pointerId → [x, y]
  let arrastre = null;        // datos del arrastre de la flecha en curso
  let pellizco = null;        // distancia inicial entre dos dedos

  function posPuntero(e) {
    const c = lienzo.getBoundingClientRect();
    return [e.clientX - c.left, e.clientY - c.top];
  }

  function puntoPartida() {
    return dibujo.aPx(0, estado.mundo.R + estado.lanz.h);
  }

  /** ¿El puntero está sobre el asa (punta de la flecha) o sobre el punto de partida? */
  function sobreAsa(p, tactil) {
    const { vPx } = escalas();
    const [x0, y0] = puntoPartida();
    const rad = (estado.lanz.angulo * Math.PI) / 180;
    const x1 = x0 + estado.lanz.v * vPx * Math.cos(rad);
    const y1 = y0 - estado.lanz.v * vPx * Math.sin(rad);
    const radio = tactil ? 34 : 22;
    return Math.hypot(p[0] - x1, p[1] - y1) < radio || Math.hypot(p[0] - x0, p[1] - y0) < radio;
  }

  /** La flecha arrastrada fija la rapidez (su largo) y el ángulo (su dirección). */
  function moverFlecha(p) {
    const { vPx } = escalas();
    const [x0, y0] = puntoPartida();
    const dx = p[0] - x0, dy = y0 - p[1];
    estado.lanz.v = Math.hypot(dx, dy) / vPx;
    if (estado.lanz.v > 0) estado.lanz.angulo = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
    mostrarControles();
  }

  lienzo.addEventListener('pointerdown', (e) => {
    const p = posPuntero(e);
    punteros.set(e.pointerId, p);
    lienzo.setPointerCapture(e.pointerId);
    if (punteros.size === 2) {
      // Dos dedos: pellizco para acercar o alejar (cancela el arrastre)
      arrastre = null;
      const [a, b] = [...punteros.values()];
      pellizco = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), escala: dibujo.escala };
      return;
    }
    if (sobreAsa(p, e.pointerType === 'touch')) {
      arrastre = { moved: false };
      lienzo.classList.add('arrastrando');
    }
  });

  lienzo.addEventListener('pointermove', (e) => {
    const p = posPuntero(e);
    if (punteros.has(e.pointerId)) punteros.set(e.pointerId, p);
    if (pellizco && punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      dibujo.escala = pellizco.escala * (Math.hypot(a[0] - b[0], a[1] - b[1]) / pellizco.d);
      estado.autoVista = false;
      return;
    }
    if (arrastre) {
      arrastre.moved = true;
      moverFlecha(p);
      return;
    }
    if (e.pointerType === 'mouse') lienzo.classList.toggle('sobre-asa', sobreAsa(p, false));
  });

  function soltar(e) {
    punteros.delete(e.pointerId);
    if (punteros.size < 2) pellizco = null;
    if (arrastre) {
      lienzo.classList.remove('arrastrando');
      // Soltar la flecha lanza la sonda (si de verdad se arrastró)
      if (arrastre.moved && estado.lanz.v > 0 && e.type === 'pointerup') lanzar();
      arrastre = null;
    }
  }
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);

  lienzo.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom(Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  // ---------- Botones ----------

  function ponerPlay(corre) {
    estado.corriendo = corre;
    $('play').textContent = corre ? '❚❚' : '▶';
    $('play').setAttribute('aria-label', corre ? 'Pausa' : 'Seguir');
  }

  $('lanzar').addEventListener('click', lanzar);
  $('play').addEventListener('click', () => ponerPlay(!estado.corriendo));
  $('reiniciar').addEventListener('click', reiniciar);
  $('borrar').addEventListener('click', borrarEstelas);
  $('acercar').addEventListener('click', () => zoom(1.4));
  $('alejar').addEventListener('click', () => zoom(1 / 1.4));
  $('encuadrar').addEventListener('click', () => { encuadrar(); estado.autoVista = true; });
  $('rapidezTiempo').addEventListener('change', (e) => (estado.mult = Number(e.target.value)));

  // Atajos de teclado (fuera de los campos de texto)
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); ponerPlay(!estado.corriendo); }
    else if (e.key === 'l' || e.key === 'L' || e.key === 'Enter') lanzar();
    else if (e.key === 'r' || e.key === 'R') reiniciar();
  });

  // ---------- Presets: mundos y situaciones ----------

  /** Rapidez del tiempo para que una vuelta de período T (s) dure unos 6 s en pantalla. */
  function elegirRapidez(T) {
    const k = Math.min(5, Math.max(0, Math.round(Math.log10(T / 6))));
    ponerRapidez(10 ** k);
  }

  function ponerRapidez(mult) {
    estado.mult = mult;
    $('rapidezTiempo').value = String(mult);
  }

  /** Período de una órbita circular de radio r: T = 2π √(r³/GM). */
  const periodo = (r) => 2 * Math.PI * Math.sqrt(r ** 3 / (Grav.G * estado.mundo.M));

  /** Pone un mundo con datos reales y deja lista una sonda para lanzar hacia arriba. */
  function elegirMundo(clave, conLanzamiento = true) {
    estado.mundo = { ...MUNDOS[clave] };
    estado.sondas = [];
    if (conLanzamiento) {
      const v = vEscape(estado.mundo.M, estado.mundo.R);
      estado.lanz.h = 0;
      estado.lanz.angulo = 90;
      estado.lanz.v = Number((0.8 * v).toPrecision(2)); // sube y vuelve a caer
    }
    elegirRapidez(periodo(estado.mundo.R));
    encuadrar();
    estado.autoVista = true;
    marcarSituacion(null);
    mostrarControles();
  }

  function marcarSituacion(clave) {
    document.querySelectorAll('#situaciones button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.clave === clave)));
  }

  /** Arma una situación: cambia de mundo si la situación lo pide y lanza sus sondas. */
  function usarSituacion(clave) {
    const sit = SITUACIONES[clave];
    if (sit.mundo) elegirMundo(sit.mundo, false);
    const { mundo } = estado;
    const lista = sit.sondas(mundo);
    const variasAntes = estado.varias;
    estado.sondas = [];
    estado.creadas = 0;
    estado.varias = true; // una situación puede traer varias sondas a la vez
    for (const L of lista) {
      Object.assign(estado.lanz, L);
      lanzar();
    }
    estado.varias = variasAntes || lista.length > 1;
    $('optVarias').checked = estado.varias;
    const r0 = mundo.R + estado.lanz.h;
    dibujo.encuadrar(sit.vista * r0);
    if (sit.mult) ponerRapidez(sit.mult);
    else elegirRapidez(periodo(r0));
    marcarSituacion(clave);
    mostrarControles();
  }

  for (const [clave, m] of Object.entries(MUNDOS)) {
    const b = document.createElement('button');
    b.textContent = m.nombre;
    b.dataset.clave = clave;
    b.addEventListener('click', () => elegirMundo(clave));
    $('mundos').appendChild(b);
  }
  for (const [clave, sit] of Object.entries(SITUACIONES)) {
    const b = document.createElement('button');
    b.textContent = sit.nombre;
    b.dataset.clave = clave;
    b.addEventListener('click', () => usarSituacion(clave));
    $('situaciones').appendChild(b);
  }

  // ---------- Opciones: varias sondas, modo reto y proyector ----------

  function ponerReto(si) {
    estado.reto = si;
    $('optReto').checked = si;
    document.documentElement.classList.toggle('reto', si);
  }

  function ponerProyector(si) {
    $('optProyector').checked = si;
    document.documentElement.classList.toggle('proyector', si);
    dibujo.leerColores();
    alCambiarTamano();
  }

  $('optVarias').addEventListener('change', (e) => (estado.varias = e.target.checked));
  $('optReto').addEventListener('change', (e) => ponerReto(e.target.checked));
  $('optProyector').addEventListener('change', (e) => ponerProyector(e.target.checked));

  /**
   * Logros del reto: la primera vez que una sonda completa una vuelta casi circular o escapa,
   * se anota con qué rapidez se lanzó. Así cada grupo puede informar lo que encontró.
   */
  function anotarLogros() {
    for (const s of estado.sondas) {
      if (s.anotada) continue;
      let que = null;
      if (s.circular === true) que = 'Órbita circular';
      else if (s.estado === 'escapo' || s.estado === 'lejos') que = 'Escapó';
      if (!que) continue;
      s.anotada = true;
      const L = s.lanzamiento;
      const li = document.createElement('li');
      li.innerHTML = `${que}: ${estado.mundo.nombre}, <i class="serif">h</i> = ${fmt.distancia(L.h, true)}, ` +
        `<i class="serif">v</i> = ${fmt.rapidez(L.v, true)}, ${fmt.decimal(L.angulo, 3)}°`;
      $('logros').appendChild(li);
    }
  }

  // ---------- Casillas de «Ver» ----------

  const CASILLAS = { verFuerza: 'fuerza', verVel: 'velocidad', verCirculo: 'circulo', verRegla: 'regla' };
  for (const [id, clave] of Object.entries(CASILLAS)) {
    $(id).checked = estado.ver[clave];
    $(id).addEventListener('change', (e) => (estado.ver[clave] = e.target.checked));
  }

  // ---------- Panel de datos ----------

  /**
   * Muestra r, h, v, F, v_circular y v_escape de la sonda elegida. Si no hay ninguna,
   * los del punto de partida con la rapidez de los controles.
   */
  function mostrarDatos() {
    const { mundo, lanz } = estado;
    let s = estado.sondas[estado.elegida];
    $('tituloDatos').textContent = s ? 'Sonda' : 'En el punto de partida';
    if (!s) s = crearSonda(mundo, lanz.h, lanz.v, lanz.angulo, lanz.m);
    const r = Math.hypot(s.x, s.y);
    const v = Math.hypot(s.vx, s.vy);
    const F = (Grav.G * mundo.M * s.m) / (r * r);
    $('dR').innerHTML = fmt.distancia(r, true);
    $('dH').innerHTML = fmt.distancia(Math.max(0, r - mundo.R), true);
    $('dV').innerHTML = fmt.rapidez(v, true);
    $('dF').innerHTML = fmt.numero(F, 3, true) + ' N';
    $('dVc').innerHTML = fmt.rapidez(Grav.vCircular(mundo.M, r), true);
    $('dVe').innerHTML = fmt.rapidez(vEscape(mundo.M, r), true);
    const { K, U, E } = energias(s, mundo.M);
    $('dK').innerHTML = fmt.numero(K, 3, true) + ' J';
    $('dU').innerHTML = fmt.numero(U, 3, true) + ' J';
    $('dE').innerHTML = fmt.numero(E, 3, true) + ' J';
    mostrarBarras(s, K, U, E);
  }

  const TIPO_E = { ligada: 'E < 0 · ligada', limite: 'E ≈ 0 · en el límite', libre: 'E > 0 · escapa' };

  /** Barras de K, U y E: hacia arriba si la energía es positiva, hacia abajo si es negativa. */
  function mostrarBarras(s, K, U, E) {
    const escala = s.escalaE || escalaEnergia(s, estado.mundo);
    const poner = (id, x) => {
      const el = $(id);
      const f = Math.min(1, Math.abs(x) / escala) * 50; // % del alto total (la mitad es el cero)
      el.style.height = f + '%';
      el.style.top = x >= 0 ? 50 - f + '%' : '50%';
    };
    poner('bK', K);
    poner('bU', U);
    poner('bE', E);
    const tipo = tipoEnergia(E, s, estado.mundo.M);
    const p = $('tipoE');
    p.textContent = TIPO_E[tipo];
    p.className = 'tipoE ' + tipo;
  }

  // ---------- Bucle de animación ----------

  const TEXTO_ESTADO = { vuelo: '', impacto: 'Impacto', escapo: 'Escapó', lejos: 'Escapó' };

  function mostrarEstado() {
    const s = estado.sondas[estado.elegida];
    const caja = $('estado');
    caja.className = 'estado';
    if (!s) { caja.textContent = ''; return; }
    let t = TEXTO_ESTADO[s.estado];
    if (s.estado === 'impacto') t += ' a ' + fmt.rapidez(s.vImpacto);
    if (s.estado === 'vuelo' && s.vueltas > 0) {
      t = s.circular ? 'Órbita circular' : 'En órbita';
      caja.classList.add('orbita');
    }
    if (s.estado === 'lejos') caja.classList.add('escapo');
    else if (s.estado) caja.classList.add(s.estado);
    caja.textContent = t;
    $('reloj').textContent = 't = ' + fmt.tiempo(s.t);
  }

  /** Si la sonda elegida se sale del cuadro, la vista se aleja de a poco. */
  function seguirSonda() {
    const s = estado.sondas[estado.elegida];
    if (!estado.autoVista || !s || s.estado === 'impacto' || s.estado === 'lejos') return;
    if (!dibujo.dentro(s.x, s.y, 30) && dibujo.radioVisible() < 60 * estado.mundo.R) {
      dibujo.escala /= 1.04;
    }
  }

  function dibujar() {
    const { ctx } = dibujo;
    ctx.clearRect(0, 0, dibujo.w, dibujo.h);
    const { mundo, ver } = estado;
    const esc = escalas();
    const elegida = estado.sondas[estado.elegida];
    dibujo.mundo(mundo, estado.lanz.h);
    if (ver.circulo && elegida) dibujo.circulo(Math.hypot(elegida.x, elegida.y));
    for (const s of estado.sondas) dibujo.estela(s, s.color, s.guiones);
    estado.sondas.forEach((s, i) => dibujo.sonda(s, s.color, i === estado.elegida && estado.sondas.length > 1));
    for (const s of estado.sondas) dibujo.vectores(s, mundo.M, ver, esc.vPx, esc.fPx);
    dibujo.lanzador(mundo, estado.lanz, esc.vPx);
    if (ver.regla) dibujo.regla(mundo, elegida, dibujo.w < 560 ? 70 : 24);
  }

  let antes = performance.now();
  let ultimoPanel = 0;
  function cuadro(ahora) {
    const dtReal = Math.min(0.05, (ahora - antes) / 1000); // si la pestaña se durmió, no salta
    antes = ahora;
    if (estado.corriendo) {
      for (const s of estado.sondas) avanzar(s, estado.mundo, dtReal * estado.mult);
    }
    seguirSonda();
    dibujar();
    mostrarEstado();
    anotarLogros();
    // El panel se actualiza unas 10 veces por segundo: los números no alcanzan a leerse más rápido.
    if (ahora - ultimoPanel > 100) { mostrarDatos(); ultimoPanel = ahora; }
    requestAnimationFrame(cuadro);
  }

  // ---------- Inicio ----------

  function alCambiarTamano() {
    const r = dibujo.w ? dibujo.radioVisible() : 0;
    dibujo.ajustar();
    if (r) dibujo.encuadrar(r);
    else encuadrar();
  }
  window.addEventListener('resize', alCambiarTamano);

  // Opciones desde la dirección: ?reto=1&proyector=1&mundo=luna&situacion=canon
  const q = new URLSearchParams(location.search);
  const si = (k) => ['1', 'si', 'sí', 'true'].includes((q.get(k) || '').toLowerCase());
  alCambiarTamano();
  ponerReto(si('reto'));
  if (si('proyector')) ponerProyector(true);
  if (q.get('varias')) { estado.varias = si('varias'); $('optVarias').checked = estado.varias; }
  const mundoQ = (q.get('mundo') || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); // «Júpiter» → «jupiter»
  if (MUNDOS[mundoQ]) elegirMundo(mundoQ);
  else ponerRapidez(estado.mult);
  if (SITUACIONES[q.get('situacion')]) usarSituacion(q.get('situacion'));
  mostrarControles();
  requestAnimationFrame(cuadro);

  // Acceso para depurar desde la consola del navegador
  window.gravitacion = { estado, dibujo, lanzar, reiniciar, encuadrar, usarSituacion, elegirMundo, ponerReto };
})();
