/*
 * dibujo.js — Todo lo que se pinta en el lienzo (Canvas 2D).
 *
 * El mundo está en el centro del lienzo. La vista guarda cuántos píxeles mide un metro
 * (escala) y el dibujo usa siempre la MISMA escala en x y en y: si no, los vectores
 * apuntarían a ángulos falsos.
 * En el mundo, y crece hacia arriba; en el lienzo, hacia abajo. aPx() hace el cambio.
 */
(function (raiz) {
  'use strict';
  const Grav = (raiz.Grav = raiz.Grav || {});
  const { fmt } = Grav;

  class Dibujo {
    constructor(lienzo) {
      this.lienzo = lienzo;
      this.ctx = lienzo.getContext('2d');
      this.w = 0;
      this.h = 0;
      this.escala = 1; // píxeles por metro
      this.leerColores();
    }

    /** Lee la paleta desde las variables CSS (cambia con el modo proyector). */
    leerColores() {
      const css = getComputedStyle(document.documentElement);
      const v = (n) => css.getPropertyValue(n).trim();
      this.c = {
        tinta: v('--ink'), tenue: v('--muted'), linea: v('--line'),
        fuerza: v('--vec'), vel: v('--vel'), acento: v('--acc'),
        fuente: v('--body'), serif: v('--serif'), mono: v('--mono'),
        grosor: parseFloat(v('--grosor')) || 1,
        letra: parseFloat(v('--letra-lienzo')) || 13,
      };
    }

    /** Ajusta el lienzo a su tamaño en pantalla, con la densidad de píxeles del dispositivo. */
    ajustar() {
      const caja = this.lienzo.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.w = caja.width;
      this.h = caja.height;
      this.lienzo.width = Math.round(caja.width * dpr);
      this.lienzo.height = Math.round(caja.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** Fija la escala para que una distancia «radio» (m) quepa desde el centro hasta el borde más cercano. */
    encuadrar(radio) {
      this.escala = (0.5 * Math.min(this.w, this.h) * 0.9) / radio;
    }

    /** Radio (m) que cabe hoy en la vista: lo inverso de encuadrar(). */
    radioVisible() {
      return (0.5 * Math.min(this.w, this.h) * 0.9) / this.escala;
    }

    aPx(x, y) {
      return [this.w / 2 + x * this.escala, this.h / 2 - y * this.escala];
    }

    aMundo(px, py) {
      return [(px - this.w / 2) / this.escala, (this.h / 2 - py) / this.escala];
    }

    /** ¿El punto del mundo (x, y) cae dentro del lienzo, con un margen en píxeles? */
    dentro(x, y, margen = 0) {
      const [px, py] = this.aPx(x, y);
      return px > margen && px < this.w - margen && py > margen && py < this.h - margen;
    }

    /** Flecha de (x1, y1) a (x2, y2) en píxeles, con punta de base levemente cóncava (estilo Mundo Vacío). */
    flecha(x1, y1, x2, y2, color, ancho = 2.4, guiones) {
      const { ctx } = this;
      ancho *= this.c.grosor;
      const L = Math.hypot(x2 - x1, y2 - y1);
      if (L < 2) return;
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
      const hl = Math.min(L * 0.5, 6 + 2.6 * ancho); // largo de la punta
      const hw = hl * 0.4;                          // medio ancho de la punta
      const muesca = hl * 0.22;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = ancho;
      ctx.lineCap = 'round';
      ctx.setLineDash(guiones || []);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2 - ux * (hl - muesca), y2 - uy * (hl - muesca));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - ux * hl - uy * hw, y2 - uy * hl + ux * hw);
      ctx.lineTo(x2 - ux * (hl - muesca), y2 - uy * (hl - muesca));
      ctx.lineTo(x2 - ux * hl + uy * hw, y2 - uy * hl - ux * hw);
      ctx.closePath();
      ctx.fill();
      ctx.lineCap = 'butt';
    }

    texto(t, x, y, color, alinear = 'left', tam = 1, base = 'middle') {
      const { ctx } = this;
      ctx.font = `${this.c.letra * tam}px ${this.c.fuente}`;
      ctx.fillStyle = color;
      ctx.textAlign = alinear;
      ctx.textBaseline = base;
      ctx.fillText(t, x, y);
    }

    /** El mundo: un disco con luz desde arriba a la izquierda. Si el lanzamiento es alto, una montaña. */
    mundo(m, h) {
      const { ctx } = this;
      const [cx, cy] = this.aPx(0, 0);
      const rp = Math.max(m.R * this.escala, 1.5);
      const grad = ctx.createRadialGradient(cx - rp * 0.35, cy - rp * 0.4, rp * 0.05, cx, cy, rp);
      grad.addColorStop(0, aclarar(m.color, 0.25));
      grad.addColorStop(0.7, m.color);
      grad.addColorStop(1, aclarar(m.color, -0.45));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rp, 0, 2 * Math.PI);
      ctx.fill();

      // Montaña del cañón de Newton: se dibuja si el punto de partida está sobre la superficie.
      if (h > 0) {
        const [, yTop] = this.aPx(0, m.R + h);
        const [, ySup] = this.aPx(0, m.R);
        const alto = ySup - yTop;
        if (alto > 2) {
          const base = Math.max(alto * 0.9, 8);
          ctx.fillStyle = aclarar(m.color, -0.3);
          ctx.beginPath();
          ctx.moveTo(cx - base, ySup + 3);
          ctx.lineTo(cx - 2, yTop);
          ctx.lineTo(cx + 2, yTop);
          ctx.lineTo(cx + base, ySup + 3);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Nombre del mundo dentro del disco si cabe
      if (rp > 60) this.texto(m.nombre, cx, cy, 'rgba(255,255,255,0.75)', 'center', 1.05);
    }

    /** Estela: la trayectoria recorrida. Cada sonda tiene su color y su patrón de línea. */
    estela(s, color, guiones) {
      const { ctx } = this;
      const e = s.estela;
      if (e.length < 4) return;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.6 * this.c.grosor;
      ctx.lineJoin = 'round';
      ctx.setLineDash(guiones);
      ctx.beginPath();
      let [px, py] = this.aPx(e[0], e[1]);
      ctx.moveTo(px, py);
      for (let i = 2; i < e.length; i += 2) {
        [px, py] = this.aPx(e[i], e[i + 1]);
        ctx.lineTo(px, py);
      }
      [px, py] = this.aPx(s.x, s.y);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    /** La sonda: un punto. Si chocó, una cruz; si está seleccionada, un anillo. */
    sonda(s, color, elegida) {
      const { ctx } = this;
      const [px, py] = this.aPx(s.x, s.y);
      const r = 5 * this.c.grosor;
      if (s.estado === 'impacto') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2 * this.c.grosor;
        ctx.beginPath();
        ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r);
        ctx.moveTo(px + r, py - r); ctx.lineTo(px - r, py + r);
        ctx.stroke();
        return;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, 2 * Math.PI);
      ctx.fill();
      if (elegida) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, r + 5, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    /**
     * Vectores de la sonda, con escalas fijas por mundo (así su largo se compara en el tiempo):
     *   velocidad: vPx píxeles por m/s
     *   fuerza:    fPx píxeles por newton; F apunta siempre al centro del mundo
     */
    vectores(s, M, ver, vPx, fPx) {
      if (s.estado === 'impacto') return;
      const [px, py] = this.aPx(s.x, s.y);
      const r = Math.hypot(s.x, s.y);
      const letra = (t, x, y, color) => {
        this.ctx.font = `italic ${this.c.letra * 1.35}px ${this.c.serif}`;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(t, x, y);
      };
      if (ver.fuerza) {
        const F = (Grav.G * M * s.m) / (r * r);
        const L = F * fPx;
        const x2 = px - (s.x / r) * L, y2 = py + (s.y / r) * L;
        this.flecha(px, py, x2, y2, this.c.fuerza, 2.6);
        if (L > 18) letra('F', x2 - (s.x / r) * 12, y2 + (s.y / r) * 12, this.c.fuerza);
      }
      if (ver.velocidad) {
        const v = Math.hypot(s.vx, s.vy);
        const L = v * vPx;
        if (v > 0) {
          const x2 = px + (s.vx / v) * L, y2 = py - (s.vy / v) * L;
          this.flecha(px, py, x2, y2, this.c.vel, 2.6);
          if (L > 18) letra('v', x2 + (s.vx / v) * 12, y2 - (s.vy / v) * 12, this.c.vel);
        }
      }
    }

    /** Círculo punteado centrado en el mundo, de radio r (m): «si la sonda se quedara a esta distancia». */
    circulo(r) {
      const { ctx } = this;
      const [cx, cy] = this.aPx(0, 0);
      ctx.strokeStyle = this.c.tenue;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1 * this.c.grosor;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(cx, cy, r * this.escala, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    /**
     * Regla: una barra de largo redondo abajo a la izquierda y, si hay sonda,
     * la altura medida desde la superficie hasta ella, a lo largo del radio.
     */
    regla(m, s, abajo) {
      const { ctx } = this;
      // Barra de escala de unos 140 px con un largo redondo (1, 2 o 5 × 10ⁿ)
      const objetivo = 140 / this.escala;
      const p = 10 ** Math.floor(Math.log10(objetivo));
      const largo = [1, 2, 5, 10].map((k) => k * p).filter((x) => x <= objetivo).pop();
      const px = largo * this.escala;
      const x0 = 16, y0 = this.h - abajo;
      ctx.strokeStyle = this.c.tinta;
      ctx.lineWidth = 1.5 * this.c.grosor;
      ctx.beginPath();
      ctx.moveTo(x0, y0 - 5); ctx.lineTo(x0, y0); ctx.lineTo(x0 + px, y0); ctx.lineTo(x0 + px, y0 - 5);
      ctx.stroke();
      this.texto(fmt.distancia(largo), x0 + px / 2, y0 - 10, this.c.tinta, 'center', 0.95, 'bottom');

      if (!s) return;
      const r = Math.hypot(s.x, s.y);
      if (r <= m.R * 1.0001) return;
      const ux = s.x / r, uy = s.y / r;
      const [ax, ay] = this.aPx(ux * m.R, uy * m.R);
      const [bx, by] = this.aPx(s.x, s.y);
      if (Math.hypot(bx - ax, by - ay) < 24) return;
      // Línea de cota corrida 10 px hacia un costado del radio
      const nx = -uy * 10, ny = -ux * 10;
      ctx.strokeStyle = this.c.tenue;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax + nx, ay + ny); ctx.lineTo(bx + nx, by + ny);
      ctx.moveTo(ax + nx * 0.4, ay + ny * 0.4); ctx.lineTo(ax + nx * 1.6, ay + ny * 1.6);
      ctx.moveTo(bx + nx * 0.4, by + ny * 0.4); ctx.lineTo(bx + nx * 1.6, by + ny * 1.6);
      ctx.stroke();
      this.texto('h = ' + fmt.distancia(r - m.R), (ax + bx) / 2 + nx * 2.6, (ay + by) / 2 + ny * 2.6,
        this.c.tenue, nx < 0 ? 'right' : 'left', 0.95);
    }

    /**
     * Flecha de lanzamiento: sale del punto de partida y muestra la velocidad que tendrá la
     * sonda. El círculo en la punta es el asa para arrastrarla.
     */
    lanzador(m, L, vPx) {
      const [x0, y0] = this.aPx(0, m.R + L.h);
      const rad = (L.angulo * Math.PI) / 180;
      const largo = L.v * vPx;
      const x1 = x0 + largo * Math.cos(rad);
      const y1 = y0 - largo * Math.sin(rad);
      this.flecha(x0, y0, x1, y1, this.c.vel, 2, [6, 5]);
      const { ctx } = this;
      ctx.strokeStyle = this.c.vel;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x1, y1, 9 * this.c.grosor, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = this.c.tinta;
      ctx.beginPath();
      ctx.arc(x0, y0, 3.5 * this.c.grosor, 0, 2 * Math.PI);
      ctx.fill();
      return [x1, y1];
    }
  }

  /** Aclara (f > 0) u oscurece (f < 0) un color #rrggbb. */
  function aclarar(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) =>
      Math.round(f > 0 ? x + (255 - x) * f : x * (1 + f)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  Grav.Dibujo = Dibujo;
})(window);
