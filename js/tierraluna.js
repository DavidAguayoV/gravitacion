/*
 * tierraluna.js — El motor de la misión final: una sonda entre la Tierra y la Luna.
 *
 * La Tierra y la Luna giran en círculos alrededor de su centro de masa (el baricentro, en el
 * origen), una vuelta cada 27,4 días. La sonda siente las dos atracciones a la vez:
 *     a = −GM_T (r − r_T)/|r − r_T|³ − GM_L (r − r_L)/|r − r_L|³
 * y se integra con RK4, como en fisica.js. La sonda no mueve a ninguna de las dos.
 *
 * La sonda parte desde una órbita baja, a la izquierda de la Tierra, con una velocidad
 * horizontal hacia abajo (en el mismo sentido en que gira la Luna). El grupo elige la
 * rapidez y dónde está la Luna en ese momento (su ángulo, medido desde el punto de partida).
 *
 * Este archivo no dibuja nada: se puede probar con Node.
 */
(function (raiz) {
  'use strict';
  const Grav = (raiz.Grav = raiz.Grav || {});
  const G = Grav.G || 6.67e-11;

  const MT = 5.97e24, RT = 6.37e6;   // Tierra
  const ML = 7.35e22, RL = 1.74e6;   // Luna
  const D = 3.844e8;                 // distancia Tierra–Luna (m)
  const H0 = 185e3;                  // altura de la órbita de partida (m)
  const ATMOSFERA = 120e3;           // bajo esta altura, la sonda vuelve a entrar al aire
  const GMT = G * MT, GML = G * ML;
  const W = Math.sqrt((G * (MT + ML)) / D ** 3); // rapidez angular de la Luna (rad/s)
  const MU = ML / (MT + ML);
  const ETA = 0.004;
  const MAX_SUBPASOS = 40000;
  const DIA = 86400;
  const FIN = 30 * DIA;              // pasado un mes sin novedad, se da por perdida

  /** Posición y velocidad de la Tierra y la Luna en el tiempo t, con la Luna en el ángulo th0 al partir. */
  function cuerpos(t, th0) {
    const th = th0 + W * t;
    const c = Math.cos(th), s = Math.sin(th);
    const rt = MU * D, rl = (1 - MU) * D;
    return {
      xt: -rt * c, yt: -rt * s, vxt: rt * W * s, vyt: -rt * W * c,
      xl: rl * c, yl: rl * s, vxl: -rl * W * s, vyl: rl * W * c,
    };
  }

  function aceleracion(x, y, t, th0) {
    const b = cuerpos(t, th0);
    const dxt = x - b.xt, dyt = y - b.yt, dxl = x - b.xl, dyl = y - b.yl;
    const rt2 = dxt * dxt + dyt * dyt, rl2 = dxl * dxl + dyl * dyl;
    const kt = -GMT / (rt2 * Math.sqrt(rt2)), kl = -GML / (rl2 * Math.sqrt(rl2));
    return [kt * dxt + kl * dxl, kt * dyt + kl * dyl];
  }

  function pasoRK4(s, dt) {
    const { x, y, vx, vy, t } = s, th0 = s.th0;
    const a1 = aceleracion(x, y, t, th0);
    const vx2 = vx + 0.5 * dt * a1[0], vy2 = vy + 0.5 * dt * a1[1];
    const a2 = aceleracion(x + 0.5 * dt * vx, y + 0.5 * dt * vy, t + 0.5 * dt, th0);
    const vx3 = vx + 0.5 * dt * a2[0], vy3 = vy + 0.5 * dt * a2[1];
    const a3 = aceleracion(x + 0.5 * dt * vx2, y + 0.5 * dt * vy2, t + 0.5 * dt, th0);
    const vx4 = vx + dt * a3[0], vy4 = vy + dt * a3[1];
    const a4 = aceleracion(x + dt * vx3, y + dt * vy3, t + dt, th0);
    const c = dt / 6;
    s.x += c * (vx + 2 * vx2 + 2 * vx3 + vx4);
    s.y += c * (vy + 2 * vy2 + 2 * vy3 + vy4);
    s.vx += c * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]);
    s.vy += c * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
    s.t += dt;
  }

  /**
   * Sonda lista para partir.
   *   v       rapidez respecto de la Tierra (m/s), en la órbita baja de partida
   *   angulo  dónde está la Luna al partir, en grados, medido desde el punto de partida
   *           en el sentido en que gira (180° = la Luna justo al otro lado de la Tierra)
   */
  function crear(v, angulo) {
    const th0 = Math.PI + (angulo * Math.PI) / 180; // la partida está a la izquierda (ángulo π)
    const b = cuerpos(0, th0);
    const r0 = RT + H0;
    const s = {
      x: b.xt - r0, y: b.yt, vx: b.vxt, vy: b.vyt - v, t: 0, th0,
      lanzamiento: { v, angulo },
      estado: 'vuelo',   // 'vuelo' | 'tierra' (volvió y entró al aire) | 'luna' (chocó) | 'perdida'
      salio: false,      // ya se alejó de la Tierra (para no contar la partida como regreso)
      dLmin: Infinity,   // distancia mínima al centro de la Luna
      tLmin: 0,
      detras: false,     // en el momento más cercano, ¿estaba más lejos de la Tierra que la Luna?
      rTmax: r0,         // lo más lejos que llegó de la Tierra
      rTmin: Infinity,   // lo más cerca que volvió a pasar de la Tierra, después de salir
      desfase: 0,        // en el momento más cercano a la Luna, cuánto iba ella adelante (rad, vista desde la Tierra)
      estela: [],        // trayectoria vista desde el baricentro, con el tiempo: x0, y0, t0, x1, y1, t1, …
      estelaLuna: [],    // la parte cercana a la Luna, vista desde la Luna (para la lupa)
    };
    s.estela.push(s.x, s.y, 0);
    return s;
  }

  /** Avanza la sonda un tiempo T (s) y anota lo que hace falta para juzgarla. */
  function avanzar(s, T) {
    if (s.estado !== 'vuelo') return;
    let resto = T, n = 0;
    while (resto > 0 && n < MAX_SUBPASOS) {
      let b = cuerpos(s.t, s.th0);
      const rt = Math.hypot(s.x - b.xt, s.y - b.yt), rl = Math.hypot(s.x - b.xl, s.y - b.yl);
      const dt = Math.min(resto, ETA * Math.min(Math.sqrt(rt ** 3 / GMT), Math.sqrt(rl ** 3 / GML)));
      pasoRK4(s, dt);
      resto -= dt;
      n++;

      b = cuerpos(s.t, s.th0);
      const dT = Math.hypot(s.x - b.xt, s.y - b.yt), dL = Math.hypot(s.x - b.xl, s.y - b.yl);
      if (dT > 10 * RT) s.salio = true;
      if (dT > s.rTmax) s.rTmax = dT;
      if (s.salio && dT < s.rTmin) s.rTmin = dT;
      if (dL < s.dLmin) {
        s.dLmin = dL;
        s.tLmin = s.t;
        s.detras = dT > Math.hypot(b.xl - b.xt, b.yl - b.yt);
        const d = Math.atan2(b.yl - b.yt, b.xl - b.xt) - Math.atan2(s.y - b.yt, s.x - b.xt);
        s.desfase = Math.atan2(Math.sin(d), Math.cos(d));
      }
      anotarEstela(s, dT, dL, b);
      if (dL <= RL) { s.estado = 'luna'; s.estela.push(s.x, s.y, s.t); return; }
      if (s.salio && dT <= RT + ATMOSFERA) { s.estado = 'tierra'; s.estela.push(s.x, s.y, s.t); return; }
      if (dT < RT) { s.estado = 'tierra'; return; } // nunca salió: cayó antes de dejar la órbita
      if (s.t > FIN || dT > 4 * D) { s.estado = 'perdida'; return; }
    }
  }

  function anotarEstela(s, dT, dL, b) {
    const e = s.estela;
    const dx = s.x - e[e.length - 3], dy = s.y - e[e.length - 2];
    // Cerca de la Tierra o de la Luna los puntos van más juntos, para que las curvas se vean suaves
    const paso = Math.max(1e5, Math.min(2.5e6, 0.02 * Math.min(dT, dL)));
    if (dx * dx + dy * dy >= paso * paso) e.push(s.x, s.y, s.t);
    if (e.length > 24000) s.estela = e.filter((_, i) => i % 6 < 3); // uno de cada dos puntos
    if (dL < 2e8) {
      const l = s.estelaLuna, x = s.x - b.xl, y = s.y - b.yl;
      const pasoL = Math.max(3e4, 0.02 * dL);
      if (!l.length || (x - l[l.length - 2]) ** 2 + (y - l[l.length - 1]) ** 2 >= pasoL * pasoL) l.push(x, y);
    }
  }

  Grav.TierraLuna = {
    MT, RT, ML, RL, D, H0, ATMOSFERA, GMT, GML, W, MU, DIA,
    cuerpos, crear, avanzar,
    vCircular0: Math.sqrt(GMT / (RT + H0)),
    vEscape0: Math.sqrt((2 * GMT) / (RT + H0)),
  };
})(typeof window !== 'undefined' ? window : globalThis);
