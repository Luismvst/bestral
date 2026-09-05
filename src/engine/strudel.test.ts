import { describe, it, expect } from 'vitest';
import { msHastaCompas } from './strudel';

describe('cuantización al compás', () => {
  it('a 132bpm un compás (4 pulsos) dura ~1818ms', () => {
    expect(msHastaCompas(0, 132)).toBeCloseTo((60_000 / 132) * 4, 5);
  });

  it('a mitad de compás espera justo la mitad restante', () => {
    const compasMs = (60_000 / 132) * 4;
    expect(msHastaCompas(compasMs / 2, 132)).toBeCloseTo(compasMs / 2, 5);
  });

  it('justo en el límite del compás espera el compás completo, no 0', () => {
    const compasMs = (60_000 / 132) * 4;
    expect(msHastaCompas(compasMs, 132)).toBeCloseTo(compasMs, 5);
  });

  it('varios compases transcurridos no rompen el módulo', () => {
    const compasMs = (60_000 / 120) * 4;
    expect(msHastaCompas(compasMs * 3.25, 120)).toBeCloseTo(compasMs * 0.75, 5);
  });
});
