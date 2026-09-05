'use client';

// API real determinada leyendo node_modules/@strudel/web/web.mjs y dist/index.mjs:
// ni "evaluate global" (camino A) ni "webaudioRepl global" (camino B) del brief existen
// en `window`. El bundle sólo hace `window.initStrudel = initStrudel`; `evaluate` y
// `hush` son named exports del propio módulo ES, nunca globales. Se usan así.

let started = false;
let doEvaluate: ((code: string, autoplay?: boolean) => Promise<unknown>) | null = null;
let doHush: (() => void) | null = null;
let t0 = 0;

/** Arranca Strudel. Debe llamarse desde un gesto real del usuario (spec §11.3). */
export async function initEngine(): Promise<void> {
  if (started) return;
  const mod = await import('@strudel/web');
  await mod.initStrudel();
  doEvaluate = mod.evaluate;
  doHush = mod.hush;
  started = true;
  t0 = performance.now();
}

/**
 * Evalúa el documento. Si ya sonaba, Strudel lo intercambia en caliente
 * manteniendo la fase del ciclo (validado en el spike, spec §8).
 */
export function playCode(code: string): void {
  if (!started || !doEvaluate) throw new Error('initEngine() no se ha llamado');
  void doEvaluate(code);
}

/** ms restantes hasta el siguiente límite de compás (4 pulsos), dado el bpm. */
export function msHastaCompas(elapsedMs: number, bpm: number): number {
  const compasMs = (60_000 / bpm) * 4;
  const resto = elapsedMs % compasMs;
  return compasMs - resto;
}

let pendiente: string | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;

/**
 * Encola el documento y lo aplica en el siguiente límite de compás.
 * Sin esto, cada edición entra a contratiempo y en techno se oye (spec §11.2).
 *
 * ponytail: cuantización por reloj de pared contra el arranque del motor.
 * Si el desfase acumulado molesta, engancharse al scheduler de Strudel.
 */
export function playQuantized(code: string, bpm: number): void {
  pendiente = code;
  if (temporizador) return;
  const espera = msHastaCompas(performance.now() - t0, bpm);
  temporizador = setTimeout(() => {
    temporizador = null;
    if (pendiente) {
      playCode(pendiente);
      pendiente = null;
    }
  }, espera);
}

export function stopEngine(): void {
  if (temporizador) {
    clearTimeout(temporizador);
    temporizador = null;
  }
  pendiente = null;
  doHush?.();
}
