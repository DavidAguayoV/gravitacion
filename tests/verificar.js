/*
 * verificar.js — Pruebas del motor físico, sin navegador.
 * Uso:  node tests/verificar.js
 *
 * Cada prueba compara la simulación con lo que dice la física de la clase 08.
 */
'use strict';
require('../js/fisica.js');
require('../js/mundos.js');
const { G, MUNDOS, crearSonda, avanzar, energias, vCircular, vEscape } = globalThis.Grav;

let fallas = 0;
function revisar(nombre, ok, detalle) {
  console.log(`${ok ? 'ok   ' : 'FALLA'}  ${nombre}${detalle ? '  — ' + detalle : ''}`);
  if (!ok) fallas++;
}
const pct = (x) => (100 * x).toFixed(5) + ' %';

const tierra = MUNDOS.tierra;

// 1. g en la superficie de la Tierra: GM/R² ≈ 9,81 m/s²
{
  const g = (G * tierra.M) / tierra.R ** 2;
  revisar('g en la Tierra ≈ 9,81 m/s²', Math.abs(g - 9.81) < 0.01, g.toFixed(3) + ' m/s²');
}

// 2. Tabla «Otros mundos» de la clase: v_e = √(2GM/R)
{
  const tabla = { ceres: 520, luna: 2.4e3, marte: 5.0e3, tierra: 11.2e3, jupiter: 60e3 };
  for (const [k, ve] of Object.entries(tabla)) {
    const v = vEscape(MUNDOS[k].M, MUNDOS[k].R);
    revisar(`v_e de ${MUNDOS[k].nombre} ≈ ${ve} m/s`, Math.abs(v - ve) / ve < 0.02, v.toFixed(0) + ' m/s');
  }
}

// 3. Órbita circular a 400 km: r constante por 10 vueltas y deriva de energía < 0,1 %
{
  const h = 400e3;
  const r0 = tierra.R + h;
  const s = crearSonda(tierra, h, vCircular(tierra.M, r0), 0, 100);
  const E0 = energias(s, tierra.M).E;
  const T = 2 * Math.PI * Math.sqrt(r0 ** 3 / (G * tierra.M));
  let desvio = 0;
  let derivaE = 0;
  // Se avanza en trozos de 1/60 de período, como hace la página a velocidad alta.
  for (let i = 0; i < 600; i++) {
    avanzar(s, tierra, T / 60);
    const r = Math.hypot(s.x, s.y);
    desvio = Math.max(desvio, Math.abs(r - r0) / r0);
    derivaE = Math.max(derivaE, Math.abs((energias(s, tierra.M).E - E0) / E0));
  }
  revisar('órbita circular: 10 vueltas completas', s.vueltas === 10, `${s.vueltas} vueltas`);
  revisar('órbita circular: r constante (< 0,01 %)', desvio < 1e-4, 'desvío máx. ' + pct(desvio));
  revisar('órbita circular: deriva de energía < 0,1 %', derivaE < 1e-3, pct(derivaE));
  revisar('órbita circular: se detecta como circular', s.circular === true);
  revisar('órbita circular: período ≈ 92,6 min', Math.abs(T / 60 - 92.6) < 0.5, (T / 60).toFixed(1) + ' min');
}

// 4. Con v = v_e: E ≈ 0 y la sonda no vuelve (vertical y horizontal)
for (const angulo of [90, 0]) {
  const s = crearSonda(tierra, 0, vEscape(tierra.M, tierra.R), angulo, 100);
  const { E, U } = energias(s, tierra.M);
  revisar(`v = v_e (${angulo}°): E ≈ 0`, Math.abs(E / U) < 1e-12, 'E/|U| = ' + (E / Math.abs(U)).toExponential(1));
  let rAnt = Math.hypot(s.x, s.y);
  let vuelve = false;
  for (let i = 0; i < 4000 && s.estado !== 'lejos'; i++) {
    avanzar(s, tierra, 600);
    const r = Math.hypot(s.x, s.y);
    if (angulo === 90 && r < rAnt) vuelve = true;
    if (s.estado === 'impacto') vuelve = true;
    rAnt = r;
  }
  revisar(`v = v_e (${angulo}°): no vuelve y escapa`, !vuelve && (s.estado === 'escapo' || s.estado === 'lejos'), s.estado);
}

