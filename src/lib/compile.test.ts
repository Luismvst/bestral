import { describe, it, expect } from 'vitest';
import { compile, compileTrack } from './compile';
import { defaultProject } from './project';

describe('compilador', () => {
  it('emite el tempo en cps a partir del bpm', () => {
    // 132 bpm / 240 = 0.55 ciclos por segundo (un ciclo = un compás de 4/4)
    expect(compile({ ...defaultProject(), bpm: 132 })).toContain('setcps(0.55)');
  });

  it('emite una línea $: por cada pista audible', () => {
    // perc y atmos arrancan con patrón "~", así que no aparecen
    expect(compile(defaultProject()).match(/^\$:/gm)?.length).toBe(3);
  });

  it('una pista silenciada no aparece en el código', () => {
    const p = defaultProject();
    p.tracks[0].muted = true;
    expect(compileTrack(p.tracks[0])).toBeNull();
  });

  it('una pista con patrón vacío o solo silencios no aparece', () => {
    const p = defaultProject();
    p.tracks[0].pattern = '~';
    expect(compileTrack(p.tracks[0])).toBeNull();
    p.tracks[0].pattern = '   ';
    expect(compileTrack(p.tracks[0])).toBeNull();
  });

  it('el modo código sustituye por completo a los macros', () => {
    const p = defaultProject();
    p.tracks[1].raw = 'note("c2*8").s("square")';
    const linea = compileTrack(p.tracks[1])!;
    expect(linea).toContain('note("c2*8").s("square")');
    expect(linea).not.toContain('cutoff');
  });

  it('el modo código sigue respetando el silenciado', () => {
    const p = defaultProject();
    p.tracks[1].raw = 'note("c2*8")';
    p.tracks[1].muted = true;
    expect(compileTrack(p.tracks[1])).toBeNull();
  });

  it('el swing de los hats emite su propio swingBy antes del comentario', () => {
    const p = defaultProject();
    const hats = p.tracks.find((t) => t.role === 'hats')!;
    hats.macros.swing = 0.9;
    const linea = compileTrack(hats)!;
    expect(linea).toContain('swingBy(');
    expect(linea.indexOf('swingBy(')).toBeLessThan(linea.indexOf('//'));
  });

  it('patrones de silencio idiomáticos no aparecen: anidado, con puntos, con _ y con réplica', () => {
    const p = defaultProject();
    for (const patron of ['<~ ~>', '~ . ~', '~ _ _', '~!4']) {
      p.tracks[0].pattern = patron;
      expect(compileTrack(p.tracks[0])).toBeNull();
    }
  });

  it('"0" no es silencio: es una nota válida en mini-notation', () => {
    const p = defaultProject();
    p.tracks[0].pattern = '0';
    expect(compileTrack(p.tracks[0])).not.toBeNull();
  });

  it('patrones reales de kick y hats no son silencio', () => {
    const p = defaultProject();
    p.tracks[0].pattern = 'c1*4';
    expect(compileTrack(p.tracks[0])).not.toBeNull();
    const hats = p.tracks.find((t) => t.role === 'hats')!;
    hats.pattern = 'x*8';
    expect(compileTrack(hats)).not.toBeNull();
  });

  it('es determinista: mismo proyecto, mismo código', () => {
    expect(compile(defaultProject())).toBe(compile(defaultProject()));
  });

  it('el gain de la pista llega al código', () => {
    const p = defaultProject();
    p.tracks[0].gain = 0.42;
    expect(compileTrack(p.tracks[0])).toContain('0.42');
  });

  it('las pistas tonales usan note() y las percusivas struct()', () => {
    const p = defaultProject();
    expect(compileTrack(p.tracks[0])).toContain('note(');   // kick
    expect(compileTrack(p.tracks[1])).toContain('note(');   // bass
    const hats = p.tracks.find((t) => t.role === 'hats')!;
    expect(compileTrack(hats)).toContain('struct(');
    expect(compileTrack(hats)).not.toContain('note(');
  });
});
