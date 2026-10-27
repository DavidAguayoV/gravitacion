# Gravitación

Simulación para FIS093 · Introducción a la Física (UAI), complemento de la clase 08.
Se lanzan sondas alrededor de un mundo y se ven, en vivo, la fuerza, la velocidad y la energía.

**En línea:** https://davidaguayov.github.io/gravitacion/

También funciona sin internet: basta abrir `index.html` (no necesita servidor ni instalación).

## Qué hace

- Mundo de masa *M* y radio *R* ajustables. El dibujo está a escala.
- Sonda lanzable de dos formas: arrastrando la flecha cian (su largo es la rapidez y su
  dirección, el ángulo) o con los campos de altura, rapidez y ángulo y el botón **Lanzar**.
- Física: *F* = −(*GMm*/*r*²) r̂, integrada con Runge-Kutta 4 y subpasos. Detecta el impacto
  con la superficie, cuenta las vueltas y anuncia «Escapó» cuando *E* ≥ 0 y la sonda se aleja.
- Vectores de fuerza (ámbar) y velocidad (cian), círculo a la altura actual y regla.
- Panel: *r*, *h*, *v*, *F*, √(*GM*/*r*) y √(2*GM*/*r*) en la posición actual, y *K*, *U* y *E*.
  Las barras de energía tienen el cero al medio: *U* siempre baja, *K* siempre sube y *E* dice
  si la sonda queda ligada (*E* < 0), está en el límite (*E* ≈ 0) o escapa (*E* > 0).
- Notación de la clase: *G* = 6,67 × 10⁻¹¹ N·m²/kg², *U* = −*GMm*/*r*, *v*ₑ = √(2*GM*/*R*).

## Situaciones (en clase)

| Botón | Qué muestra |
|---|---|
| Cañón de Newton | Tierra, montaña de 400 km. Tres disparos horizontales: 4 km/s (cae cerca), 6,5 km/s (cae más lejos) y 7,67 km/s (órbita). |
| Órbita circular | *v* = √(*GM*/*r*) desde 0,1 *R* de altura. *r* no cambia y *E* < 0. |
| Velocidad de escape | *v* = *v*ₑ desde la superficie a 60°: *E* ≈ 0 y no vuelve. Sirve para decir que el ángulo no importa. |
| Órbita elíptica | 1,2 veces la rapidez circular: se aleja hasta unas 2,6 veces la distancia de partida y vuelve. Mirar cómo *K* y *U* se reparten con *E* fija. |
| Se cae | 0,6 veces la rapidez circular: choca. |
| Escapa con sobra | 1,5 *v*ₑ: *E* > 0, le sobra energía cinética lejos. |
| Salto en Deimos | 3 m/s hacia arriba. Con los datos reales *v*ₑ ≈ 5,6 m/s: sube unos 2,4 km y vuelve en una hora. |
| Salto en Bennu | El mismo salto escapa: *v*ₑ ≈ 0,20 m/s (el asteroide de la actividad). |

Salvo el cañón y los saltos, cada situación se arma **sobre el mundo elegido**: elegir la Luna
y luego «Órbita circular» da la órbita circular de la Luna.

Mundos con datos reales (NASA): Bennu, Deimos, Ceres, Luna, Europa, Titán, Mercurio, Marte, Tierra y Júpiter.

## Modo reto

Oculta √(*GM*/*r*), √(2*GM*/*r*), las energías y las situaciones (que regalan la respuesta).
Los grupos buscan, tanteando con el campo *v*, la rapidez de una órbita circular y la de escape.
La página avisa «Órbita circular» si *r* varía menos de 1 % en la primera vuelta, y «Escapó»;
cada lanzamiento queda anotado en la lista del reto (mundo, *h*, *v*, ángulo y, si volvió, cuánto
subió) para informarlo. En el celular, el modo reto pone primero los controles de lanzamiento
y los datos, y al tocar **Lanzar** la página sube sola hasta el dibujo.

Se activa con la casilla **Modo reto** o desde la dirección:

```
https://davidaguayov.github.io/gravitacion/?reto=1
https://davidaguayov.github.io/gravitacion/?reto=1&mundo=luna
```

## Misiones (para el celular)

`mision.html?m=escapar`, `?m=orbitar` y `?m=llegar`: una página simple por misión, con un mundo,
tres retos y una sola perilla (la rapidez). Cada reto dibuja su meta, dice qué pasó con cada
lanzamiento («subió 1695 km: se pasó por 565 km») y anota los intentos.

| Misión | Retos |
|---|---|
| Escapar de Ceres | escapar hacia arriba con lo justo; en horizontal; desde *h* = *R* |
| El cañón de Newton en la Luna | caer a más de 2000 km; órbita circular; escapar en horizontal |
| Llegar a la marca en Marte | 50 km (sirve *mgh*); 1130 km (no sirve); 3390 km (con *mgh* escapa) |

### Misión final: Artemis II (`artemis.html`)

Se abre en cada misión al lograr sus tres retos (desde la página principal está siempre abierta).
La Tierra y la Luna giran alrededor de su baricentro y la nave siente a las dos (`js/tierraluna.js`,
RK4; se conserva la energía de Jacobi). Dos perillas: la rapidez de partida desde una órbita a
185 km y el ángulo de la Luna al partir (también se arrastra la Luna). La meta es una trayectoria
de retorno libre: rodear la Luna por detrás y volver a entrar al aire. Cada intento dice qué pasó
(no llega, la Luna ya había pasado o no llegaba, chocó, pasa de largo, escapó). Tras tres intentos
fallidos aparece «Ver cómo se hace» (10,95 km/s con la Luna a 128°). Hay una lupa con la Luna a
escala y una vista que gira con la Luna. Desafíos libres: impacto lunar y honda gravitacional.

Hoja para la clase (v2, 4 páginas: una para proyectar con los tres QR y una por misión):
`2026_2_FIS093/Clases/actividad_simulacion_v2_hoja.tex` y su pauta `actividad_simulacion_v2_pauta.tex`.

### Actividad «¿Escapa o vuelve?» (v1, modo reto)

Hoja por grupo para usar solo con el celular o la tablet: `2026_2_FIS093/Clases/actividad_simulacion_hoja.tex`
(cinco versiones: Luna, Marte, Mercurio, Titán y Ceres, cada una con su QR a `?reto=1&mundo=…`)
y su pauta, `actividad_simulacion_pauta.tex`. Preguntas: hacia arriba con 0,9 y 1,1 *v*ₑ, 1,1 *v*ₑ en
horizontal, *v*ₑ/2 hacia arriba (sube *R*/3, no *R*/4 como da *mgh*) y, si sobra tiempo, la órbita
circular a *h* = *R*, que sale con *v*ₑ/2. `tests/navegador.js` hace la actividad completa en las cinco versiones.

Otras opciones de la dirección: `?proyector=1` (letra y vectores grandes), `?tema=claro`
(fondo claro, para salas con luz; la casilla **Tema claro** hace lo mismo y el navegador lo
recuerda), `?mundo=marte`,
`?situacion=canon` (claves: `canon`, `circular`, `escape`, `eliptica`, `cae`, `sobra`, `deimos`,
`bennu`), `?varias=1`.

Atajos: Espacio pausa, L lanza, R reinicia. En el celular: arrastrar con un dedo la flecha y
pellizcar para acercar.

## Código

Sin compilación ni dependencias: HTML, CSS y JavaScript en scripts clásicos.

- `js/fisica.js` — el motor: fuerza, RK4, choque, escape, energías. No toca la página.
- `js/mundos.js` — datos de los mundos y situaciones.
- `js/formato.js` — números en español (coma decimal, potencias de diez).
- `js/dibujo.js` — todo lo que se pinta en el lienzo.
- `js/app.js` — controles, arrastre, bucle de animación y modo reto.
- `js/mision.js` y `css/mision.css` — las misiones: retos, jueces y la página para el celular.
- `js/tierraluna.js` y `js/artemis.js` — la misión final: motor Tierra–Luna y su página.

Pruebas:

```
node tests/verificar.js        # física, sin navegador
node tests/navegador.js        # en Chromium con Playwright (requiere playwright-core)
```

`verificar.js` revisa *g* = 9,81 m/s², la tabla de *v*ₑ de la clase, una órbita circular de
10 vueltas (*r* constante y deriva de energía < 0,1 %; en la práctica ~10⁻¹⁰ %), que con
*v* = *v*ₑ la sonda no vuelve, la altura máxima de un tiro vertical y los saltos en Deimos y Bennu.