// 5. Un poco menos que v_e: sube y vuelve a caer
{
  const s = crearSonda(tierra, 0, 0.9 * vEscape(tierra.M, tierra.R), 90, 100);
  for (let i = 0; i < 5000 && s.estado === 'vuelo'; i++) avanzar(s, tierra, 60);
  // Altura máxima por energía: 1/r_max = 1/R − v²/(2GM)
  const v = 0.9 * vEscape(tierra.M, tierra.R);
  const rMax = 1 / (1 / tierra.R - v * v / (2 * G * tierra.M));
  revisar('0,9 v_e vertical: cae de vuelta', s.estado === 'impacto', s.estado);
  revisar('0,9 v_e vertical: r_max como dice la energía', Math.abs(s.rMax - rMax) / rMax < 1e-4,
    `${(s.rMax / 1e3).toFixed(0)} km vs ${(rMax / 1e3).toFixed(0)} km`);
  revisar('0,9 v_e vertical: choca con la rapidez de partida', Math.abs(s.vImpacto - v) / v < 1e-3,
    (s.vImpacto / 1e3).toFixed(2) + ' km/s');
}

// 6. Deimos: un salto de 3 m/s sube y vuelve; v_e ≈ 5,6 m/s
{
  const d = MUNDOS.deimos;
  const ve = vEscape(d.M, d.R);
  revisar('Deimos: v_e ≈ 5,6 m/s', Math.abs(ve - 5.6) < 0.1, ve.toFixed(2) + ' m/s');
  const s = crearSonda(d, 0, 3, 90, 60);
  for (let i = 0; i < 2000 && s.estado === 'vuelo'; i++) avanzar(s, d, 10);
  revisar('Deimos: salto de 3 m/s vuelve al suelo', s.estado === 'impacto',
    `sube ${((s.rMax - d.R) / 1e3).toFixed(2)} km, vuelo de ${(s.t / 60).toFixed(0)} min`);
}

// 7. Bennu: un salto de 3 m/s escapa
{
  const b = MUNDOS.bennu;
  const s = crearSonda(b, 0, 3, 90, 60);
  for (let i = 0; i < 4000 && s.estado === 'vuelo'; i++) avanzar(s, b, 10);
  revisar('Bennu: salto de 3 m/s escapa', s.estado === 'escapo' || s.estado === 'lejos',
    `v_e = ${vEscape(b.M, b.R).toFixed(3)} m/s`);
}

// 8. Signos: la fuerza apunta al centro y U < 0
{
  const s = crearSonda(tierra, 1000e3, 5000, 30, 100);
  const a = globalThis.Grav.aceleracion(s.x, s.y, G * tierra.M);
  revisar('la aceleración apunta al centro', a[0] * s.x + a[1] * s.y < 0);
  revisar('U < 0 y K > 0', energias(s, tierra.M).U < 0 && energias(s, tierra.M).K > 0);
}

// 9. Tierra–Luna (misión final): con la Tierra y la Luna girando, lo que se conserva es la
//    «energía de Jacobi», E − ωL (por kilo). La solución mostrada rodea la Luna por detrás y vuelve.
{
  require('../js/tierraluna.js');
  const TL = globalThis.Grav.TierraLuna;
  const jacobi = (s) => {
    const b = TL.cuerpos(s.t, s.th0);
    const r1 = Math.hypot(s.x - b.xt, s.y - b.yt), r2 = Math.hypot(s.x - b.xl, s.y - b.yl);
    return 0.5 * (s.vx ** 2 + s.vy ** 2) - TL.GMT / r1 - TL.GML / r2 - TL.W * (s.x * s.vy - s.y * s.vx);
  };
  const s = TL.crear(10950, 128);
  const J0 = jacobi(s);
  let dJ = 0;
  while (s.estado === 'vuelo') {
    TL.avanzar(s, 3600);
    if (s.estado === 'vuelo') dJ = Math.max(dJ, Math.abs((jacobi(s) - J0) / J0));
  }
  revisar('Tierra–Luna: la energía de Jacobi se conserva (< 0,01 %)', dJ < 1e-4, pct(dJ));
  revisar('Tierra–Luna: 10,95 km/s con la Luna a 128° rodea la Luna por detrás y vuelve',
    s.estado === 'tierra' && s.detras && s.dLmin < 6e7,
    `${((s.dLmin - TL.RL) / 1e3).toFixed(0)} km sobre la Luna, ${(s.t / 86400).toFixed(1)} días`);
}

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : '\nTodas las pruebas pasan.');
process.exit(fallas ? 1 : 0);
