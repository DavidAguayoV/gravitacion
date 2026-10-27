/*
 * formato.js — Números legibles en español: coma decimal, notación científica
 * con potencias de diez y la unidad que corresponda a cada tamaño.
 */
(function (raiz) {
  'use strict';
  const Grav = (raiz.Grav = raiz.Grav || {});

  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

  /** Número con c cifras significativas y coma decimal; separa miles con un espacio fino. */
  function decimal(x, c = 3) {
    if (x === 0) return '0';
    const dec = Math.max(0, c - 1 - Math.floor(Math.log10(Math.abs(x))));
    let t = x.toFixed(Math.min(dec, 8));
    let [ent, fr] = t.split('.');
    ent = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return fr ? ent + ',' + fr : ent;
  }

  /**
   * Número en notación científica si es muy grande o muy chico.
   * html = true devuelve la potencia con <sup> (para el panel); si no, con superíndices
   * Unicode (para el lienzo).
   */
  function numero(x, c = 3, html = false) {
    if (!isFinite(x)) return '—';
    const a = Math.abs(x);
    if (a === 0 || (a >= 0.01 && a < 1e5)) return decimal(x, c);
    let exp = Math.floor(Math.log10(a));
    let man = x / 10 ** exp;
    // 9,999 redondeado a 3 cifras es 10,0: se corre la potencia
    if (Math.abs(Number(man.toFixed(c - 1))) >= 10) { man /= 10; exp += 1; }
    const m = man.toFixed(c - 1).replace('.', ',');
    const p = html ? `<sup>${exp}</sup>` : String(exp).split('').map((d) => SUP[d]).join('');
    return `${m} × 10${p}`;
  }

  /** Distancia en m o km según el tamaño. */
  function distancia(m, html = false) {
    if (Math.abs(m) < 1000) return decimal(m, 3) + ' m';
    return numero(m / 1000, 3, html) + ' km';
  }

  /** Rapidez en m/s o km/s según el tamaño. */
  function rapidez(v, html = false) {
    if (Math.abs(v) < 1000) return numero(v, 3, html) + ' m/s';
    return numero(v / 1000, 3, html) + ' km/s';
  }

  /** Duración en s, min, h o días. */
  function tiempo(t) {
    if (t < 120) return decimal(t, t < 10 ? 2 : 3) + ' s';
    if (t < 7200) return decimal(t / 60, 3) + ' min';
    if (t < 172800) return decimal(t / 3600, 3) + ' h';
    return decimal(t / 86400, 3) + ' días';
  }

  /**
   * Lee un número escrito por una persona: acepta coma o punto decimal, «5,97e24»,
   * «5,97 × 10^24», «5,97x10^24» y «5,97·10²⁴». Devuelve NaN si no entiende.
   */
  function leer(texto) {
    let t = String(texto).trim().replace(/\s| /g, '');
    const desdeSup = { '⁻': '-', '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
    t = t.replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (s) => '^' + s.split('').map((d) => desdeSup[d]).join(''));
    t = t.replace(',', '.').replace(/[×x*·]10\^?/i, 'e').replace(/\^/g, '');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
    return Number(t);
  }

  Object.assign(Grav, { fmt: { decimal, numero, distancia, rapidez, tiempo, leer } });
})(typeof window !== 'undefined' ? window : globalThis);
