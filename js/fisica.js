/*
 * fisica.js — El motor: gravitación de Newton integrada con Runge-Kutta de orden 4.
 *
 * Todo en unidades SI: metros, segundos, kilogramos, newtons y joules.
 * El mundo (masa M, radio R) está quieto en el origen (0, 0). La sonda no lo mueve:
 * su masa es despreciable frente a M. Cada sonda se integra por separado y las
 * sondas no se atraen entre ellas.
 *
 * Ecuación que se resuelve (la misma de la clase 08):
 *     F = −(G M m / r²) r̂      →      a = F/m = −G M (x, y) / r³
 *
 * Este archivo no dibuja nada ni toca la página: se puede probar solo con Node
 * (ver tests/verificar.js).
 */
(function (raiz) {
  'use strict';
  const Grav = (raiz.Grav = raiz.Grav || {});

  // Constante de gravitación universal, N·m²/kg² (el valor que usa la clase).
  const G = 6.67e-11;

  // El subpaso es una fracción ETA del «tiempo orbital» √(r³/GM) en la posición actual.
  // Con 0,004 una órbita circular toma unos 1600 subpasos: cerca del mundo, donde la
  // sonda va rápido, los pasos se achican solos; lejos, se alargan.
  const ETA = 0.004;
  // Tope de subpasos por llamada, para que un cuadro nunca congele la página.
  const MAX_SUBPASOS = 20000;
  // Una sonda que escapó se congela al pasar 1000 veces la distancia de partida.
  const LEJOS = 1000;

  /** Aceleración gravitacional en el punto (x, y): a = −GM (x, y) / r³. */
  function aceleracion(x, y, GM) {
    const r2 = x * x + y * y;
    const r = Math.sqrt(r2);
    const k = -GM / (r2 * r);
    return [k * x, k * y];
  }

  /**
   * Un paso de RK4 de duración dt para el estado (x, y, vx, vy).
   * Se evalúan cuatro «pendientes» (k1…k4) y se promedian con pesos 1, 2, 2, 1.
   * La derivada de la posición es la velocidad; la de la velocidad, la aceleración.
   */
  function pasoRK4(s, dt, GM) {
    const x = s.x, y = s.y, vx = s.vx, vy = s.vy;

    // k1: al inicio del paso
    const a1 = aceleracion(x, y, GM);

    // k2: a mitad del paso, avanzando con k1
    const vx2 = vx + 0.5 * dt * a1[0];
    const vy2 = vy + 0.5 * dt * a1[1];
    const a2 = aceleracion(x + 0.5 * dt * vx, y + 0.5 * dt * vy, GM);

    // k3: a mitad del paso, avanzando con k2
    const vx3 = vx + 0.5 * dt * a2[0];
    const vy3 = vy + 0.5 * dt * a2[1];
    const a3 = aceleracion(x + 0.5 * dt * vx2, y + 0.5 * dt * vy2, GM);

    // k4: al final del paso, avanzando con k3
    const vx4 = vx + dt * a3[0];
    const vy4 = vy + dt * a3[1];
    const a4 = aceleracion(x + dt * vx3, y + dt * vy3, GM);

    // Promedio ponderado
    const c = dt / 6;
    s.x += c * (vx + 2 * vx2 + 2 * vx3 + vx4);
    s.y += c * (vy + 2 * vy2 + 2 * vy3 + vy4);
    s.vx += c * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]);
    s.vy += c * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
  }

  /** Rapidez de una órbita circular de radio r: v = √(GM/r). */
  function vCircular(M, r) {
    return Math.sqrt((G * M) / r);
  }

  /** Velocidad de escape desde la distancia r: v = √(2GM/r). */
  function vEscape(M, r) {
    return Math.sqrt((2 * G * M) / r);
  }

  /** Energías de la sonda: K = ½mv², U = −GMm/r y E = K + U (en joules). */
  function energias(s, M) {
    const r = Math.hypot(s.x, s.y);
    const K = 0.5 * s.m * (s.vx * s.vx + s.vy * s.vy);
    const U = (-G * M * s.m) / r;
    return { K, U, E: K + U };
  }

  /**
   * Crea una sonda lista para lanzar desde lo alto del mundo (las 12 en punto).
   *   h      altura sobre la superficie (m)
   *   v      rapidez (m/s)
   *   angulo grados desde la horizontal local: 0 = hacia la derecha, 90 = hacia arriba
   *   m      masa de la sonda (kg)
   */
  function crearSonda(mundo, h, v, angulo, m) {
    const rad = (angulo * Math.PI) / 180;
    const r0 = mundo.R + h;
    const s = {
      x: 0, y: r0,
      vx: v * Math.cos(rad), vy: v * Math.sin(rad),
      m,
      t: 0,                 // tiempo de vuelo (s)
      estado: 'vuelo',      // 'vuelo' | 'impacto' | 'escapo' | 'lejos'
      lanzamiento: { h, v, angulo, m },
      r0,
      rMin: r0, rMax: r0,   // distancias extremas al centro
      barrido: 0,           // ángulo recorrido alrededor del centro (rad)
      vueltas: 0,
      circular: null,       // tras la 1.ª vuelta: true si r casi no cambió
      vImpacto: 0,
      estela: [0, r0],      // puntos de la trayectoria: x0, y0, x1, y1, …
    };
    return s;
  }

  /** Guarda un punto de la estela si la sonda se movió lo suficiente desde el anterior. */
  function anotarEstela(s, r) {
    const e = s.estela;
    const dx = s.x - e[e.length - 2];
    const dy = s.y - e[e.length - 1];
    if (dx * dx + dy * dy < (0.006 * r) ** 2) return;
    e.push(s.x, s.y);
    // Si la estela crece demasiado, se queda con uno de cada dos puntos.
    if (e.length > 12000) {
      const menos = [];
      for (let i = 0; i < e.length; i += 4) menos.push(e[i], e[i + 1]);
      s.estela = menos;
    }
  }

  /**
   * Avanza la sonda un tiempo T (s) con tantos subpasos como haga falta.
   * Además detecta el choque con la superficie, cuenta las vueltas y decide si escapó.
   */
  function avanzar(s, mundo, T) {
    if (s.estado === 'impacto' || s.estado === 'lejos') return;
    const GM = G * mundo.M;
    let resto = T;
    let n = 0;
    while (resto > 0 && n < MAX_SUBPASOS) {
      const r = Math.hypot(s.x, s.y);
      const dt = Math.min(resto, ETA * Math.sqrt((r * r * r) / GM));
      const xa = s.x, ya = s.y, vxa = s.vx, vya = s.vy; // estado al inicio del subpaso
      pasoRK4(s, dt, GM);
      s.t += dt;
      resto -= dt;
      n++;

      const rn = Math.hypot(s.x, s.y);

      // ¿Chocó? Se busca dónde cruzó la superficie dentro del último subpaso.
      if (rn <= mundo.R) {
        const f = (r - mundo.R) / (r - rn); // 0 = inicio del subpaso, 1 = final
        const px = xa + f * (s.x - xa);
        const py = ya + f * (s.y - ya);
        const pr = Math.hypot(px, py);
        s.x = (px / pr) * mundo.R;
        s.y = (py / pr) * mundo.R;
        s.t -= (1 - f) * dt;
        // Rapidez al tocar el suelo, por conservación de la energía: ½v² − GM/R = E/m
        const e = energias({ x: xa, y: ya, vx: vxa, vy: vya, m: 1 }, mundo.M).E;
        s.vImpacto = Math.sqrt(Math.max(0, 2 * (e + GM / mundo.R)));
        s.vx = 0;
        s.vy = 0;
        s.estado = 'impacto';
        s.estela.push(s.x, s.y);
        return;
      }

      // Ángulo barrido alrededor del centro en este subpaso (con signo).
      s.barrido += Math.atan2(xa * s.y - ya * s.x, xa * s.x + ya * s.y);
      if (rn < s.rMin) s.rMin = rn;
      if (rn > s.rMax) s.rMax = rn;
      if (Math.abs(s.barrido) >= 2 * Math.PI * (s.vueltas + 1)) {
        s.vueltas++;
        if (s.circular === null) s.circular = (s.rMax - s.rMin) / (s.rMax + s.rMin) < 0.01;
      }

      anotarEstela(s, rn);

      // ¿Escapó? Energía total ≥ 0 y alejándose. Se anuncia cuando ya está lejos
      // (10 veces la distancia de partida), para que se vea el viaje.
      if (s.estado === 'vuelo' && rn > 10 * s.r0) {
        const eM = 0.5 * (s.vx * s.vx + s.vy * s.vy) - GM / rn; // energía por kg
        const vr = (s.x * s.vx + s.y * s.vy) / rn;               // rapidez radial
        if (eM >= -1e-7 * (GM / s.r0) && vr > 0) s.estado = 'escapo';
      }
      if (s.estado === 'escapo' && rn > LEJOS * s.r0) {
        s.estado = 'lejos';
        return;
      }
    }
  }

  /**
   * Clasifica la energía total respecto de la «profundidad del pozo» en la partida, GMm/r0:
   * 'ligada' (E < 0), 'limite' (E ≈ 0) o 'libre' (E > 0).
   */
  function tipoEnergia(E, s, M) {
    const escala = (G * M * s.m) / s.r0;
    if (Math.abs(E) < 0.002 * escala) return 'limite';
    return E < 0 ? 'ligada' : 'libre';
  }

  /**
   * Energía más grande (en valor absoluto) que puede tener K o U durante el vuelo.
   * Sirve para fijar la escala de las barras en todo el lanzamiento.
   * Se calcula con la distancia mínima de la cónica (perigeo), o R si choca antes.
   */
  function escalaEnergia(s, mundo) {
    const GM = G * mundo.M;
    const { lanzamiento: L, r0 } = s;
    const rad = (L.angulo * Math.PI) / 180;
    const e = 0.5 * L.v * L.v - GM / r0;                 // energía por kg
    const hM = r0 * L.v * Math.cos(rad);                  // momento angular por kg, r × v
    // Perigeo: donde la rapidez radial se anula, raíz menor de  e r² + GM r − h²/2 = 0
    let rp;
    if (Math.abs(e) < 1e-12 * (GM / r0)) rp = (hM * hM) / (2 * GM);
    else rp = (-GM + Math.sqrt(GM * GM + 2 * e * hM * hM)) / (2 * e);
    if (!(rp > 0) || rp > r0) rp = r0;
    const rMin = Math.max(mundo.R, rp);
    const U = (GM * L.m) / rMin;
    return Math.max(U, e * L.m + U);
  }

  Object.assign(Grav, {
    G, aceleracion, pasoRK4, avanzar, crearSonda,
    vCircular, vEscape, energias, tipoEnergia, escalaEnergia,
  });
})(typeof window !== 'undefined' ? window : globalThis);
