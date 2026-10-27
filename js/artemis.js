/*
 * artemis.js — La misión final: llevar una nave por detrás de la Luna y de vuelta a la Tierra.
 *
 * Dos perillas: la rapidez de partida y dónde está la Luna al salir. Cada lanzamiento recibe un
 * veredicto (no llega, la Luna ya había pasado, chocó, pasa de largo, volvió…). Tras tres intentos
 * fallidos aparece «Ver cómo se hace», que vuela la solución y la explica. Además hay dos desafíos
 * libres: chocar con la Luna y que la Luna lance la nave fuera de la Tierra.
 * El motor es tierraluna.js; el lienzo usa la clase Dibujo de dibujo.js.
 */
(function () {
  'use strict';
  const { fmt, TierraLuna: TL } = Grav;
  const { RT, RL, D, DIA } = TL;
  const $ = (id) => document.getElementById(id);
  const km = (m) => String(Math.round(m / 1e3)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km';
  const kmS = (v) => fmt.decimal(v / 1e3, 4) + ' km/s';
  const grados = (r) => Math.round(Math.abs(r * 180 / Math.PI)) + '°';

  // La solución que se muestra tras tres intentos: pasa a unos 12 000 km por detrás de la Luna,
  // llega a 405 000 km de la Tierra y vuelve en 9 días.
  const SOLUCION = { v: 10950, angulo: 128 };
  const CERCA = 6e7;          // pasar a menos de 60 000 km del centro de la Luna es «pasar cerca»
  const MAX_INTENTOS = 3;
  const PASO_V = 10;          // m/s
  const SEG_POR_DIA = 1.0;    // segundos reales que dura un día de viaje

  const LOGROS = [
    { id: 'artemis', titulo: 'Artemis II', texto: 'rodear la Luna por detrás y volver a la Tierra' },
    { id: 'impacto', titulo: 'Impacto lunar', texto: 'chocar con la Luna, como la sonda Luna 2 en 1959' },
    { id: 'honda', titulo: 'Honda gravitacional', texto: 'partir sin la velocidad de escape y que la Luna lance la nave fuera de la Tierra' },
  ];

  // ---------- Estado ----------

  const q = new URLSearchParams(location.search);
  const guardado = leer();
  const estado = {
    v: 10500,
    angulo: 90,
    sonda: null,
    viejas: [],
    intentos: [],
    fallidos: guardado.fallidos || 0,  // intentos de Artemis II sin lograrlo
    logros: guardado.logros || [],
    vistaSolucion: false,
    girando: false,                     // vista que gira con la Luna: ahí se ve el «8»
    lupa: null,                         // { media } — mitad del ancho que muestra la lupa (m)
  };
  const dibujo = new Grav.Dibujo($('lienzo'));

  function leer() {
    try { return JSON.parse(localStorage.getItem('gravitacion.artemis')) || {}; } catch (e) { return {}; }
  }
  function guardar() {
    try {
      localStorage.setItem('gravitacion.artemis', JSON.stringify({ fallidos: estado.fallidos, logros: estado.logros }));
    } catch (e) { /* sin almacenamiento */ }
  }

  // ---------- Perillas ----------

  function mostrarPerillas() {
    $('campoV').value = fmt.decimal(estado.v / 1e3, 4);
    $('rangoV').value = Math.round(estado.v / 10);
    $('campoA').value = String(estado.angulo);
    $('rangoA').value = estado.angulo;
    $('campoV').parentElement.classList.remove('malo');
    $('campoA').parentElement.classList.remove('malo');
  }
  function ponerV(v) { estado.v = Math.min(11500, Math.max(7800, Math.round(v))); mostrarPerillas(); }
  function ponerA(a) { estado.angulo = ((Math.round(a) % 360) + 360) % 360; mostrarPerillas(); }

  $('campoV').addEventListener('change', (e) => {
    const x = fmt.leer(e.target.value);
    if (isFinite(x) && x > 0) ponerV(x < 100 ? x * 1e3 : x); // acepta 10,95 (km/s) o 10950 (m/s)
    else e.target.parentElement.classList.add('malo');
  });
  $('campoA').addEventListener('change', (e) => {
    const x = fmt.leer(e.target.value);
    if (isFinite(x)) ponerA(x); else e.target.parentElement.classList.add('malo');
  });
  $('rangoV').addEventListener('input', (e) => ponerV(Number(e.target.value) * 10));
  $('rangoA').addEventListener('input', (e) => ponerA(Number(e.target.value)));
  $('menosV').addEventListener('click', () => ponerV(estado.v - PASO_V));
  $('masV').addEventListener('click', () => ponerV(estado.v + PASO_V));
  $('menosA').addEventListener('click', () => ponerA(estado.angulo - 1));
  $('masA').addEventListener('click', () => ponerA(estado.angulo + 1));

  // Arrastrar la Luna (antes de lanzar) cambia dónde está al partir.
  const lienzo = $('lienzo');
  let arrastrando = false;
  const punto = (e) => { const c = lienzo.getBoundingClientRect(); return [e.clientX - c.left, e.clientY - c.top]; };
  const thPartida = () => Math.PI + (estado.angulo * Math.PI) / 180;
  function lunaElegidaPx() {
    const b = TL.cuerpos(0, thPartida());
    return dibujo.aPx(b.xl, b.yl);
  }
  lienzo.addEventListener('pointerdown', (e) => {
    if (enVuelo()) return;
    const p = punto(e), [x, y] = lunaElegidaPx();
    if (Math.hypot(p[0] - x, p[1] - y) < (e.pointerType === 'touch' ? 40 : 24)) {
      arrastrando = true;
      lienzo.setPointerCapture(e.pointerId);
    }
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    const [mx, my] = dibujo.aMundo(...punto(e));
    ponerA((Math.atan2(my, mx) - Math.PI) * 180 / Math.PI);
  });
  const soltar = () => (arrastrando = false);
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);

  // ---------- Lanzar ----------

  const enVuelo = () => estado.sonda && estado.sonda.estado === 'vuelo' && !estado.sonda.juzgada;

  function lanzar(solucion = false) {
    if (estado.sonda) {
      estado.viejas.push(estado.sonda.estela);
      if (estado.viejas.length > 3) estado.viejas.shift();
    }
    const { v, angulo } = solucion ? SOLUCION : estado;
    const s = TL.crear(v, angulo);
    s.solucion = solucion;
    s.juzgada = false;
    s.fin = Infinity;   // hasta cuándo se sigue dibujando el vuelo después del veredicto
    estado.sonda = s;
    estado.lupa = null;
    vistaInicial();
    avisar(null, solucion ? 'Así se hace: mírenla volar…' : 'En vuelo…');
    const escena = lienzo.getBoundingClientRect();
    if (escena.top < -0.25 * escena.height) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('lanzar').addEventListener('click', () => lanzar(false));

  $('verSolucion').addEventListener('click', () => {
    estado.vistaSolucion = true;
    ponerV(SOLUCION.v);
    ponerA(SOLUCION.angulo);
    lanzar(true);
  });

  // ---------- Veredicto ----------

  /** Estado de la nave respecto de la Tierra: distancia, rapidez radial y perigeo de su cónica. */
  function respectoTierra(s) {
    const b = TL.cuerpos(s.t, s.th0);
    const x = s.x - b.xt, y = s.y - b.yt, vx = s.vx - b.vxt, vy = s.vy - b.vyt;
    const r = Math.hypot(x, y);
    const e = 0.5 * (vx * vx + vy * vy) - TL.GMT / r;   // energía por kilo
    const h = x * vy - y * vx;                          // momento angular por kilo
    let rp = Infinity;                                  // perigeo, si sigue ligada a la Tierra
    if (e < 0) rp = (-TL.GMT + Math.sqrt(TL.GMT ** 2 + 2 * e * h * h)) / (2 * e);
    return { r, vr: (x * vx + y * vy) / r, e, rp, dL: Math.hypot(s.x - b.xl, s.y - b.yl) };
  }

  /** Cuánto iba la Luna adelante de la nave (rad, vista desde la Tierra) en este momento. */
  function adelanto(s) {
    const b = TL.cuerpos(s.t, s.th0);
    const d = Math.atan2(b.yl - b.yt, b.xl - b.xt) - Math.atan2(s.y - b.yt, s.x - b.xt);
    return Math.atan2(Math.sin(d), Math.cos(d));
  }

  /** Dónde estaba la Luna cuando la nave llegó a su órbita (o a lo más alto): el dato para corregir el ángulo. */
  function desfase(s) {
    const d = s.cruce !== undefined ? s.cruce : adelanto(s);
    return d > 0
      ? `la Luna ya había pasado (iba ${grados(d)} adelante). Prueben con la Luna menos adelantada.`
      : `la Luna todavía no llegaba (le faltaban ${grados(d)}). Prueben con la Luna más adelantada.`;
  }

  /** null mientras no se sabe; si no, { ok, texto, logro }. */
  function juez(s) {
    const T = respectoTierra(s);
    if (T.vr > 0 && T.r > 10 * RT) s.subia = true;
    if (s.cruce === undefined && T.r >= 0.95 * D) s.cruce = adelanto(s);
    const apogeo = s.subia && T.vr < 0;
    const cerca = s.dLmin < CERCA;
    const lado = s.detras ? 'por detrás' : 'por delante';
    const hL = km(s.dLmin - RL);

    if (s.estado === 'luna') return { ok: false, texto: '¡Chocó con la Luna! Artemis II debía rodearla, no llegar a su suelo.', logro: 'impacto' };

    if (!cerca) {
      if (s.estado === 'tierra' || s.estado === 'perdida') return { ok: false, texto: 'No pasó cerca de la Luna.' };
      if (apogeo && s.rTmax < 0.8 * D) {
        return { ok: false, texto: `No llega: subió hasta ${km(s.rTmax)} y vuelve a caer. La Luna está a 384 400 km: le falta rapidez.` };
      }
      if (apogeo || (T.r > 1.3 * D && T.vr > 0)) {
        const se = T.e >= 0 ? 'Escapó de la Tierra: le sobra rapidez. Además, ' : 'Llegó hasta la órbita de la Luna, pero ';
        return { ok: false, texto: se + desfase(s) };
      }
      return null;
    }

    // Pasó cerca de la Luna: ¿vuelve a la Tierra?
    if (s.estado === 'tierra') {
      const dias = fmt.decimal(s.t / DIA, 2);
      return s.detras
        ? { ok: true, texto: `¡Misión cumplida! Rodeó la Luna por detrás, a ${hL} de su superficie, y volvió a la Tierra en ${dias} días.`, logro: 'artemis' }
        : { ok: false, texto: `Volvió a la Tierra, pero pasó por delante de la Luna (a ${hL}). Artemis II la rodea por detrás.` };
    }
    // Ya se alejó de la Luna: la cónica respecto de la Tierra dice si vuelve.
    if (T.dL > 1e8 && s.t > s.tLmin) {
      if (T.e >= 0) {
        const honda = s.lanzamiento.v < TL.vEscape0;
        return {
          ok: false, logro: honda ? 'honda' : undefined,
          texto: `Pasó ${lado} de la Luna (a ${hL}) y la Luna la lanzó lejos: escapó de la Tierra y no vuelve.`,
        };
      }
      if (T.rp > RT + 2e6) {
        return { ok: false, texto: `Pasó ${lado} de la Luna (a ${hL}) y vuelve, pero pasa de largo a ${km(T.rp - RT)} de la Tierra.` };
      }
    }
    // Volvió cerca de la Tierra, pero no entró al aire
    if (s.salio && T.r < 0.2 * D && s.t > s.tLmin && T.vr > 0 && s.bajaba) {
      return { ok: false, texto: `Pasó ${lado} de la Luna y volvió, pero pasó a ${km(s.rTmin - RT)} de altura: no entró al aire.` };
    }
    if (s.t > s.tLmin && T.vr < 0) s.bajaba = true;
    if (s.estado === 'perdida') return { ok: false, texto: `Pasó ${lado} de la Luna (a ${hL}), pero no volvió a la Tierra.` };
    return null;
  }

  function juzgar() {
    const s = estado.sonda;
    if (!s || s.juzgada) return;
    const ver = juez(s);
    if (!ver) return;
    s.juzgada = true;
    s.fin = s.estado === 'vuelo' ? s.t + 4 * DIA : s.t;  // se deja volar unos días más para verla
    const primera = ver.ok && !estado.logros.includes('artemis');
    // La solución mostrada no cuenta como logro: eso lo tiene que hacer el grupo
    if (ver.logro && !s.solucion && !estado.logros.includes(ver.logro)) estado.logros.push(ver.logro);
    if (!s.solucion) {
      estado.intentos.push({ v: s.lanzamiento.v, angulo: s.lanzamiento.angulo, ...ver });
      if (!ver.ok && !estado.logros.includes('artemis')) estado.fallidos++;
    }
    guardar();
    mostrarIntentos();
    mostrarLogros();
    if (s.solucion) {
      avisar(true, ver.texto);
      mostrarSolucion();
    } else {
      let texto = ver.texto;
      if (primera && estado.fallidos < MAX_INTENTOS) texto += estado.fallidos ? ` Lo lograron en ${estado.fallidos + 1} intentos.` : ' ¡Al primer intento!';
      if (primera) texto += ' Prueben «Girar con la Luna»: ahí se ve la vuelta completa alrededor de la Luna. Y se abrió el modo libre.';
      avisar(ver.ok, texto);
    }
  }

  function mostrarSolucion() {
    $('solucion').hidden = false;
    $('solucion').innerHTML =
      `<b>Cómo se hace:</b> ${kmS(SOLUCION.v)} con la Luna a ${SOLUCION.angulo}°. ` +
      'Es casi la velocidad de escape (11,02 km/s a 185 km), así que la nave sube muy lejos en unos 3 días. ' +
      'La Luna, que partió atrasada y avanzó 13° por día, llega al mismo lugar a tiempo: ' +
      'su gravedad curva la trayectoria por detrás de ella y la manda de vuelta a la Tierra, sin motores. ' +
      'Es una <i>trayectoria de retorno libre</i>, la que usó Artemis II en abril de 2026: si el motor fallaba, la nave volvía igual.';
  }

  // ---------- Aviso, intentos y logros ----------

  function avisar(ok, texto) {
    const aviso = $('aviso');
    aviso.dataset.listo = ok === null ? '' : 'si';
    aviso.className = 'm-aviso' + (ok === true ? ' ok' : ok === false ? ' no' : '');
    $('textoAviso').textContent = texto;
    const lograda = estado.logros.includes('artemis');
    $('verSolucion').hidden = !(estado.fallidos >= MAX_INTENTOS && !lograda && !(estado.sonda && estado.sonda.solucion) && ok === false);
    mostrarCuenta();
  }

  function mostrarCuenta() {
    const c = $('cuentaIntentos');
    if (estado.logros.includes('artemis')) c.textContent = '✓ Logrado';
    else if (estado.vistaSolucion) c.textContent = 'Vieron cómo se hace: ahora ustedes';
    else if (estado.fallidos < MAX_INTENTOS) c.textContent = `Intento ${estado.fallidos + 1} de ${MAX_INTENTOS}`;
    else c.textContent = 'Tres intentos: ya pueden ver cómo se hace';
    c.classList.toggle('ok', estado.logros.includes('artemis'));
    mostrarFinal();
  }

  /** El modo libre se abre al lograr Artemis II. */
  function mostrarFinal() {
    const actual = $('final');
    const abierto = estado.logros.includes('artemis');
    const nuevo = document.createElement(abierto ? 'a' : 'p');
    if (abierto) {
      nuevo.href = 'libre.html?desde=artemis' + (q.get('tema') ? '&tema=' + q.get('tema') : '');
      nuevo.textContent = 'Se abrió el modo libre: N cuerpos →';
    } else {
      nuevo.textContent = '🔒 Modo libre: se abre al lograr Artemis II.';
    }
    nuevo.id = 'final';
    nuevo.className = 'm-final';
    actual.replaceWith(nuevo);
  }

  function mostrarIntentos() {
    const l = estado.intentos;
    $('cuenta').textContent = l.length ? `(${l.length})` : '';
    $('intentos').innerHTML = l.slice().reverse().map((x) =>
      `<li class="${x.ok ? 'ok' : ''}"><b>${kmS(x.v)} · ${x.angulo}°</b> · ${x.texto}</li>`).join('');
  }

  function mostrarLogros() {
    $('logros').innerHTML = LOGROS.map((g) => {
      const si = estado.logros.includes(g.id);
      return `<li class="${si ? 'ok' : ''}"><span class="a-marca">${si ? '✓' : '○'}</span> <b>${g.titulo}:</b> ${g.texto}</li>`;
    }).join('');
  }

  $('vista').addEventListener('click', () => {
    estado.girando = !estado.girando;
    $('vista').setAttribute('aria-pressed', String(estado.girando));
    $('vista').textContent = estado.girando ? 'Vista fija' : 'Girar con la Luna';
  });

  $('botonPista').addEventListener('click', () => {
    const p = $('pista');
    p.hidden = !p.hidden;
    $('botonPista').setAttribute('aria-expanded', String(!p.hidden));
  });

  // ---------- Vista ----------

  function vistaInicial() {
    dibujo.centro = [0, 0];
    dibujo.encuadrar(1.12 * D);
  }

  /** Si la nave se sale del cuadro, la vista se aleja de a poco (hasta 3 veces la distancia a la Luna). */
  function seguirNave() {
    const s = estado.sonda;
    if (!s || s.estado !== 'vuelo') return;
    const [px, py] = vista(s.x, s.y, s.t), m = 12;
    const fuera = px < m || px > dibujo.w - m || py < m || py > dibujo.h - m;
    if (fuera && dibujo.radioVisible() < 3 * D) dibujo.escala /= 1.03;
  }

  // ---------- Dibujo ----------

  function disco(x, y, r, color) {
    const { ctx } = dibujo;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
    g.addColorStop(0, aclarar(color, 0.3));
    g.addColorStop(0.7, color);
    g.addColorStop(1, aclarar(color, -0.45));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
  }

  function aclarar(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.round(f > 0 ? x + (255 - x) * f : x * (1 + f)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  /**
   * Trayectoria guardada en metros, de a «paso» números por punto (x, y y, si hay, t), con una
   * función que la lleva a píxeles. xf, yf, tf: el punto donde va la nave ahora.
   */
  function linea(e, aPx, color, ancho, guiones, alfa, paso, fin) {
    if (e.length < 2 * paso) return;
    const { ctx } = dibujo;
    ctx.strokeStyle = color;
    ctx.globalAlpha = alfa;
    ctx.lineWidth = ancho * dibujo.c.grosor;
    ctx.lineJoin = 'round';
    ctx.setLineDash(guiones);
    ctx.beginPath();
    let [px, py] = aPx(e[0], e[1], e[2]);
    ctx.moveTo(px, py);
    for (let i = paso; i < e.length; i += paso) { [px, py] = aPx(e[i], e[i + 1], e[i + 2]); ctx.lineTo(px, py); }
    if (fin) { [px, py] = aPx(...fin); ctx.lineTo(px, py); }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /**
   * De metros a píxeles. En la vista que gira con la Luna, cada punto se gira hacia atrás lo que
   * la Luna avanzó hasta su tiempo t: así la Tierra y la Luna quedan quietas donde partieron.
   */
  function vista(x, y, t) {
    if (!estado.girando || !t) return dibujo.aPx(x, y);
    const a = -TL.W * t, c = Math.cos(a), s = Math.sin(a);
    return dibujo.aPx(c * x - s * y, s * x + c * y);
  }

  function dibujar() {
    const { ctx, c } = dibujo;
    ctx.clearRect(0, 0, dibujo.w, dibujo.h);
    const s = estado.sonda;
    const t = s ? s.t : 0;
    const b = s ? TL.cuerpos(s.t, s.th0) : TL.cuerpos(0, thPartida());
    const [tx, ty] = vista(b.xt, b.yt, t);
    const [lx, ly] = vista(b.xl, b.yl, t);
    const rT = Math.max(RT * dibujo.escala, 7);
    const rL = Math.max(RL * dibujo.escala, 4.5);

    // Órbita de la Luna
    ctx.strokeStyle = c.tenue;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.arc(...dibujo.aPx(0, 0), (1 - TL.MU) * D * dibujo.escala, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Antes de lanzar (o con el vuelo ya juzgado): el ángulo elegido, de la partida a la Luna
    const quieto = !enVuelo();
    if (quieto) {
      const b0 = TL.cuerpos(0, thPartida());
      const [ex, ey] = dibujo.aPx(b0.xt, b0.yt);
      const [mx, my] = dibujo.aPx(b0.xl, b0.yl);
      const rArco = Math.min(0.16 * Math.min(dibujo.w, dibujo.h), 70);
      ctx.strokeStyle = c.acento;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(ex - rArco - 14, ey); ctx.lineTo(ex, ey); ctx.lineTo(mx, my);
      ctx.stroke();
      ctx.setLineDash([]);
      // En el lienzo el ángulo crece hacia abajo: el giro de la Luna (antihorario en el mundo) es «hacia atrás»
      const a0 = Math.PI, a1 = Math.PI - (estado.angulo * Math.PI) / 180;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(ex, ey, rArco, a0, a1, true);
      ctx.stroke();
      const am = (a0 + a1) / 2;
      dibujo.texto(estado.angulo + '°', ex + Math.cos(am) * (rArco + 16), ey + Math.sin(am) * (rArco + 16), c.acento, 'center', 1.1);
      // La Luna elegida, con su asa para arrastrarla (si ya hubo un vuelo, la Luna quedó donde terminó)
      if (s) disco(mx, my, rL, '#a7a6a2');
      ctx.strokeStyle = c.acento;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, rL + 9, 0, 2 * Math.PI);
      ctx.stroke();
      dibujo.texto('Luna al partir', mx, my + rL + 22, c.acento, 'center', 0.9);
    }

    // Intentos anteriores, tenues
    for (const e of estado.viejas) linea(e, vista, c.tenue, 1.3, [3, 4], 0.7, 3);
    // El vuelo actual
    const color = s && s.solucion ? c.sondas[2] || c.vel : c.sondas[0];
    if (s) linea(s.estela, vista, color, 1.8, [], 0.9, 3, [s.x, s.y, s.t]);

    disco(tx, ty, rT, '#3f78b5');
    disco(lx, ly, rL, '#a7a6a2');
    dibujo.texto('Tierra', tx + rT + 6, ty - rT - 6, c.tenue, 'left', 0.9);
    if (s && (!quieto || !estado.girando)) dibujo.texto('Luna', lx, ly - rL - 12, c.tenue, 'center', 0.9);

    // Partida: a la izquierda de la Tierra, hacia abajo
    if (!s || quieto) {
      const px = tx - rT - 3;
      dibujo.flecha(px, ty, px, ty + 26, c.vel, 2);
      ctx.fillStyle = c.tinta;
      ctx.beginPath(); ctx.arc(px, ty, 3, 0, 2 * Math.PI); ctx.fill();
    }
    if (s && s.estado !== 'tierra' && s.estado !== 'luna') {
      const [px, py] = vista(s.x, s.y, s.t);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px, py, 4.5 * c.grosor, 0, 2 * Math.PI); ctx.fill();
    }
    if (s && s.estado === 'luna') cruz(...vista(s.x, s.y, s.t), color);
    dibujarLupa(s, b, color);
  }

  function cruz(px, py, color) {
    const { ctx } = dibujo, r = 5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r);
    ctx.moveTo(px + r, py - r); ctx.lineTo(px - r, py + r);
    ctx.stroke();
  }

  /**
   * La lupa: la Luna a escala, vista desde la Luna, cuando la nave pasa cerca. Aquí se ve si la
   * rodea por detrás. Se queda después del paso, para comparar.
   */
  function dibujarLupa(s, b, color) {
    if (!s || s.dLmin > 1.4e8 || s.estelaLuna.length < 4) return;
    const { ctx, c } = dibujo;
    const R = Math.min(64, 0.2 * Math.min(dibujo.w, dibujo.h));
    const cx = 12 + R, cy = 12 + R;
    // Mitad del ancho que se muestra: se acerca a medida que la nave se acerca, y después queda fija
    const meta = Math.min(1.2e8, Math.max(1.5e7, 2.6 * s.dLmin));
    estado.lupa = estado.lupa ? estado.lupa + (meta - estado.lupa) * 0.08 : meta;
    const k = R / estado.lupa;
    const aL = (x, y) => [cx + x * k, cy - y * k];

    ctx.save();
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--panel') || '#000';
    ctx.globalAlpha = 0.92;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c.linea;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.clip();
    disco(cx, cy, Math.max(RL * k, 2), '#a7a6a2');
    // Hacia dónde está la Tierra (en el momento más cercano o ahora, si aún no pasa)
    const bt = s.t > s.tLmin ? TL.cuerpos(s.tLmin, s.th0) : b;
    const ux = bt.xt - bt.xl, uy = bt.yt - bt.yl, u = Math.hypot(ux, uy);
    dibujo.flecha(cx + (ux / u) * R * 0.45, cy - (uy / u) * R * 0.45, cx + (ux / u) * R * 0.85, cy - (uy / u) * R * 0.85, c.tenue, 1.4);
    const l = s.estelaLuna;
    const fin = s.estado === 'vuelo' && TL.cuerpos(s.t, s.th0);
    linea(l, aL, color, 1.8, [], 0.95, 2, fin ? [s.x - fin.xl, s.y - fin.yl] : null);
    ctx.restore();
    dibujo.texto('lupa: la Luna a escala', cx, cy + R + 11, c.tenue, 'center', 0.8);
    dibujo.texto('Tierra', cx + (ux / u) * R * 0.62, cy - (uy / u) * R * 0.62 - 10, c.tenue, 'center', 0.75);
  }

  function mostrarVivo() {
    const s = estado.sonda;
    if (!s) { $('vivo').textContent = ''; return; }
    const T = respectoTierra(s);
    const donde = s.estado === 'tierra' ? 'de vuelta en la Tierra' : s.estado === 'luna' ? 'en la Luna' : `a ${km(T.r)} de la Tierra`;
    $('vivo').textContent = `día ${fmt.decimal(s.t / DIA, 2)} · ${donde}`;
  }

  // ---------- Tiempo ----------

  /** Un día de viaje dura SEG_POR_DIA segundos; cerca de la Luna se va más lento, para ver el paso. */
  function multAhora(s) {
    const T = respectoTierra(s);
    const lento = Math.min(1, Math.max(0.3, T.dL / 5e7));
    return (DIA / SEG_POR_DIA) * lento;
  }

  let antes = performance.now();
  let ultimoVivo = 0;
  function cuadro(ahora) {
    const dtReal = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    const s = estado.sonda;
    if (s && s.estado === 'vuelo' && s.t < s.fin) {
      for (let i = 0; i < 4; i++) { TL.avanzar(s, (dtReal * multAhora(s)) / 4); juzgar(); }
    }
    seguirNave();
    dibujar();
    if (ahora - ultimoVivo > 100) { mostrarVivo(); ultimoVivo = ahora; }
    requestAnimationFrame(cuadro);
  }

  // ---------- Inicio ----------

  function alCambiarTamano() {
    const radio = dibujo.w ? dibujo.radioVisible() : 0;
    dibujo.ajustar();
    if (estado.sonda && radio) dibujo.encuadrar(radio); else vistaInicial();
  }
  window.addEventListener('resize', alCambiarTamano);

  // Volver a la misión de donde se vino (?desde=escapar|orbitar|llegar)
  const desde = q.get('desde');
  if (['escapar', 'orbitar', 'llegar'].includes(desde)) {
    $('volver').href = 'mision.html?m=' + desde;
    $('volver').textContent = '← Volver a la misión';
  }
  let tema = q.get('tema');
  if (!tema) { try { tema = localStorage.getItem('gravitacion.tema'); } catch (e) { /* sin almacenamiento */ } }
  if (tema === 'claro') {
    document.documentElement.classList.add('claro');
    document.querySelector('meta[name="theme-color"]').content = '#eef1f6';
  }
  dibujo.ajustar();
  dibujo.leerColores();
  vistaInicial();
  mostrarPerillas();
  mostrarLogros();
  mostrarIntentos();
  avisar(null, 'Elijan la rapidez y dónde está la Luna, y lancen.');
  requestAnimationFrame(cuadro);

  // Acceso para depurar desde la consola y para las pruebas
  window.artemis = { estado, SOLUCION, ponerV, ponerA, lanzar, dibujo };
})();
