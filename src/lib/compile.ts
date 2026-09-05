import type { Project, Track, TrackRole } from './project';
import { macroParams } from './macros';

/**
 * Las pistas tonales llevan la altura en el patrón, así que se compilan con note().
 * Las percusivas son ruido sin altura: su patrón es solo ritmo, y va en struct().
 * Mezclar note() y n() en la misma línea hace que compitan y el resultado desafina.
 */
const ES_TONAL: Record<TrackRole, boolean> = {
  kick: true, bass: true, atmos: true, hats: false, perc: false,
};

/** Un ciclo de Strudel es un compás de 4/4, así que cps = bpm / 60 / 4. */
function cps(bpm: number): number {
  return Number((bpm / 240).toFixed(4));
}

/** Un patrón que solo tiene silencios no merece una línea en el documento. */
function esSilencio(pattern: string): boolean {
  return pattern.replace(/[~\s[\]]/g, '') === '';
}

/**
 * Compila una pista a una línea `$: ...`.
 * Devuelve null si la pista no debe sonar (silenciada o patrón vacío).
 */
export function compileTrack(track: Track): string | null {
  if (track.muted) return null;

  if (track.raw !== null) {
    return `$: ${track.raw}.gain(${track.gain}) // ${track.role} [código]`;
  }

  if (esSilencio(track.pattern)) return null;

  const params = macroParams(track.role, track.macros);
  const fuente = ES_TONAL[track.role]
    ? `note("${track.pattern}").${params}`
    : `${params}.struct("${track.pattern}")`;

  return `$: ${fuente}.gain(${track.gain}) // ${track.role}`;
}

/** Compila el proyecto entero a un documento Strudel. Función pura. */
export function compile(project: Project): string {
  const lineas = project.tracks
    .map(compileTrack)
    .filter((l): l is string => l !== null);

  const conSwing = project.swing > 0
    ? lineas.map((l) => `${l}.swingBy(${Number(project.swing.toFixed(2))}, 4)`)
    : lineas;

  return [`setcps(${cps(project.bpm)})`, '', ...conSwing].join('\n');
}
