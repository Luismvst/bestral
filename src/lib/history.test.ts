import { describe, it, expect } from 'vitest';
import { nuevaHistoria, empujar, deshacer, rehacer, puedeDeshacer, puedeRehacer } from './history';
import { defaultProject } from './project';

const conBpm = (bpm: number) => ({ ...defaultProject(), bpm });

describe('historial', () => {
  it('una historia nueva no puede deshacer ni rehacer', () => {
    const h = nuevaHistoria(defaultProject());
    expect(puedeDeshacer(h)).toBe(false);
    expect(puedeRehacer(h)).toBe(false);
  });

  it('deshacer devuelve el estado anterior', () => {
    const h = empujar(nuevaHistoria(conBpm(132)), conBpm(140));
    expect(deshacer(h).presente.bpm).toBe(132);
  });

  it('rehacer vuelve adelante', () => {
    const h = deshacer(empujar(nuevaHistoria(conBpm(132)), conBpm(140)));
    expect(rehacer(h).presente.bpm).toBe(140);
  });

  it('empujar tras deshacer descarta el futuro', () => {
    let h = empujar(nuevaHistoria(conBpm(132)), conBpm(140));
    h = empujar(deshacer(h), conBpm(150));
    expect(puedeRehacer(h)).toBe(false);
    expect(h.presente.bpm).toBe(150);
  });

  it('deshacer en el límite no rompe nada', () => {
    expect(deshacer(nuevaHistoria(conBpm(132))).presente.bpm).toBe(132);
  });

  it('el pasado se limita a 50 estados', () => {
    let h = nuevaHistoria(conBpm(60));
    for (let i = 0; i < 120; i++) h = empujar(h, conBpm(100 + (i % 50)));
    expect(h.pasado.length).toBeLessThanOrEqual(50);
  });
});
