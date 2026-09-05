import type { TrackRole } from './project';

// REGLA: ningún macro emite note() ni gain().
//   note() lo pone el patrón de la pista y competirían (ver compile.ts).
//   gain() lo pone el compilador desde track.gain; encadenar dos gain() hace
//   que el segundo pise al primero y el macro dejaría de tener efecto.

/** Interpola linealmente y redondea, para que el código generado sea legible. */
const lerp = (v: number, min: number, max: number, dec = 2): number =>
  Number((min + (max - min) * v).toFixed(dec));

/** Curva exponencial: para frecuencias, donde el oído no es lineal. */
const expLerp = (v: number, min: number, max: number): number =>
  Math.round(min * Math.pow(max / min, v));

type Chain = string[];

function kick(m: Record<string, number>): Chain {
  const c: Chain = [
    `s("sine")`,
    // cuerpo: paso bajo más cerrado = más sub y menos cuerpo medio
    `lpf(${expLerp(1 - m.cuerpo, 90, 400)})`,
    `decay(${lerp(m.cola, 0.08, 0.55)})`,
    `sustain(0)`,
    // click: ataque más corto = más transiente
    `attack(${lerp(m.click, 0.004, 0, 4)})`,
  ];
  if (m['saturación'] > 0.02) c.push(`shape(${lerp(m['saturación'], 0, 0.75)})`);
  return c;
}

function bass(m: Record<string, number>): Chain {
  // acidez: cutoff y resonancia acoplados. Es el gesto del 303.
  const c: Chain = [
    `s("sawtooth")`,
    `cutoff(${expLerp(m.acidez, 180, 4000)})`,
    `resonance(${lerp(m.acidez, 2, 28, 1)})`,
    `decay(${lerp(m.acidez, 0.35, 0.12)})`,
    `sustain(${lerp(m.peso, 0.05, 0.4)})`,
  ];
  if (m.glide > 0.02) c.push(`slide(${lerp(m.glide, 0, 0.5)})`);
  return c;
}

function hats(m: Record<string, number>): Chain {
  const c: Chain = [
    `s("white")`,
    `hpf(${expLerp(m.brillo, 3000, 12000)})`,
    `decay(${lerp(m.brillo, 0.06, 0.015, 3)})`,
    `sustain(0)`,
  ];
  // densidad invertida: a menos densidad, más golpes se caen (mismo patrón que caos en perc)
  if (1 - m.densidad > 0.05) c.push(`degradeBy(${lerp(1 - m.densidad, 0, 0.45)})`);
  if (m.swing > 0.02) c.push(`swingBy(${lerp(m.swing, 0, 0.5)}, 8)`);
  return c;
}

function perc(m: Record<string, number>): Chain {
  const c: Chain = [
    `s("white")`,
    `bpf(${expLerp(m.densidad, 700, 3500)})`,
    `decay(${lerp(m.espacio, 0.05, 0.22)})`,
    `sustain(0)`,
  ];
  if (m.espacio > 0.05) c.push(`room(${lerp(m.espacio, 0, 0.6)})`);
  // caos: probabilidad de que un golpe se caiga, para que no sea un bucle muerto
  if (m.caos > 0.05) c.push(`degradeBy(${lerp(m.caos, 0, 0.45)})`);
  return c;
}

function atmos(m: Record<string, number>): Chain {
  return [
    `s("sawtooth")`,
    `cutoff(${expLerp(1 - m.oscuridad, 250, 2600)})`,
    `attack(${lerp(m.movimiento, 0.2, 1.6)})`,
    `release(${lerp(m.movimiento, 0.5, 3)})`,
    `room(${lerp(m.anchura, 0.2, 0.9)})`,
  ];
}

const BY_ROLE: Record<TrackRole, (m: Record<string, number>) => Chain> = {
  kick, bass, hats, perc, atmos,
};

/**
 * Traduce los macros semánticos de una pista a métodos Strudel encadenados.
 * Devuelve `metodo(a).metodo(b)` sin punto inicial: el compilador lo antepone.
 */
export function macroParams(role: TrackRole, macros: Record<string, number>): string {
  return BY_ROLE[role](macros).join('.');
}
