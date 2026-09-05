import { describe, it, expect } from 'vitest';
import { applyOps } from './apply';
import { defaultProject, type Project } from './project';

const track = (p: Project, role: string) => p.tracks.find((t) => t.role === role)!;

describe('aplicador — candados', () => {
  it('RECHAZA cualquier operación sobre una pista bloqueada', () => {
    const p = defaultProject();
    track(p, 'kick').locked = true;
    const antes = track(p, 'kick').pattern;

    const r = applyOps(p, [{ type: 'set_pattern', track: 'kick', mini: 'c1*16' }]);

    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0].reason).toContain('bloqueada');
    expect(track(r.project, 'kick').pattern).toBe(antes);
  });

  it('el candado bloquea también los macros y el modo código', () => {
    const p = defaultProject();
    track(p, 'bass').locked = true;
    const r = applyOps(p, [
      { type: 'set_macro', track: 'bass', macro: 'acidez', value: 0.9 },
      { type: 'set_raw', track: 'bass', code: 'note("c2")' },
    ]);
    expect(r.rejected).toHaveLength(2);
    expect(track(r.project, 'bass').macros.acidez).toBe(0.5);
    expect(track(r.project, 'bass').raw).toBeNull();
  });

  it('una pista bloqueada no impide que las demás cambien', () => {
    const p = defaultProject();
    track(p, 'kick').locked = true;
    const r = applyOps(p, [
      { type: 'set_pattern', track: 'kick', mini: 'c1*16' },
      { type: 'set_macro', track: 'bass', macro: 'acidez', value: 0.9 },
    ]);
    expect(r.rejected).toHaveLength(1);
    expect(track(r.project, 'bass').macros.acidez).toBe(0.9);
  });

  it('el candado no se puede quitar por operación: solo desde la UI', () => {
    const p = defaultProject();
    track(p, 'kick').locked = true;
    const r = applyOps(p, [{ type: 'set_track', track: 'kick', gain: 0.1 }]);
    expect(r.rejected).toHaveLength(1);
    expect(track(r.project, 'kick').locked).toBe(true);
  });
});

describe('aplicador — validación', () => {
  it('rechaza una operación de tipo desconocido', () => {
    const r = applyOps(defaultProject(), [{ type: 'delete_track', track: 'kick' }]);
    expect(r.rejected).toHaveLength(1);
  });

  it('rechaza un macro que no pertenece al rol', () => {
    const r = applyOps(defaultProject(), [
      { type: 'set_macro', track: 'kick', macro: 'acidez', value: 0.8 },
    ]);
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0].reason).toContain('acidez');
  });

  it('rechaza un valor de macro fuera de 0..1', () => {
    const r = applyOps(defaultProject(), [
      { type: 'set_macro', track: 'kick', macro: 'cuerpo', value: 4 },
    ]);
    expect(r.rejected).toHaveLength(1);
  });

  it('rechaza una pista inexistente', () => {
    const r = applyOps(defaultProject(), [
      { type: 'set_macro', track: 'vocals', macro: 'cuerpo', value: 0.5 },
    ]);
    expect(r.rejected).toHaveLength(1);
  });

  it('rechaza un bpm fuera de rango sin romper el proyecto', () => {
    const r = applyOps(defaultProject(), [{ type: 'set_global', bpm: 9000 }]);
    expect(r.rejected).toHaveLength(1);
    expect(r.project.bpm).toBe(132);
  });
});

describe('aplicador — aplicación', () => {
  it('no muta el proyecto de entrada', () => {
    const p = defaultProject();
    applyOps(p, [{ type: 'set_macro', track: 'kick', macro: 'cuerpo', value: 0.9 }]);
    expect(track(p, 'kick').macros.cuerpo).toBe(0.5);
  });

  it('aplica varias operaciones en orden', () => {
    const r = applyOps(defaultProject(), [
      { type: 'set_global', bpm: 140 },
      { type: 'set_macro', track: 'bass', macro: 'acidez', value: 0.8 },
      { type: 'set_track', track: 'hats', muted: true },
    ]);
    expect(r.rejected).toHaveLength(0);
    expect(r.project.bpm).toBe(140);
    expect(track(r.project, 'bass').macros.acidez).toBe(0.8);
    expect(track(r.project, 'hats').muted).toBe(true);
  });

  it('set_raw con null devuelve la pista al modo macros', () => {
    const p = defaultProject();
    track(p, 'bass').raw = 'note("c2")';
    const r = applyOps(p, [{ type: 'set_raw', track: 'bass', code: null }]);
    expect(track(r.project, 'bass').raw).toBeNull();
  });

  it('el resultado sigue siendo un proyecto válido', () => {
    const r = applyOps(defaultProject(), [{ type: 'set_global', bpm: 145 }]);
    expect(r.project.tracks).toHaveLength(5);
    expect(r.rejected).toHaveLength(0);
  });
});
