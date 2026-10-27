/*
 * mundos.js — Datos reales de los mundos (masa y radio medio).
 *
 * Fuentes: NASA Planetary Fact Sheets (Tierra, Luna, Marte, Júpiter, Europa, Deimos),
 * misión Dawn (radio de Ceres) y OSIRIS-REx (Bennu). Son los mismos valores de la
 * clase 08; Júpiter con su radio medio (69 911 km).
 */
(function (raiz) {
  'use strict';
  const Grav = (raiz.Grav = raiz.Grav || {});

  // color: tono del disco en el dibujo
  Grav.MUNDOS = {
    bennu:   { nombre: 'Bennu',   M: 7.33e10,  R: 245,     color: '#6f6a64' },
    deimos:  { nombre: 'Deimos',  M: 1.48e15,  R: 6.2e3,   color: '#8a7b6c' },
    ceres:   { nombre: 'Ceres',   M: 9.39e20,  R: 4.70e5,  color: '#8d8a86' },
    luna:    { nombre: 'Luna',    M: 7.35e22,  R: 1.74e6,  color: '#a7a6a2' },
    europa:  { nombre: 'Europa',  M: 4.80e22,  R: 1.561e6, color: '#c9b79a' },
    marte:   { nombre: 'Marte',   M: 6.42e23,  R: 3.39e6,  color: '#b8603e' },
    tierra:  { nombre: 'Tierra',  M: 5.97e24,  R: 6.37e6,  color: '#3f78b5' },
    jupiter: { nombre: 'Júpiter', M: 1.898e27, R: 6.99e7,  color: '#c49a6c' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
