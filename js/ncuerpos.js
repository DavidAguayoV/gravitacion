/*
 * ncuerpos.js — El motor del modo libre: N cuerpos que se atraen todos con todos.
 *
 * A diferencia de fisica.js (un mundo quieto y sondas sin masa), aquí cada cuerpo tiene masa
 * y se mueve. La aceleración del cuerpo i es la suma de lo que le hacen todos los demás:
 *     a_i = Σ_j  G m_j (r_j − r_i) / |r_j − r_i|³
 * Se avanza con RK4 o con Euler (para compararlos), con un paso que se acorta solo cuando
 * dos cuerpos se acercan. Si dos cuerpos se tocan, se funden en uno y se conserva el momentum.
 *
 * Este archivo no dibuja nada: se puede probar con Node.
 */
(function (raiz) {
  'use strict';
  const Grav = (raiz.Grav = raiz.Grav || {});
  const G = Grav.G || 6.67e-11;
  const MAX_SUBPASOS = 4000;

  /** Aceleraciones de todos los cuerpos con las posiciones px, py (arreglos). */
  function aceleraciones(c, px, py, ax, ay) {
    const n = c.length;
    for (let i = 0; i < n; i++) { ax[i] = 0; ay[i] = 0; }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = px[j] - px[i], dy = py[j] - py[i];
        const r2 = dx * dx + dy * dy;
        const k = G / (r2 * Math.sqrt(r2));
        // Tercera ley: la fuerza sobre i y sobre j es la misma, en sentidos opuestos
        ax[i] += k * c[j].m * dx; ay[i] += k * c[j].m * dy;
        ax[j] -= k * c[i].m * dx; ay[j] -= k * c[i].m * dy;
      }
    }
  }

  /** Un paso de Euler: avanza con la aceleración del comienzo, como si no cambiara. */
  function pasoEuler(sis, dt) {
    const c = sis.c, n = c.length;
    const x = c.map((b) => b.x), y = c.map((b) => b.y), ax = new Array(n), ay = new Array(n);
    aceleraciones(c, x, y, ax, ay);
    for (let i = 0; i < n; i++) {
      const b = c[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.vx += ax[i] * dt; b.vy += ay[i] * dt;
    }
  }

  /**
   * Un paso de RK4: cuatro mediciones de la aceleración (comienzo, dos a mitad de paso y final)
   * y un promedio con pesos 1, 2, 2, 1. Es el mismo esquema de fisica.js, para N cuerpos.
   */
  function pasoRK4(sis, dt) {
    const c = sis.c, n = c.length;
    const x0 = c.map((b) => b.x), y0 = c.map((b) => b.y), vx0 = c.map((b) => b.vx), vy0 = c.map((b) => b.vy);
    const k = []; // cada k: { vx, vy, ax, ay } (las pendientes de la posición y de la velocidad)
    const px = new Array(n), py = new Array(n);
    const etapas = [0, 0.5, 0.5, 1]; // dónde se mide cada pendiente, en fracciones del paso
    for (let e = 0; e < 4; e++) {
      const f = etapas[e] * dt, prev = k[e - 1];
      const vx = new Array(n), vy = new Array(n), ax = new Array(n), ay = new Array(n);
      for (let i = 0; i < n; i++) {
        px[i] = x0[i] + (prev ? f * prev.vx[i] : 0);
        py[i] = y0[i] + (prev ? f * prev.vy[i] : 0);
        vx[i] = vx0[i] + (prev ? f * prev.ax[i] : 0);
        vy[i] = vy0[i] + (prev ? f * prev.ay[i] : 0);
      }
      aceleraciones(c, px, py, ax, ay);
      k.push({ vx, vy, ax, ay });
    }
    const s = dt / 6;
    for (let i = 0; i < n; i++) {
      const b = c[i];
      b.x = x0[i] + s * (k[0].vx[i] + 2 * k[1].vx[i] + 2 * k[2].vx[i] + k[3].vx[i]);
      b.y = y0[i] + s * (k[0].vy[i] + 2 * k[1].vy[i] + 2 * k[2].vy[i] + k[3].vy[i]);
      b.vx = vx0[i] + s * (k[0].ax[i] + 2 * k[1].ax[i] + 2 * k[2].ax[i] + k[3].ax[i]);
      b.vy = vy0[i] + s * (k[0].ay[i] + 2 * k[1].ay[i] + 2 * k[2].ay[i] + k[3].ay[i]);
    }
  }

  /**
   * Largo del paso: una fracción eta del «tiempo orbital» √(r³/G(m_i + m_j)) del par más
   * apretado. Cuando dos cuerpos se acercan, el paso se acorta solo.
   */
  function pasoAdaptado(sis, eta) {
    const c = sis.c;
    let t = Infinity;
    for (let i = 0; i < c.length; i++) {
      for (let j = i + 1; j < c.length; j++) {
        const r = Math.hypot(c[j].x - c[i].x, c[j].y - c[i].y);
        t = Math.min(t, Math.sqrt((r * r * r) / (G * (c[i].m + c[j].m))));
      }
    }
    return eta * t;
  }

  /** Funde los cuerpos que se tocan: suma masas y momentum; el volumen también se suma. */
  function choques(sis) {
    const c = sis.c;
    for (let i = 0; i < c.length; i++) {
      for (let j = i + 1; j < c.length; j++) {
        const a = c[i], b = c[j];
        if (Math.hypot(b.x - a.x, b.y - a.y) > a.R + b.R) continue;
        const m = a.m + b.m;
        const [grande, chico] = a.m >= b.m ? [a, b] : [b, a];
        grande.x = (a.m * a.x + b.m * b.x) / m;
        grande.y = (a.m * a.y + b.m * b.y) / m;
        grande.vx = (a.m * a.vx + b.m * b.vx) / m;
        grande.vy = (a.m * a.vy + b.m * b.vy) / m;
        grande.R = Math.cbrt(a.R ** 3 + b.R ** 3);
        grande.m = m;
        sis.eventos.push(`${chico.nombre} chocó con ${grande.nombre} y se fundieron en uno.`);
        c.splice(c.indexOf(chico), 1);
        j = i; // se vuelve a revisar con la lista nueva
      }
    }
  }

  /** Avanza el sistema un tiempo T (s). metodo: 'rk4' | 'euler'. */
  function avanzar(sis, T, metodo, eta) {
    if (sis.c.length < 2) { for (const b of sis.c) { b.x += b.vx * T; b.y += b.vy * T; } sis.t += T; return; }
    const paso = metodo === 'euler' ? pasoEuler : pasoRK4;
    let resto = T, n = 0;
    while (resto > 0 && n < MAX_SUBPASOS) {
      const dt = Math.min(resto, pasoAdaptado(sis, eta));
      paso(sis, dt);
      sis.t += dt;
      resto -= dt;
      n++;
      choques(sis);
      if (sis.c.length < 2) break;
    }
    sis.subpasos = n;
  }

  /** Energía total: K = Σ ½ m v² y U = −Σ G m_i m_j / r_ij (cada par una vez). */
  function energia(sis) {
    const c = sis.c;
    let K = 0, U = 0;
    for (let i = 0; i < c.length; i++) {
      K += 0.5 * c[i].m * (c[i].vx ** 2 + c[i].vy ** 2);
      for (let j = i + 1; j < c.length; j++) U -= (G * c[i].m * c[j].m) / Math.hypot(c[j].x - c[i].x, c[j].y - c[i].y);
    }
    return K + U;
  }

  /** Centro de masa y su velocidad. */
  function centroMasa(sis) {
    let m = 0, x = 0, y = 0, vx = 0, vy = 0;
    for (const b of sis.c) { m += b.m; x += b.m * b.x; y += b.m * b.y; vx += b.m * b.vx; vy += b.m * b.vy; }
    return m ? { x: x / m, y: y / m, vx: vx / m, vy: vy / m, m } : { x: 0, y: 0, vx: 0, vy: 0, m: 0 };
  }

  /** Lleva el sistema al marco del centro de masa (CM quieto en el origen). */
  function alCentro(sis) {
    const cm = centroMasa(sis);
    for (const b of sis.c) { b.x -= cm.x; b.y -= cm.y; b.vx -= cm.vx; b.vy -= cm.vy; }
  }

  function crear(cuerpos) {
    return { c: cuerpos.map((b) => ({ ...b })), t: 0, eventos: [], subpasos: 0 };
  }

  Grav.NCuerpos = { crear, avanzar, energia, centroMasa, alCentro, pasoAdaptado, pasoRK4, pasoEuler };
})(typeof window !== 'undefined' ? window : globalThis);
