/*
 * navegador.js — Verificación en un navegador real (Chromium con Playwright).
 * Abre index.html directamente (file://, sin servidor), prueba la física dentro de la página,
 * el arrastre con mouse y con el dedo, el modo reto, y saca capturas en escritorio y celular.
 *
 * Uso:  node tests/navegador.js [carpeta-de-capturas]
 * Requiere el paquete playwright-core (o playwright) instalado donde Node lo encuentre,
 * por ejemplo con NODE_PATH apuntando a su node_modules.
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');

const PAGINA = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CAPTURAS = path.resolve(process.argv[2] || path.join(__dirname, 'capturas'));
require('fs').mkdirSync(CAPTURAS, { recursive: true });

let fallas = 0;
function revisar(nombre, ok, detalle) {
  console.log(`${ok ? 'ok   ' : 'FALLA'}  ${nombre}${detalle ? '  — ' + detalle : ''}`);
  if (!ok) fallas++;
}

/** Espera hasta que cond() (evaluada en la página) sea verdadera, o hasta ms milisegundos. */
async function esperar(p, cond, ms = 15000) {
  try { await p.waitForFunction(cond, null, { timeout: ms, polling: 50 }); return true; } catch { return false; }
}

async function abrir(b, query, movil) {
  const p = await b.newPage(movil
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } });
  p.errores = [];
  p.on('pageerror', (e) => p.errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') p.errores.push(m.text()); });
  await p.goto(PAGINA + query);
  await p.waitForTimeout(200);
  return p;
}

