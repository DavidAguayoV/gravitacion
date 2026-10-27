/*
 * mundos.js — Datos reales de los mundos (masa y radio medio).
 *
 * Fuentes: NASA Planetary Fact Sheets (Tierra, Luna, Marte, Mercurio, Júpiter, Europa, Titán, Deimos),
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
    titan:   { nombre: 'Titán',   M: 1.35e23,  R: 2.58e6,  color: '#c9a35a' },
    mercurio: { nombre: 'Mercurio', M: 3.30e23,  R: 2.44e6,  color: '#8f8780' },
    marte:   { nombre: 'Marte',   M: 6.42e23,  R: 3.39e6,  color: '#b8603e' },
    tierra:  { nombre: 'Tierra',  M: 5.97e24,  R: 6.37e6,  color: '#3f78b5' },
    jupiter: { nombre: 'Júpiter', M: 1.898e27, R: 6.99e7,  color: '#c49a6c' },
  };

  const { vCircular: vc, vEscape: ve } = Grav;

  /*
   * Situaciones listas para usar en clase. Salvo las que fijan un mundo, se arman sobre el
   * mundo elegido con SUS rapideces: v_c = √(GM/r) y v_e = √(2GM/r).
   *   sondas(m): lista de lanzamientos { h, v, angulo }
   *   vista:     radio (en múltiplos de R + h) que se encuadra al empezar
   *   reto:      false = se oculta en modo reto, porque regala la respuesta
   */
  Grav.SITUACIONES = {
    canon: {
      nombre: 'Cañón de Newton',
      mundo: 'tierra',
      // Desde una montaña a 400 km (la altura de la Estación Espacial): lenta, más rápida, órbita.
      sondas: (m) => [
        { h: 400e3, v: 4000, angulo: 0 },
        { h: 400e3, v: 6500, angulo: 0 },
        { h: 400e3, v: vc(m.M, m.R + 400e3), angulo: 0 },
      ],
      vista: 1.25,
      reto: true,
    },
    circular: {
      nombre: 'Órbita circular',
      sondas: (m) => [{ h: 0.1 * m.R, v: vc(m.M, 1.1 * m.R), angulo: 0 }],
      vista: 1.4,
      reto: false,
    },
    escape: {
      nombre: 'Velocidad de escape',
      // Desde la superficie, en cualquier dirección: la energía no depende del ángulo.
      sondas: (m) => [{ h: 0, v: ve(m.M, m.R), angulo: 60 }],
      vista: 3,
      reto: false,
    },
    eliptica: {
      nombre: 'Órbita elíptica',
      // 1,2 v_c: el punto más lejano queda a 1,44/0,56 ≈ 2,6 veces la distancia de partida.
      sondas: (m) => [{ h: 0.1 * m.R, v: 1.2 * vc(m.M, 1.1 * m.R), angulo: 0 }],
      vista: 2.9,
      reto: false,
    },
    cae: {
      nombre: 'Se cae',
      sondas: (m) => [{ h: 0.1 * m.R, v: 0.6 * vc(m.M, 1.1 * m.R), angulo: 0 }],
      vista: 1.4,
      reto: false,
    },
    sobra: {
      nombre: 'Escapa con sobra',
      sondas: (m) => [{ h: 0, v: 1.5 * ve(m.M, m.R), angulo: 60 }],
      vista: 3,
      reto: false,
    },
    deimos: {
      nombre: 'Salto en Deimos',
      mundo: 'deimos',
      // Un buen salto: 3 m/s hacia arriba. En Deimos v_e ≈ 5,6 m/s: sube unos 2,4 km y vuelve.
      sondas: () => [{ h: 0, v: 3, angulo: 90 }],
      vista: 1.6,
      reto: true,
    },
    bennu: {
      nombre: 'Salto en Bennu',
      mundo: 'bennu',
      // En Bennu v_e ≈ 0,20 m/s: el mismo salto de 3 m/s escapa con mucha sobra.
      sondas: () => [{ h: 0, v: 3, angulo: 90 }],
      vista: 3,
      mult: 100,
      reto: true,
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
