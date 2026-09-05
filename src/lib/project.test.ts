import { describe, it, expect } from 'vitest';
import { ProjectSchema, defaultProject, ROLES, MACROS } from './project';

describe('modelo de proyecto', () => {
  it('el proyecto por defecto tiene las cinco pistas en orden', () => {
    expect(defaultProject().tracks.map((t) => t.role)).toEqual([
      'kick', 'bass', 'hats', 'perc', 'atmos',
    ]);
  });

  it('el proyecto por defecto valida contra el esquema', () => {
    expect(() => ProjectSchema.parse(defaultProject())).not.toThrow();
  });

  it('cada pista arranca con exactamente los macros de su rol', () => {
    for (const track of defaultProject().tracks) {
      expect(Object.keys(track.macros).sort()).toEqual([...MACROS[track.role]].sort());
    }
  });

  it('el kick tiene cuatro macros y el resto tres', () => {
    expect(MACROS.kick).toHaveLength(4);
    for (const role of ROLES.filter((r) => r !== 'kick')) {
      expect(MACROS[role]).toHaveLength(3);
    }
  });

  it('rechaza un macro fuera de 0..1', () => {
    const p = defaultProject();
    p.tracks[0].macros.cuerpo = 1.5;
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it('rechaza un rol desconocido', () => {
    const p = defaultProject();
    (p.tracks[0] as { role: string }).role = 'vocals';
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it('ninguna pista arranca bloqueada ni en modo código', () => {
    for (const track of defaultProject().tracks) {
      expect(track.locked).toBe(false);
      expect(track.raw).toBeNull();
    }
  });
});