(async () => {
  const b = await chromium.launch();

  // 1. Órbita circular: r constante por 10 vueltas y deriva de energía < 0,1 %, con el bucle real
  {
    const p = await abrir(b, '?situacion=circular');
    await p.evaluate(() => {
      const g = window.gravitacion;
      g.estado.mult = 1e5;
      const s = g.estado.sondas[0];
      window.medida = { r0: Math.hypot(s.x, s.y), E0: Grav.energias(s, g.estado.mundo.M).E, dr: 0, dE: 0 };
      // Se mide en cada cuadro, después del paso de física
      const mirar = () => {
        const r = Math.hypot(s.x, s.y);
        const E = Grav.energias(s, g.estado.mundo.M).E;
        medida.dr = Math.max(medida.dr, Math.abs(r - medida.r0) / medida.r0);
        medida.dE = Math.max(medida.dE, Math.abs((E - medida.E0) / medida.E0));
        medida.vueltas = s.vueltas;
        if (s.vueltas < 10) requestAnimationFrame(mirar);
      };
      requestAnimationFrame(mirar);
    });
    const listo = await esperar(p, () => window.medida.vueltas >= 10, 60000);
    const m = await p.evaluate(() => window.medida);
    revisar('página: órbita circular completa 10 vueltas', listo, `${m.vueltas} vueltas`);
    revisar('página: r constante', m.dr < 1e-4, `desvío máx. ${(100 * m.dr).toExponential(1)} %`);
    revisar('página: deriva de energía < 0,1 %', m.dE < 1e-3, `${(100 * m.dE).toExponential(1)} %`);
    revisar('página: aviso «Órbita circular»', (await p.textContent('#estado')) === 'Órbita circular');
    revisar('página: sin errores en la consola', p.errores.length === 0, p.errores.join(' | '));
    await p.close();
  }

  // 2. Velocidad de escape: E ≈ 0 y la sonda no vuelve
  {
    const p = await abrir(b, '?situacion=escape');
    const tipo = await p.textContent('#tipoE');
    revisar('escape: barras dicen E ≈ 0', tipo.startsWith('E ≈ 0'), tipo);
    await p.evaluate(() => {
      const s = window.gravitacion.estado.sondas[0];
      window.gravitacion.estado.mult = 1e5;
      window.rAnt = 0; window.volvio = false;
      const mirar = () => {
        const r = Math.hypot(s.x, s.y);
        if (r < window.rAnt) window.volvio = true;
        window.rAnt = r;
        if (r < 50 * window.gravitacion.estado.mundo.R) requestAnimationFrame(mirar);
      };
      requestAnimationFrame(mirar);
    });
    // Llegar a 50 R toma unos 40 s reales a ×10⁵; r debe crecer siempre.
    const lejos = await esperar(p, () => window.rAnt >= 50 * window.gravitacion.estado.mundo.R, 90000);
    revisar('escape: la sonda llega a 50 R sin volver', lejos && !(await p.evaluate(() => window.volvio)));
    revisar('escape: aviso «Escapó»', (await p.textContent('#estado')) === 'Escapó');
    await p.close();
  }

  // 3. Deimos (vuelve) y Bennu (escapa) con un salto de 3 m/s
  {
    const p = await abrir(b, '?situacion=deimos');
    await p.evaluate(() => (window.gravitacion.estado.mult = 1e4));
    const cae = await esperar(p, () => window.gravitacion.estado.sondas[0].estado === 'impacto', 20000);
    const hMax = await p.evaluate(() => { const g = window.gravitacion.estado; return g.sondas[0].rMax - g.mundo.R; });
    revisar('Deimos: el salto de 3 m/s vuelve', cae, `sube ${(hMax / 1000).toFixed(2)} km`);
    await p.evaluate(() => window.gravitacion.usarSituacion('bennu'));
    await p.evaluate(() => (window.gravitacion.estado.mult = 1e4));
    const sale = await esperar(p, () => ['escapo', 'lejos'].includes(window.gravitacion.estado.sondas[0].estado), 20000);
    revisar('Bennu: el salto de 3 m/s escapa', sale);
    await p.close();
  }

  // 4. Arrastre con mouse: la flecha fija rapidez y ángulo, y al soltar se lanza
  {
    const p = await abrir(b, '?mundo=luna');
    const caja = await p.locator('#lienzo').boundingBox();
    const [x0, y0] = await p.evaluate(() => {
      const g = window.gravitacion;
      return g.dibujo.aPx(0, g.estado.mundo.R + g.estado.lanz.h);
    });
    await p.mouse.move(caja.x + x0, caja.y + y0);
    await p.mouse.down();
    await p.mouse.move(caja.x + x0 + 120, caja.y + y0 - 120, { steps: 8 });
    await p.mouse.up();
    const r = await p.evaluate(() => ({ n: window.gravitacion.estado.sondas.length, a: window.gravitacion.estado.lanz.angulo }));
    revisar('mouse: arrastrar y soltar lanza una sonda a 45°', r.n === 1 && r.a === 45, JSON.stringify(r));
    await p.close();
  }

  // 5. Modo reto: se ocultan v_c, v_e y las energías; los logros se anotan
  {
    const p = await abrir(b, '?reto=1');
    const vis = await p.evaluate(() => ({
      energia: getComputedStyle(document.getElementById('energia')).display,
      vc: getComputedStyle(document.getElementById('dVc').parentElement).display,
      situaciones: getComputedStyle(document.getElementById('situaciones').parentElement).display,
      reto: getComputedStyle(document.getElementById('grupoReto')).display,
    }));
    revisar('reto: oculta energías, v_c, v_e y situaciones',
      vis.energia === 'none' && vis.vc === 'none' && vis.situaciones === 'none' && vis.reto === 'block', JSON.stringify(vis));
    // Un grupo prueba la rapidez circular a 400 km escribiéndola en el campo
    await p.fill('#campoV', '7,67');
    await p.press('#campoV', 'Enter');
    await p.click('#lanzar');
    await p.evaluate(() => (window.gravitacion.estado.mult = 1e4));
    const anotado = await esperar(p, () => document.querySelectorAll('#logros li').length > 0, 20000);
    revisar('reto: se anota la órbita circular encontrada', anotado, anotado ? await p.textContent('#logros li') : '');
    await p.screenshot({ path: path.join(CAPTURAS, 'escritorio-reto.png') });
    await p.close();
  }

  // 6. Celular: arrastre con el dedo (eventos táctiles reales) y capturas
  {
    const p = await abrir(b, '?mundo=marte', true);
    const caja = await p.locator('#lienzo').boundingBox();
    const [x0, y0] = await p.evaluate(() => {
      const g = window.gravitacion;
      return g.dibujo.aPx(0, g.estado.mundo.R + g.estado.lanz.h); // se toma desde el punto de partida
    });
    const cdp = await p.context().newCDPSession(p);
    const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: type === 'touchEnd' ? [] : [{ x: caja.x + x, y: caja.y + y }],
    });
    await toque('touchStart', x0, y0);
    for (let i = 1; i <= 8; i++) await toque('touchMove', x0 + 12 * i, y0 - 2 * i);
    await toque('touchEnd');
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ n: window.gravitacion.estado.sondas.length, a: window.gravitacion.estado.lanz.angulo }));
    revisar('celular: arrastrar con el dedo lanza la sonda', r.n === 1, JSON.stringify(r));
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    revisar('celular: sin desplazamiento horizontal', ancho <= 390, `scrollWidth ${ancho}`);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(CAPTURAS, 'celular-marte.png') });
    await p.screenshot({ path: path.join(CAPTURAS, 'celular-completo.png'), fullPage: true });
    revisar('celular: sin errores en la consola', p.errores.length === 0, p.errores.join(' | '));
    await p.close();
  }

  // 7. Las misiones en el celular: cada reto, con una rapidez que falla y otra que lo logra
  //    (las de la hoja, con 3 cifras). En Marte, la rapidez de mgh para h = R escapa.
  const MISIONES = {
    escapar: [[[400, false], [520, true]], [[400, false], [520, true]], [[300, false], [370, true]]],
    orbitar: [[[1300, false], [1550, true]], [[1700, false], [1610, true]], [[2000, false], [2290, true]]],
    llegar: [[[700, false], [611, true]], [[2900, false], [2510, true]], [[5030, false], [3550, true]]],
  };
  for (const [m, retos] of Object.entries(MISIONES)) {
    const p = await abrir(b, '', true);
    await p.goto(PAGINA.replace('index.html', 'mision.html') + '?m=' + m);
    await p.evaluate(() => localStorage.clear());
    const detalle = [];
    let bien = true;
    for (let n = 0; n < retos.length; n++) {
      await p.evaluate((n) => window.mision.elegirReto(n), n);
      for (const [v, ok] of retos[n]) {
        await p.evaluate((v) => window.mision.ponerRapidez(v), v);
        await p.tap('#lanzar');
        const listo = await esperar(p, () => document.getElementById('aviso').dataset.listo === 'si', 30000);
        const logro = await p.evaluate(() => document.getElementById('aviso').classList.contains('ok'));
        if (!listo || logro !== ok) { bien = false; detalle.push(`reto ${n + 1}, ${v} m/s: ${await p.textContent('#textoAviso')}`); }
      }
    }
    const marcados = await p.evaluate(() => document.querySelectorAll('.m-boton-reto.logrado').length);
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    revisar(`misión ${m}: cada reto falla y se logra cuando debe`, bien && marcados === 3, detalle.join(' | '));
    revisar(`misión ${m}: sin desplazamiento horizontal ni errores`, ancho <= 390 && p.errores.length === 0, `scrollWidth ${ancho} ${p.errores.join(' | ')}`);
    await p.screenshot({ path: path.join(CAPTURAS, `mision-${m}.png`) });
    await p.close();
  }

  // 8. Capturas de escritorio de las situaciones
  for (const [sit, extra, ms] of [
    ['canon', '', 6000], ['eliptica', '', 6000], ['escape', '', 3000], ['deimos', '', 2500], ['canon', '&proyector=1', 6000],
  ]) {
    const p = await abrir(b, `?situacion=${sit}${extra}`);
    await p.waitForTimeout(ms);
    await p.screenshot({ path: path.join(CAPTURAS, `escritorio-${sit}${extra ? '-proyector' : ''}.png`) });
    if (p.errores.length) revisar(`${sit}: sin errores`, false, p.errores.join(' | '));
    await p.close();
  }
  {
    const p = await abrir(b, '?situacion=canon', true);
    await p.waitForTimeout(6000);
    await p.screenshot({ path: path.join(CAPTURAS, 'celular-canon.png') });
    await p.close();
  }

  await b.close();
  console.log(fallas ? `\n${fallas} verificación(es) fallaron.` : '\nTodo verificado.');
  process.exit(fallas ? 1 : 0);
})();
