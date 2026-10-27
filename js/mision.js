/*
 * mision.js — Las misiones para el celular: un mundo, tres retos y una sola perilla (la rapidez).
 *
 * Cada reto fija desde dónde y hacia dónde se lanza, dibuja una meta y, cuando la sonda
 * termina (choca, escapa, llega arriba o da una vuelta), dice qué pasó y si se logró.
 * Usa el mismo motor (fisica.js) y el mismo dibujo (dibujo.js) que la página principal.
 */
(function () {
  'use strict';
  const { MUNDOS, fmt, crearSonda, avanzar, vEscape, vCircular } = Grav;
  const $ = (id) => document.getElementById(id);
  const km = (m) => fmt.distancia(m);

  // ---------- Cómo se juzga cada lanzamiento ----------
  // Cada juez recibe la sonda y devuelve null mientras no se sabe, o { ok, texto }.

  /** Escapar con lo justo: a lo más un 3 % sobre la velocidad de escape del punto de partida. */
  function juezEscape(s, mundo) {
    const ve = vEscape(mundo.M, s.r0);
    const hMax = s.rMax - mundo.R;
    if (s.estado === 'escapo' || s.estado === 'lejos') {
      return s.lanzamiento.v <= 1.03 * ve
        ? { ok: true, texto: '¡Escapó con lo justo!' }
        : { ok: false, texto: 'Escapó, pero le sobró rapidez. ¿Pueden con menos?' };
    }
    if (s.apice) return { ok: false, texto: `No escapa: llegó hasta ${km(hMax)} de altura y vuelve. Le falta rapidez.` };
    if (s.estado === 'impacto') return { ok: false, texto: `Cayó a ${km(mundo.R * Math.abs(s.barrido))} de la partida. Le falta rapidez.` };
    if (s.vueltas >= 1) return { ok: false, texto: `Quedó en órbita (llega hasta ${km(hMax)}): no escapa. Le falta rapidez.` };
    return null;
  }

  /** Llegar justo a la altura H (±5 %). Se decide en lo más alto, sin esperar que caiga. */
  function juezAltura(H) {
    return (s, mundo) => {
      const hMax = s.rMax - mundo.R;
      if (s.estado === 'escapo' || s.estado === 'lejos') return { ok: false, texto: '¡Se fue! Escapó: demasiada rapidez.' };
      // Pasado el doble de la marca ya no hay duda: no se espera a que llegue arriba (puede tardar mucho)
      if (hMax > 2 * H && !s.apice) {
        const r = Math.hypot(s.x, s.y);
        const e = 0.5 * (s.vx * s.vx + s.vy * s.vy) - (Grav.G * mundo.M) / r; // energía por kilo
        return e >= 0
          ? { ok: false, texto: '¡Se fue! Con esa rapidez escapa: no vuelve nunca.' }
          : { ok: false, texto: `Se pasó: ya subió ${km(hMax)}, más del doble de la marca.` };
      }
      if (!s.apice && s.estado !== 'impacto') return null;
      const d = hMax - H;
      if (Math.abs(d) <= 0.05 * H) return { ok: true, texto: `¡En la marca! Subió ${km(hMax)}.` };
      return { ok: false, texto: d < 0 ? `Subió ${km(hMax)}: le faltaron ${km(-d)}.` : `Subió ${km(hMax)}: se pasó por ${km(d)}.` };
    };
  }

  /** Cañón: que la bala caiga lejos, a más de D medidos sobre la superficie. */
  function juezLejos(D) {
    return (s, mundo) => {
      if (s.estado === 'escapo' || s.estado === 'lejos') return { ok: false, texto: 'Escapó: demasiada rapidez.' };
      if (s.vueltas >= 1) return { ok: false, texto: 'No cayó: dio la vuelta entera. ¡Quedó en órbita! Un poco menos.' };
      if (s.estado !== 'impacto') return null;
      const d = mundo.R * Math.abs(s.barrido);
      return d >= D
        ? { ok: true, texto: `¡Cayó a ${km(d)} de la montaña!` }
        : { ok: false, texto: `Cayó a ${km(d)} de la montaña. Más lejos.` };
    };
  }

  /** Órbita circular: tras la primera vuelta, r cambió menos de un 1 %. */
  function juezCircular(s, mundo) {
    if (s.estado === 'escapo' || s.estado === 'lejos') return { ok: false, texto: 'Escapó: demasiada rapidez.' };
    if (s.estado === 'impacto') return { ok: false, texto: 'Cayó: le falta rapidez.' };
    if (s.vueltas < 1) return null;
    if (s.circular) return { ok: true, texto: '¡Órbita circular! La altura casi no cambió.' };
    const [hMin, hMax] = [s.rMin - mundo.R, s.rMax - mundo.R];
    return s.rMax > 1.005 * s.r0
      ? { ok: false, texto: `Dio la vuelta, pero se alejó hasta ${km(hMax)}. Le sobra rapidez.` }
      : { ok: false, texto: `Dio la vuelta, pero bajó hasta ${km(hMin)}. Le falta rapidez.` };
  }

  // ---------- Las tres misiones ----------
  // Cada reto: corto (para el botón), texto, pista, h y angulo del lanzamiento,
  // meta (lo que se dibuja), juez y vista (qué parte del espacio se encuadra al empezar).

  const MISIONES = {
    escapar: {
      titulo: 'Escapar de Ceres',
      mundo: 'ceres',
      paso: 2,          // lo que suman los botones − y + (m/s)
      vInicial: 300,
      retos: [
        {
          corto: 'Arriba', h: 0, angulo: 90, juez: juezEscape,
          texto: 'Hagan que la sonda escape lanzándola hacia arriba, con la menor rapidez posible.',
          pista: 'Con la velocidad de escape, v = √(2GM/R), la energía total queda justo en cero.',
        },
        {
          corto: 'De lado', h: 0, angulo: 0, juez: juezEscape,
          texto: 'Ahora lancen en horizontal. ¿Necesita más rapidez, menos o la misma para escapar?',
          pista: 'La energía cinética, ½mv², no depende de la dirección de la velocidad.',
        },
        {
          corto: 'Desde R', h: 'R', angulo: 90, juez: juezEscape,
          texto: 'La sonda parte a 470 km de altura (h = R). Que escape con la menor rapidez posible.',
          pista: 'Desde más lejos, U = −GMm/r es menos negativa: en la fórmula, R pasa a ser 2R.',
        },
      ],
    },

    orbitar: {
      titulo: 'El cañón de Newton en la Luna',
      mundo: 'luna',
      paso: 10,
      vInicial: 1000,
      retos: [
        {
          corto: 'Lejos', h: 150e3, angulo: 0, juez: juezLejos(2000e3), meta: { tipo: 'arco', d: 2000e3 },
          texto: 'Disparen en horizontal desde una montaña de 150 km y hagan que la bala caiga a más de 2000 km.',
          pista: 'Mientras más rápido sale, más lejos cae: la Luna se curva bajo la bala.',
        },
        {
          corto: 'Órbita', h: 150e3, angulo: 0, juez: juezCircular, meta: { tipo: 'orbita' },
          texto: 'Que la bala dé la vuelta completa sin subir ni bajar: siempre sobre la línea punteada.',
          pista: 'Si al dar la vuelta se aleja, le sobra rapidez; si baja, le falta.',
        },
        {
          corto: 'Escapar', h: 150e3, angulo: 0, juez: juezEscape,
          texto: 'Ahora que escape, disparando en horizontal con la menor rapidez posible.',
          pista: 'v = √(2GM/r), con r = R + h. Compárenla con la rapidez de la órbita.',
        },
      ],
    },

    llegar: {
      titulo: 'Llegar a la marca en Marte',
      mundo: 'marte',
      paso: 10,
      vInicial: 400,
      retos: [
        {
          corto: '50 km', h: 0, angulo: 90, juez: juezAltura(50e3), meta: { tipo: 'altura', H: 50e3 },
          texto: 'Lancen hacia arriba y hagan que la sonda se detenga justo en la marca: 50 km de altura.',
          pista: 'Para una altura pequeña, g casi no cambia: ½mv² = mgh, con g = GM/R².',
        },
        {
          corto: '1130 km', h: 0, angulo: 90, juez: juezAltura(1130e3), meta: { tipo: 'altura', H: 1130e3 },
          texto: 'Ahora la marca está a 1130 km de altura (R/3). ¿Sirve otra vez mgh?',
          pista: 'Lejos de la superficie g disminuye. Usen U = −GMm/r: ½mv² − GMm/R = −GMm/(R + h).',
        },
        {
          corto: '3390 km', h: 0, angulo: 90, juez: juezAltura(3390e3), meta: { tipo: 'altura', H: 3390e3 },
          texto: 'Y ahora a 3390 km: h = R. Primero calculen con energía, después lancen.',
          pista: '¿Qué rapidez da mgh para esta altura? Pruébenla: es la velocidad de escape.',
        },
      ],
    },
  };

  // ---------- Estado ----------

  const q = new URLSearchParams(location.search);
  const clave = MISIONES[q.get('m')] ? q.get('m') : 'escapar';
  const mision = MISIONES[clave];
  const mundo = { ...MUNDOS[mision.mundo] };
  const unidadV = vEscape(mundo.M, mundo.R) >= 1000 ? 1000 : 1; // km/s o m/s, como en la página principal
  const vMax = 1.6 * vEscape(mundo.M, mundo.R);                  // tope del deslizador

  const estado = {
    n: 0,                // reto actual
    v: mision.vInicial,  // rapidez elegida (m/s)
    sonda: null,         // la del último lanzamiento
    viejas: [],          // estelas de los intentos anteriores, para comparar
    intentos: mision.retos.map(() => []),
    logrados: leerLogrados(),
    mult: 1,             // segundos simulados por segundo real
  };

  const dibujo = new Grav.Dibujo($('lienzo'));
  const reto = () => mision.retos[estado.n];
  const alturaPartida = (r) => (r.h === 'R' ? mundo.R : r.h);

  // El avance se guarda en el navegador para no perderlo si se recarga la página.
  function leerLogrados() {
    try { return JSON.parse(localStorage.getItem('gravitacion.mision.' + clave)) || []; } catch (e) { return []; }
  }
  function guardarLogrados() {
    try { localStorage.setItem('gravitacion.mision.' + clave, JSON.stringify(estado.logrados)); } catch (e) { /* sin almacenamiento */ }
  }

  // ---------- Retos ----------

  function mostrarRetos() {
    const nav = $('retos');
    nav.innerHTML = '';
    mision.retos.forEach((r, i) => {
      const b = document.createElement('button');
      b.className = 'm-boton-reto';
      b.setAttribute('aria-pressed', String(i === estado.n));
      if (estado.logrados.includes(i)) b.classList.add('logrado');
      b.innerHTML = `<span class="m-num">${estado.logrados.includes(i) ? '✓' : i + 1}</span> ${r.corto}`;
      b.addEventListener('click', () => elegirReto(i));
      nav.appendChild(b);
    });
    mostrarFinal();
  }

  // ---------- La misión final, que se abre al lograr los tres retos ----------

  const todosLogrados = () => estado.logrados.length === mision.retos.length;
  const urlFinal = () => 'artemis.html?desde=' + clave + (q.get('tema') ? '&tema=' + q.get('tema') : '');

  function mostrarFinal() {
    const actual = $('final');
    let nuevo;
    if (todosLogrados()) {
      nuevo = document.createElement('a');
      nuevo.href = urlFinal();
      nuevo.textContent = 'Se abrió la misión final: Artemis II →';
    } else {
      nuevo = document.createElement('p');
      nuevo.textContent = `🔒 Misión final: se abre al lograr los tres retos (${estado.logrados.length} de ${mision.retos.length}).`;
    }
    nuevo.id = 'final';
    nuevo.className = 'm-final';
    actual.replaceWith(nuevo);
  }

  function elegirReto(i) {
    estado.n = i;
    estado.sonda = null;
    estado.viejas = [];
    // Cada reto parte de la misma rapidez: si quedara la del reto anterior, el siguiente
    // (por ejemplo, escapar de lado) se resolvería sin darse cuenta.
    ponerRapidez(mision.vInicial);
    ocultarAviso();
    $('pista').hidden = true;
    $('botonPista').setAttribute('aria-expanded', 'false');
    $('textoReto').innerHTML = `<b>Reto ${i + 1}.</b> ${reto().texto}`;
    $('pista').textContent = reto().pista;
    $('direccion').textContent = reto().angulo === 90 ? '↑' : '→';
    elegirTiempo();
    vistaInicial();
    mostrarRetos();
    mostrarIntentos();
  }

  // ---------- Vista ----------

  /** Qué se encuadra al empezar un reto: el mundo entero o, para una marca, de la superficie a la marca. */
  function vistaInicial() {
    const r = reto();
    const h0 = alturaPartida(r);
    if (r.meta && r.meta.tipo === 'altura') {
      const H = r.meta.H;
      const abajo = mundo.R - 0.3 * H, arriba = mundo.R + 1.6 * H;
      dibujo.centro = [0, (abajo + arriba) / 2];
      dibujo.escala = (0.9 * dibujo.h) / (arriba - abajo);
    } else {
      dibujo.centro = [0, 0];
      dibujo.encuadrar(r.angulo === 90 ? 3 * (mundo.R + h0) : 1.3 * (mundo.R + h0));
    }
  }

  /** Si la sonda se sale del cuadro, la vista se aleja de a poco y vuelve a centrarse en el mundo. */
  function seguirSonda() {
    const s = estado.sonda;
    if (!s || s.estado === 'impacto' || s.estado === 'lejos') return;
    if (!dibujo.dentro(s.x, s.y, 0.1 * Math.min(dibujo.w, dibujo.h)) && dibujo.radioVisible() < 60 * mundo.R) {
      dibujo.escala /= 1.04;
      dibujo.centro = [dibujo.centro[0] * 0.95, dibujo.centro[1] * 0.95];
    }
  }

  // ---------- Tiempo ----------

  /**
   * El tiempo corre para que el lanzamiento «bueno» del reto dure unos 5 s reales: se simula
   * una vez aparte, sin dibujarlo, y se mide cuánto tarda.
   */
  function elegirTiempo() {
    const r = reto();
    const h0 = alturaPartida(r);
    const r0 = mundo.R + h0;
    const GM = Grav.G * mundo.M;
    const T = 2 * Math.PI * Math.sqrt(r0 ** 3 / GM); // período de una órbita circular a r0
    let v, fin;
    if (r.juez === juezEscape) { v = 1.02 * vEscape(mundo.M, r0); fin = (s) => s.estado !== 'vuelo'; }
    else if (r.meta && r.meta.tipo === 'altura') { v = vParaAltura(r.meta.H); fin = (s) => s.estado === 'impacto'; }
    else { estado.mult = T / 6; return; } // órbitas: una vuelta en unos 6 s
    const s = crearSonda(mundo, h0, v, r.angulo, 1);
    for (let i = 0; i < 4000 && !fin(s); i++) avanzar(s, mundo, T / 100);
    estado.mult = s.t / 5;
  }

  /** Rapidez para subir justo hasta H desde la superficie (por energía). */
  function vParaAltura(H) {
    const GM = Grav.G * mundo.M;
    return Math.sqrt(2 * GM * (1 / mundo.R - 1 / (mundo.R + H)));
  }

  /** Lejos del mundo el tiempo se acelera, para no esperar demasiado un viaje largo. */
  function multAhora(s) {
    const r = Math.hypot(s.x, s.y);
    return estado.mult * Math.max(1, r / (3 * s.r0)) ** 1.5;
  }

  // ---------- Rapidez: campo, botones, deslizador y flecha ----------

  function mostrarRapidez() {
    $('uV').textContent = unidadV === 1000 ? 'km/s' : 'm/s';
    $('campoV').value = fmt.decimal(estado.v / unidadV, 3);
    $('rangoV').value = (estado.v / vMax) * 1000;
    $('campoV').parentElement.classList.remove('malo');
  }

  function ponerRapidez(v) {
    estado.v = Math.min(vMax, Math.max(0, v));
    mostrarRapidez();
  }

  $('campoV').addEventListener('change', (e) => {
    const x = fmt.leer(e.target.value);
    if (isFinite(x) && x >= 0) ponerRapidez(x * unidadV);
    else e.target.parentElement.classList.add('malo');
  });
  $('rangoV').addEventListener('input', (e) => ponerRapidez((Number(e.target.value) / 1000) * vMax));
  $('menos').addEventListener('click', () => ponerRapidez(estado.v - mision.paso));
  $('mas').addEventListener('click', () => ponerRapidez(estado.v + mision.paso));

  /** Escala de la flecha de velocidad: el tope del deslizador mide un tercio del lienzo. */
  const escalas = () => {
    const Lref = 0.33 * Math.min(dibujo.w, dibujo.h);
    const fRef = (Grav.G * mundo.M) / (mundo.R * mundo.R); // fuerza en la superficie sobre 1 kg
    return { vPx: Lref / vMax, fPx: (0.4 * Lref) / fRef };
  };

  // Arrastrar la punta de la flecha cambia la rapidez (la dirección la fija el reto).
  const lienzo = $('lienzo');
  let arrastrando = false;
  const punto = (e) => { const c = lienzo.getBoundingClientRect(); return [e.clientX - c.left, e.clientY - c.top]; };
  const partida = () => dibujo.aPx(0, mundo.R + alturaPartida(reto()));
  function puntaFlecha() {
    const [x0, y0] = partida();
    const L = estado.v * escalas().vPx;
    return reto().angulo === 90 ? [x0, y0 - L] : [x0 + L, y0];
  }
  lienzo.addEventListener('pointerdown', (e) => {
    const p = punto(e), [x1, y1] = puntaFlecha();
    if (Math.hypot(p[0] - x1, p[1] - y1) < (e.pointerType === 'touch' ? 36 : 22)) {
      arrastrando = true;
      lienzo.setPointerCapture(e.pointerId);
    }
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    const p = punto(e), [x0, y0] = partida();
    const L = reto().angulo === 90 ? y0 - p[1] : p[0] - x0; // largo a lo largo de la dirección fija
    ponerRapidez(Math.max(0, L) / escalas().vPx);
  });
  const soltar = () => (arrastrando = false);
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);

  // ---------- Lanzar y juzgar ----------

  function lanzar() {
    const r = reto();
    if (estado.sonda) {
      estado.viejas.push(estado.sonda.estela);
      if (estado.viejas.length > 4) estado.viejas.shift();
    }
    estado.sonda = crearSonda(mundo, alturaPartida(r), estado.v, r.angulo, 1);
    estado.sonda.juzgada = false;
    ocultarAviso(true);
    vistaInicial();
    // En el celular el botón queda bajo el dibujo: se sube para ver el vuelo
    const escena = lienzo.getBoundingClientRect();
    if (escena.top < -0.25 * escena.height) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('lanzar').addEventListener('click', lanzar);

  function juzgar() {
    const s = estado.sonda;
    if (!s || s.juzgada) return;
    // Lo más alto del vuelo: la rapidez radial pasa de positiva (se aleja) a negativa (vuelve)
    const vr = s.x * s.vx + s.y * s.vy;
    if (vr > 0) s.subia = true;
    if (s.subia && !s.apice && s.estado === 'vuelo' && vr < 0) s.apice = true;
    const veredicto = reto().juez(s, mundo);
    if (!veredicto) return;
    s.juzgada = true;
    estado.intentos[estado.n].push({ v: s.lanzamiento.v, ...veredicto });
    mostrarIntentos();
    if (veredicto.ok && !estado.logrados.includes(estado.n)) {
      estado.logrados.push(estado.n);
      guardarLogrados();
      mostrarRetos();
    }
    mostrarAviso(veredicto);
  }

  function mostrarAviso({ ok, texto }) {
    const aviso = $('aviso');
    aviso.dataset.listo = 'si';
    aviso.className = 'm-aviso ' + (ok ? 'ok' : 'no');
    const todos = todosLogrados();
    $('textoAviso').textContent = ok && todos ? texto + ' Misión cumplida: anoten todo en la hoja.' : texto;
    const sig = mision.retos.findIndex((r, i) => !estado.logrados.includes(i) && i !== estado.n);
    $('siguiente').hidden = !(ok && (sig >= 0 || todos));
    $('siguiente').textContent = sig >= 0 ? 'Siguiente reto →' : 'Misión final →';
    $('siguiente').onclick = () => (sig >= 0 ? elegirReto(sig) : location.assign(urlFinal()));
  }

  /** Sin veredicto todavía: la franja dice qué hacer (o que la sonda va en camino). */
  function ocultarAviso(enVuelo = false) {
    const aviso = $('aviso');
    aviso.dataset.listo = '';
    aviso.className = 'm-aviso';
    $('textoAviso').textContent = enVuelo ? 'En vuelo…' : 'Elijan la rapidez y lancen.';
    $('siguiente').hidden = true;
  }

  /** Intentos del reto actual, el último arriba: lo que el grupo anota en la hoja. */
  function mostrarIntentos() {
    const lista = estado.intentos[estado.n];
    $('cuenta').textContent = lista.length ? `(${lista.length})` : '';
    $('intentos').innerHTML = lista.slice().reverse().map((x) =>
      `<li class="${x.ok ? 'ok' : ''}"><b>${fmt.rapidez(x.v)}</b> · ${x.texto}</li>`).join('');
  }

  $('botonPista').addEventListener('click', () => {
    const p = $('pista');
    p.hidden = !p.hidden;
    $('botonPista').setAttribute('aria-expanded', String(!p.hidden));
  });

  // ---------- Dibujo ----------

  /** La meta del reto: la marca de altura, la órbita a seguir o la distancia que hay que pasar. */
  function dibujarMeta() {
    const r = reto();
    const { ctx, c } = dibujo;
    const logrado = estado.logrados.includes(estado.n);
    const color = logrado ? c.tinta : c.acento;
    const [cx, cy] = dibujo.aPx(0, 0);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6 * c.grosor;
    ctx.setLineDash([6, 6]);
    if (!r.meta) {
      ctx.restore();
      return;
    }
    if (r.meta.tipo === 'altura' || r.meta.tipo === 'orbita') {
      const radio = r.meta.tipo === 'altura' ? mundo.R + r.meta.H : mundo.R + alturaPartida(r);
      ctx.beginPath();
      ctx.arc(cx, cy, radio * dibujo.escala, 0, 2 * Math.PI);
      ctx.stroke();
      if (r.meta.tipo === 'altura') {
        const [, y] = dibujo.aPx(0, radio);
        dibujo.texto(`meta: ${km(r.meta.H)}`, dibujo.w / 2 + 14, y - 12, color, 'left', 1.05);
      }
    } else if (r.meta.tipo === 'arco') {
      // Tramo de la superficie que cuenta como «lejos»: desde la distancia pedida hasta media vuelta
      const a0 = r.meta.d / mundo.R;
      ctx.lineWidth = 5 * c.grosor;
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      // En el lienzo, el ángulo 0 es hacia la derecha y crece hacia abajo; la montaña está arriba (−π/2).
      ctx.arc(cx, cy, mundo.R * dibujo.escala, -Math.PI / 2 + a0, (3 * Math.PI) / 2 - 0.15);
      ctx.stroke();
      const [x, y] = dibujo.aPx(mundo.R * Math.sin(a0) * 1.12, mundo.R * Math.cos(a0) * 1.12);
      dibujo.texto(`más de ${km(r.meta.d)}`, x + 6, y - 8, color, 'left', 1.05);
    }
    ctx.restore();
  }

  function dibujar() {
    const { ctx, c } = dibujo;
    ctx.clearRect(0, 0, dibujo.w, dibujo.h);
    const r = reto();
    const esc = escalas();
    dibujo.mundo(mundo, alturaPartida(r));
    dibujarMeta();
    // Intentos anteriores: tenues, para comparar con el último
    for (const e of estado.viejas) dibujo.estela({ estela: e, x: e[e.length - 2], y: e[e.length - 1] }, c.tenue, [3, 4]);
    const s = estado.sonda;
    if (s) {
      dibujo.estela(s, c.sondas[0], []);
      dibujo.sonda(s, c.sondas[0], false);
      dibujo.vectores(s, mundo.M, { fuerza: true, velocidad: true }, esc.vPx, esc.fPx);
    }
    const enVuelo = s && s.estado === 'vuelo' && !s.juzgada;
    dibujo.lanzador(mundo, { h: alturaPartida(r), v: estado.v, angulo: r.angulo }, esc.vPx, enVuelo);
    dibujo.regla(mundo, s, 14);
  }

  /** Datos en vivo sobre el dibujo: altura y rapidez de la sonda. */
  function mostrarVivo() {
    const s = estado.sonda;
    if (!s) { $('vivo').textContent = ''; return; }
    const r = Math.hypot(s.x, s.y);
    const h = r - mundo.R < 1 ? 0 : r - mundo.R; // en el suelo: 0, no 0,000001 m
    $('vivo').innerHTML = `<i class="serif">h</i> = ${fmt.distancia(h, true)}` +
      ` · <i class="serif">v</i> = ${fmt.rapidez(Math.hypot(s.vx, s.vy), true)}`;
  }

  let antes = performance.now();
  let ultimoVivo = 0;
  function cuadro(ahora) {
    const dtReal = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    const s = estado.sonda;
    if (s) {
      // Pasos cortos: así el juez ve el momento justo en que la sonda llega arriba
      for (let i = 0; i < 4; i++) { avanzar(s, mundo, (dtReal * multAhora(s)) / 4); juzgar(); }
    }
    seguirSonda();
    dibujar();
    if (ahora - ultimoVivo > 100) { mostrarVivo(); ultimoVivo = ahora; }
    requestAnimationFrame(cuadro);
  }

  // ---------- Inicio ----------

  // En el celular el alto cambia al aparecer o esconderse la barra del navegador: con una sonda
  // en vuelo se mantiene lo que se estaba viendo, y si no, se vuelve a la vista del reto.
  function alCambiarTamano() {
    const radio = dibujo.w ? dibujo.radioVisible() : 0;
    dibujo.ajustar();
    if (estado.sonda && radio) dibujo.encuadrar(radio);
    else vistaInicial();
  }
  window.addEventListener('resize', alCambiarTamano);

  document.title = 'Gravitación · ' + mision.titulo;
  $('titulo').textContent = mision.titulo;
  $('datos').innerHTML = `${mundo.nombre}: <i class="serif">M</i> = ${fmt.numero(mundo.M, 3, true)} kg · ` +
    `<i class="serif">R</i> = ${fmt.distancia(mundo.R, true)} · <i class="serif">G</i> = 6,67 × 10<sup>−11</sup> N·m²/kg²`;
  // Tema: ?tema=claro manda; si no, el que se eligió en la página principal en este navegador.
  let tema = q.get('tema');
  if (!tema) { try { tema = localStorage.getItem('gravitacion.tema'); } catch (e) { /* sin almacenamiento */ } }
  if (tema === 'claro') {
    document.documentElement.classList.add('claro');
    document.querySelector('meta[name="theme-color"]').content = '#eef1f6';
  }
  dibujo.ajustar();
  dibujo.leerColores();
  mostrarRapidez();
  elegirReto(0);
  requestAnimationFrame(cuadro);

  // Acceso para depurar desde la consola y para las pruebas
  window.mision = { estado, mision, mundo, dibujo, elegirReto, ponerRapidez, lanzar, vParaAltura };
})();
