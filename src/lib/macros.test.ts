import { describe, it, expect } from 'vitest';
import { macroParams } from './macros';

describe('mapeo de macros', () => {
  it('acidez del bajo sube cutoff y resonancia a la vez', () => {
    const bajo = (acidez: number) => macroParams('bass', { acidez, peso: 0.5, glide: 0 });
    const cutoffDe = (s: string) => Number(s.match(/cutoff\(([\d.]+)\)/)![1]);
    const resoDe = (s: string) => Number(s.match(/resonance\(([\d.]+)\)/)![1]);
    expect(cutoffDe(bajo(0.9))).toBeGreaterThan(cutoffDe(bajo(0.1)));
    expect(resoDe(bajo(0.9))).toBeGreaterThan(resoDe(bajo(0.1)));
  });

  it('saturación del kick a 0 no emite shape', () => {
    const s = macroParams('kick', { cuerpo: 0.5, click: 0.5, cola: 0.5, 'saturación': 0 });
    expect(s).not.toContain('shape');
  });

  it('saturación del kick alta sí emite shape', () => {
    const s = macroParams('kick', { cuerpo: 0.5, click: 0.5, cola: 0.5, 'saturación': 0.8 });
    expect(s).toContain('shape(');
  });

  it('cola del kick controla el decay de forma monótona', () => {
    const decayDe = (cola: number) =>
      Number(macroParams('kick', { cuerpo: 0.5, click: 0.5, cola, 'saturación': 0 })
        .match(/decay\(([\d.]+)\)/)![1]);
    expect(decayDe(0.9)).toBeGreaterThan(decayDe(0.1));
  });

  it('glide a 0 no emite portamento', () => {
    expect(macroParams('bass', { acidez: 0.5, peso: 0.5, glide: 0 })).not.toContain('slide');
  });

  it('todos los roles producen una cadena no vacía con macros neutros', () => {
    expect(macroParams('hats', { densidad: 0.5, brillo: 0.5, swing: 0.5 })).not.toBe('');
    expect(macroParams('perc', { densidad: 0.5, caos: 0.5, espacio: 0.5 })).not.toBe('');
    expect(macroParams('atmos', { anchura: 0.5, oscuridad: 0.5, movimiento: 0.5 })).not.toBe('');
  });

  it('ningún macro emite note ni gain: los pone el compilador', () => {
    const todos = { cuerpo: .5, click: .5, cola: .5, 'saturación': .5, acidez: .5, peso: .5,
      glide: .5, densidad: .5, brillo: .5, swing: .5, caos: .5, espacio: .5, anchura: .5,
      oscuridad: .5, movimiento: .5 };
    for (const role of ['kick', 'bass', 'hats', 'perc', 'atmos'] as const) {
      expect(macroParams(role, todos)).not.toContain('note(');
      expect(macroParams(role, todos)).not.toContain('gain(');
    }
  });

  it('no emite NaN para ningún rol ni valor extremo', () => {
    for (const v of [0, 1]) {
      const todos = { cuerpo: v, click: v, cola: v, 'saturación': v, acidez: v, peso: v,
        glide: v, densidad: v, brillo: v, swing: v, caos: v, espacio: v, anchura: v,
        oscuridad: v, movimiento: v };
      for (const role of ['kick', 'bass', 'hats', 'perc', 'atmos'] as const) {
        expect(macroParams(role, todos)).not.toContain('NaN');
      }
    }
  });
});
