/*
 * libre.js — El modo libre: escenas con N cuerpos, masas que se cambian, cuerpos que se agregan
 * y la comparación entre Euler y RK4. El motor es ncuerpos.js; el lienzo usa Dibujo (dibujo.js).
 *
 * En pausa se puede arrastrar un cuerpo para moverlo y la punta de su flecha para cambiar su
 * velocidad. «+ Cuerpo»: tocar el dibujo lo pone en órbita circular alrededor del más pesado;
 * arrastrar le da la velocidad que se dibuja.
 */
(function () {
  'use strict';
  const { fmt, NCuerpos: N } = Grav;
  const G = Grav.G;
  const $ = (id) => document.getElementById(id);

  const DIA = 86400, AU = 1.496e11, MSOL = 1.989e30, RSOL = 6.96e8;
  const MT = 5.97e24, RT = 6.37e6;
  const COLORES = ['#3f78b5', '#a7a6a2', '#f2c14e', '#e07a5f', '#7fd18b', '#c49af0', '#5fc4d8', '#d9b77a'];

  /** Cuerpo en órbita circular alrededor de (0, 0) con masa central M, a la distancia r (sentido antihorario). */
  const enOrbita = (nombre, m, R, r, M, color, fase = 0) => {
    const v = Math.sqrt((G * M) / r);
    return { nombre, m, R, color, x: r * Math.cos(fase), y: r * Math.sin(fase), vx: -v * Math.sin(fase), vy: v * Math.cos(fase) };
  };

  // Cada escena: cuerpos, vista (radio que se encuadra), T (tiempo que dura unos 6 s de animación),
  // masaNueva (la de un cuerpo agregado), vRef (rapidez que mide 60 px en la flecha) y un texto.
  const ESCENAS = {
    tierraLuna: {
      nombre: 'Tierra y Luna',
      texto: 'La Tierra y la Luna giran alrededor de su centro de masa (la cruz). Prueben darle a la Luna la masa de la Tierra.',
      cuerpos: () => {
        const d = 3.844e8, v = Math.sqrt((G * (MT + 7.35e22)) / d);
        return [
          { nombre: 'Tierra', m: MT, R: RT, color: '#3f78b5', x: 0, y: 0, vx: 0, vy: 0 },
          { nombre: 'Luna', m: 7.35e22, R: 1.74e6, color: '#a7a6a2', x: d, y: 0, vx: 0, vy: v },
        ];
      },
      vista: 4.4e8, T: 27.3 * DIA, masaNueva: 7.35e22, vRef: 1000, unidad: 'días',
    },
    solar: {
      nombre: 'Sistema solar',
      texto: 'El Sol y los cuatro planetas interiores. ¿Qué pasa si el Sol pierde la mitad de su masa? ¿Y si la Tierra pesa como Júpiter?',
      cuerpos: () => [
        { nombre: 'Sol', m: MSOL, R: RSOL, color: '#f2c14e', x: 0, y: 0, vx: 0, vy: 0 },
        enOrbita('Mercurio', 3.30e23, 2.44e6, 5.79e10, MSOL, '#8f8780', 2.1),
        enOrbita('Venus', 4.87e24, 6.05e6, 1.082e11, MSOL, '#d9b77a', 4.0),
        enOrbita('Tierra', MT, RT, AU, MSOL, '#3f78b5', 0),
        enOrbita('Marte', 6.42e23, 3.39e6, 2.279e11, MSOL, '#b8603e', 1.2),
      ],
      vista: 2.6e11, T: 365 * DIA, masaNueva: MT, vRef: 3e4, unidad: 'días',
    },
    doble: {
      nombre: 'Estrella doble',
      texto: 'Dos soles giran uno alrededor del otro y un planeta los rodea a los dos. Acérquenle el planeta: ¿sigue en órbita?',
      cuerpos: () => {
        const d = AU, v = 0.5 * Math.sqrt((2 * G * MSOL) / d);
        return [
          { nombre: 'Estrella A', m: MSOL, R: RSOL, color: '#f2c14e', x: d / 2, y: 0, vx: 0, vy: v },
          { nombre: 'Estrella B', m: MSOL, R: RSOL, color: '#e07a5f', x: -d / 2, y: 0, vx: 0, vy: -v },
          enOrbita('Planeta', MT, RT, 3 * AU, 2 * MSOL, '#3f78b5', 1),
        ];
      },
      vista: 3.6 * AU, T: 0.71 * 365 * DIA, masaNueva: MT, vRef: 2e4, unidad: 'días',
    },
    ocho: {
      nombre: 'El ocho',
      texto: 'Tres estrellas iguales que se persiguen sobre un ocho (Chenciner y Montgomery, 2000). Cambien un poco una masa: ¿dura el ocho?',
      cuerpos: () => {
        const V = Math.sqrt((G * MSOL) / AU);
        const x1 = [0.97000436, -0.24308753], v3 = [-0.93240737, -0.86473146];
        return [
          { nombre: 'A', m: MSOL, R: RSOL, color: '#f2c14e', x: x1[0] * AU, y: x1[1] * AU, vx: (-v3[0] / 2) * V, vy: (-v3[1] / 2) * V },
          { nombre: 'B', m: MSOL, R: RSOL, color: '#e07a5f', x: -x1[0] * AU, y: -x1[1] * AU, vx: (-v3[0] / 2) * V, vy: (-v3[1] / 2) * V },
          { nombre: 'C', m: MSOL, R: RSOL, color: '#5fc4d8', x: 0, y: 0, vx: v3[0] * V, vy: v3[1] * V },
        ];
      },
      vista: 1.25 * AU, T: 368 * DIA, masaNueva: MSOL, vRef: 3e4, unidad: 'días',
    },
    pitagoras: {
      nombre: '3, 4 y 5',
      texto: 'Tres estrellas de 3, 4 y 5 masas solares, quietas en un triángulo de lados 3, 4 y 5. Nadie sabe qué pasará sin calcularlo: es caos.',
      cuerpos: () => [
        { nombre: '3 soles', m: 3 * MSOL, R: RSOL, color: '#5fc4d8', x: 1 * AU, y: 3 * AU, vx: 0, vy: 0 },
        { nombre: '4 soles', m: 4 * MSOL, R: RSOL, color: '#e07a5f', x: -2 * AU, y: -1 * AU, vx: 0, vy: 0 },
        { nombre: '5 soles', m: 5 * MSOL, R: RSOL, color: '#f2c14e', x: 1 * AU, y: -1 * AU, vx: 0, vy: 0 },
      ],
      vista: 4.5 * AU, T: 6 * Math.sqrt(AU ** 3 / (G * MSOL)), masaNueva: MSOL, vRef: 3e4, unidad: 'días',
    },
  };

  // ---------- Estado ----------

  const q = new URLSearchParams(location.search);
  const estado = {
    clave: ESCENAS[q.get('escena')] ? q.get('escena') : 'tierraLuna',
    sis: null,
    corriendo: true,
    metodo: 'rk4',
    eta: 0.01,
    tiempo: 1,
    seguir: true,
    E0: 0,
    estelas: new Map(),   // cuerpo → [x0, y0, x1, y1, …]
    agregando: false,
    nuevos: 0,
  };
  const escena = () => ESCENAS[estado.clave];
  const dibujo = new Grav.Dibujo($('lienzo'));

  function cargar(clave) {
    estado.clave = clave;
    estado.sis = N.crear(escena().cuerpos());
    N.alCentro(estado.sis);
    estado.estelas = new Map(estado.sis.c.map((b) => [b, []]));
    estado.E0 = N.energia(estado.sis);
    estado.nuevos = 0;
    dibujo.centro = [0, 0];
    dibujo.encuadrar(escena().vista);
    $('textoEscena').textContent = escena().texto;
    mostrarEscenas();
    mostrarCuerpos();
    avisar(estado.corriendo ? 'Corriendo. Pausen para mover un cuerpo o cambiar su velocidad.' : 'En pausa: arrastren un cuerpo o la punta de su flecha.');
  }

  /** Después de un cambio a mano (masa, posición, velocidad), la energía se vuelve a medir desde ahí. */
  function nuevaReferencia() { estado.E0 = N.energia(estado.sis); }

  // ---------- Paneles ----------

  function mostrarEscenas() {
    $('escenas').innerHTML = '';
    for (const [k, e] of Object.entries(ESCENAS)) {
      const b = document.createElement('button');
      b.className = 'l-escena';
      b.textContent = e.nombre;
      b.setAttribute('aria-pressed', String(k === estado.clave));
      b.addEventListener('click', () => cargar(k));
      $('escenas').appendChild(b);
    }
  }

  const masaTexto = (m) => fmt.numero(m, 3).replace(' × ', '×').replace(/\s/g, '');

  function mostrarCuerpos() {
    const ul = $('cuerpos');
    ul.innerHTML = '';
    $('cuantos').textContent = `(${estado.sis.c.length})`;
    for (const b of estado.sis.c) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="l-punto" style="background:${b.color}"></span>
        <span class="l-nombre">${b.nombre}</span>
        <span class="campo l-masa"><input inputmode="decimal" aria-label="Masa de ${b.nombre}" value="${masaTexto(b.m)}"><span class="u">kg</span></span>
        <button class="l-mini" data-f="0.5" aria-label="Mitad de masa">÷2</button>
        <button class="l-mini" data-f="2" aria-label="Doble de masa">×2</button>
        <button class="l-mini l-quitar" aria-label="Quitar ${b.nombre}">✕</button>`;
      const campo = li.querySelector('input');
      campo.addEventListener('change', () => {
        const m = fmt.leer(campo.value);
        if (isFinite(m) && m > 0) ponerMasa(b, m); else campo.parentElement.classList.add('malo');
      });
      li.querySelectorAll('[data-f]').forEach((x) => x.addEventListener('click', () => ponerMasa(b, b.m * Number(x.dataset.f))));
      li.querySelector('.l-quitar').addEventListener('click', () => {
        estado.sis.c.splice(estado.sis.c.indexOf(b), 1);
        estado.estelas.delete(b);
        nuevaReferencia();
        mostrarCuerpos();
      });
      ul.appendChild(li);
    }
  }

  function ponerMasa(b, m) {
    b.m = Math.min(1e33, Math.max(1, m));
    nuevaReferencia();
    mostrarCuerpos();
    avisar(`${b.nombre}: masa ${masaTexto(b.m)} kg. Las velocidades no cambiaron; las fuerzas sí.`);
  }

  function avisar(texto) { $('textoAviso').textContent = texto; }

  // Botones de opción (método, paso, tiempo): uno apretado por grupo
  function grupo(atributo, alElegir) {
    const botones = document.querySelectorAll(`[data-${atributo}]`);
    botones.forEach((b) => b.addEventListener('click', () => {
      botones.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      alElegir(b.dataset[atributo]);
    }));
  }
  grupo('metodo', (v) => {
    estado.metodo = v;
    avisar(v === 'euler'
      ? 'Euler: miren cómo cambia la energía (abajo del dibujo). Con paso grueso las órbitas se abren.'
      : 'RK4: cuatro mediciones de la aceleración por paso. La energía casi no cambia.');
  });
  grupo('paso', (v) => { estado.eta = Number(v); });
  grupo('tiempo', (v) => { estado.tiempo = Number(v); });
  $('seguirCM').addEventListener('change', (e) => { estado.seguir = e.target.checked; });

  $('pausa').addEventListener('click', () => {
    estado.corriendo = !estado.corriendo;
    $('pausa').textContent = estado.corriendo ? 'Pausa' : 'Seguir';
    avisar(estado.corriendo ? 'Corriendo.' : 'En pausa: arrastren un cuerpo para moverlo o la punta de su flecha para cambiar su velocidad.');
  });
  $('reiniciar').addEventListener('click', () => cargar(estado.clave));
  $('agregar').addEventListener('click', () => {
    estado.agregando = !estado.agregando;
    $('agregar').setAttribute('aria-pressed', String(estado.agregando));
    avisar(estado.agregando
      ? 'Toquen el dibujo: el cuerpo nuevo queda en órbita circular alrededor del más pesado. O arrastren para darle la velocidad que dibujen.'
      : 'Listo.');
  });
  $('alejar').addEventListener('click', () => { dibujo.escala /= 1.5; });
  $('acercar').addEventListener('click', () => { dibujo.escala *= 1.5; });

  // ---------- Tocar y arrastrar ----------

  const lienzo = $('lienzo');
  const punto = (e) => { const c = lienzo.getBoundingClientRect(); return [e.clientX - c.left, e.clientY - c.top]; };
  const vPx = () => 60 / escena().vRef;
  let arrastre = null; // { tipo: 'mover' | 'velocidad' | 'nuevo', b, x0, y0 }

  function radioPx(b) {
    return Math.max(b.R * dibujo.escala, Math.min(15, Math.max(3.5, 3 + 1.6 * Math.log10(b.m / 1e22))));
  }

  lienzo.addEventListener('pointerdown', (e) => {
    const p = punto(e);
    const tol = e.pointerType === 'touch' ? 30 : 16;
    if (estado.agregando) {
      const [x, y] = dibujo.aMundo(...p);
      estado.nuevos++;
      const b = {
        nombre: 'Nuevo ' + estado.nuevos, m: escena().masaNueva, R: escena().masaNueva >= 1e29 ? RSOL : RT,
        color: COLORES[(estado.sis.c.length + estado.nuevos) % COLORES.length], x, y, vx: 0, vy: 0,
      };
      arrastre = { tipo: 'nuevo', b, p0: p, corria: estado.corriendo };
      estado.corriendo = false;
      estado.sis.c.push(b);
      estado.estelas.set(b, []);
    } else if (!estado.corriendo) {
      // Primero las puntas de las flechas (están fuera de los cuerpos), después los cuerpos
      for (const b of estado.sis.c) {
        const [px, py] = dibujo.aPx(b.x, b.y);
        const k = vPx();
        if (Math.hypot(p[0] - (px + b.vx * k), p[1] - (py - b.vy * k)) < tol) { arrastre = { tipo: 'velocidad', b }; break; }
      }
      if (!arrastre) {
        for (const b of estado.sis.c) {
          const [px, py] = dibujo.aPx(b.x, b.y);
          if (Math.hypot(p[0] - px, p[1] - py) < Math.max(tol, radioPx(b) + 6)) { arrastre = { tipo: 'mover', b }; break; }
        }
      }
    }
    if (arrastre) lienzo.setPointerCapture(e.pointerId);
  });

  lienzo.addEventListener('pointermove', (e) => {
    if (!arrastre) return;
    const p = punto(e);
    const b = arrastre.b;
    if (arrastre.tipo === 'mover') {
      [b.x, b.y] = dibujo.aMundo(...p);
      estado.estelas.set(b, []);
    } else {
      const [px, py] = dibujo.aPx(b.x, b.y);
      b.vx = (p[0] - px) / vPx();
      b.vy = -(p[1] - py) / vPx();
      arrastre.movio = arrastre.movio || Math.hypot(p[0] - px, p[1] - py) > 10;
    }
  });

  function soltar() {
    if (!arrastre) return;
    const { tipo, b } = arrastre;
    if (tipo === 'nuevo') {
      if (!arrastre.movio) circular(b);
      else { b.vx += centroDe(b).vx; b.vy += centroDe(b).vy; } // la velocidad dibujada, respecto del más pesado
      estado.corriendo = arrastre.corria;
      estado.agregando = false;
      $('agregar').setAttribute('aria-pressed', 'false');
      mostrarCuerpos();
      avisar(`${b.nombre} agregado${arrastre.movio ? '' : ' en órbita circular'}. Pueden cambiar su masa en la lista.`);
    }
    nuevaReferencia();
    arrastre = null;
  }
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);

  /** El cuerpo más pesado de todos los demás. */
  function centroDe(b) {
    return estado.sis.c.filter((x) => x !== b).reduce((a, x) => (x.m > a.m ? x : a), { m: 0, x: 0, y: 0, vx: 0, vy: 0 });
  }

  /** Órbita circular alrededor del cuerpo más pesado, en el mismo sentido en que giran los demás. */
  function circular(b) {
    const c = centroDe(b);
    if (!c.m) return;
    const dx = b.x - c.x, dy = b.y - c.y, r = Math.hypot(dx, dy);
    const v = Math.sqrt((G * (c.m + b.m)) / r);
    b.vx = c.vx - (dy / r) * v;
    b.vy = c.vy + (dx / r) * v;
  }

  // ---------- Dibujo ----------

  function disco(x, y, r, color) {
    const { ctx } = dibujo;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
    g.addColorStop(0, aclarar(color, 0.35));
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

  function anotarEstelas() {
    const minimo = 2.5 / dibujo.escala; // un punto cada ~2,5 px
    for (const b of estado.sis.c) {
      const e = estado.estelas.get(b) || [];
      const n = e.length;
      if (!n || (b.x - e[n - 2]) ** 2 + (b.y - e[n - 1]) ** 2 > minimo * minimo) e.push(b.x, b.y);
      if (e.length > 3000) e.splice(0, 200);
      estado.estelas.set(b, e);
    }
  }

  function dibujar() {
    const { ctx, c } = dibujo;
    ctx.clearRect(0, 0, dibujo.w, dibujo.h);
    // Estelas
    for (const b of estado.sis.c) {
      const e = estado.estelas.get(b);
      if (!e || e.length < 4) continue;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.4 * c.grosor;
      ctx.beginPath();
      let [px, py] = dibujo.aPx(e[0], e[1]);
      ctx.moveTo(px, py);
      for (let i = 2; i < e.length; i += 2) { [px, py] = dibujo.aPx(e[i], e[i + 1]); ctx.lineTo(px, py); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Centro de masa: una cruz tenue
    const cm = N.centroMasa(estado.sis);
    const [mx, my] = dibujo.aPx(cm.x, cm.y);
    ctx.strokeStyle = c.tenue;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mx - 5, my - 5); ctx.lineTo(mx + 5, my + 5);
    ctx.moveTo(mx + 5, my - 5); ctx.lineTo(mx - 5, my + 5);
    ctx.stroke();
    // Cuerpos y, en pausa, sus velocidades (con asa para arrastrarlas)
    for (const b of estado.sis.c) {
      const [px, py] = dibujo.aPx(b.x, b.y);
      const r = radioPx(b);
      disco(px, py, r, b.color);
      dibujo.texto(b.nombre, px + r + 4, py - r - 4, c.tenue, 'left', 0.85);
      if (!estado.corriendo || (arrastre && arrastre.b === b)) {
        const k = vPx();
        const x2 = px + b.vx * k, y2 = py - b.vy * k;
        dibujo.flecha(px, py, x2, y2, c.vel, 2);
        ctx.strokeStyle = c.vel;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(x2, y2, 8, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  }

  function mostrarVivo() {
    const s = estado.sis;
    const E = N.energia(s);
    const dE = estado.E0 ? Math.abs((E - estado.E0) / estado.E0) : 0;
    const pct = dE < 1e-7 ? 'menos de 0,00001 %' : fmt.decimal(100 * dE, 2) + ' %';
    $('vivo').innerHTML = `${fmt.decimal(s.t / DIA, 3)} días · energía: cambió ${pct}`;
    $('vivo').classList.toggle('l-mala', dE > 0.01);
  }

  // ---------- Tiempo ----------

  let antes = performance.now();
  let ultimoVivo = 0;
  function cuadro(ahora) {
    const dtReal = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    const s = estado.sis;
    if (estado.corriendo && s.c.length) {
      N.avanzar(s, (dtReal * escena().T * estado.tiempo) / 6, estado.metodo, estado.eta);
      if (s.eventos.length) {
        avisar(s.eventos.join(' '));
        s.eventos = [];
        for (const b of [...estado.estelas.keys()]) if (!s.c.includes(b)) estado.estelas.delete(b);
        nuevaReferencia();
        mostrarCuerpos();
      }
      anotarEstelas();
    }
    if (estado.seguir && s.c.length) {
      const cm = N.centroMasa(s);
      dibujo.centro = [cm.x, cm.y];
    }
    dibujar();
    if (ahora - ultimoVivo > 150) { mostrarVivo(); ultimoVivo = ahora; }
    requestAnimationFrame(cuadro);
  }

  // ---------- Inicio ----------

  window.addEventListener('resize', () => {
    const radio = dibujo.w ? dibujo.radioVisible() : escena().vista;
    dibujo.ajustar();
    dibujo.encuadrar(radio);
  });

  let tema = q.get('tema');
  if (!tema) { try { tema = localStorage.getItem('gravitacion.tema'); } catch (e) { /* sin almacenamiento */ } }
  if (tema === 'claro') {
    document.documentElement.classList.add('claro');
    document.querySelector('meta[name="theme-color"]').content = '#eef1f6';
  }
  if (q.get('desde') === 'artemis') { $('volver').href = 'artemis.html'; $('volver').textContent = '← Volver a Artemis II'; }
  dibujo.ajustar();
  dibujo.leerColores();
  cargar(estado.clave);
  requestAnimationFrame(cuadro);

  // Acceso para depurar desde la consola y para las pruebas
  window.libre = { estado, ESCENAS, cargar, ponerMasa };
})();
