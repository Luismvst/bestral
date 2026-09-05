import type { Project, Track } from './project';
import { MACROS, ProjectSchema } from './project';
import { OpSchema, type Op } from './ops';

export type Rejection = { op: unknown; reason: string };

/**
 * Aplica operaciones sobre el proyecto. Nunca muta la entrada.
 *
 * El orden importa y no es negociable:
 *   1. esquema  2. CANDADO  3. reglas de dominio  4. aplicar
 *
 * El candado se comprueba aquí, después del modelo. Da igual lo que el LLM haya
 * decidido: si la pista está bloqueada, la operación muere en la puerta.
 */
export function applyOps(
  project: Project,
  ops: unknown[],
): { project: Project; rejected: Rejection[] } {
  let actual: Project = structuredClone(project);
  const rejected: Rejection[] = [];

  for (const bruta of ops) {
    const parsed = OpSchema.safeParse(bruta);
    if (!parsed.success) {
      rejected.push({ op: bruta, reason: `operación inválida: ${parsed.error.issues[0]?.message ?? 'no reconocida'}` });
      continue;
    }
    const op = parsed.data;

    if (op.type !== 'set_global') {
      // El candado se lee del proyecto ORIGINAL, no del que se va actualizando.
      // Hoy da igual, porque ninguna operación puede escribir `locked`; pero esa
      // es una garantía accidental. Si mañana una operación pudiera tocarlo, otra
      // anterior del mismo lote abriría el candado para las siguientes. Leyendo
      // del original, la garantía pasa a ser estructural.
      const t = project.tracks.find((x) => x.role === op.track);
      if (!t) {
        rejected.push({ op, reason: `no existe la pista ${op.track}` });
        continue;
      }
      if (t.locked) {
        rejected.push({ op, reason: `la pista ${op.track} está bloqueada` });
        continue;
      }
    }

    const resultado = aplicarUna(actual, op);
    if (typeof resultado === 'string') {
      rejected.push({ op, reason: resultado });
      continue;
    }
    actual = resultado;
  }

  // Red de seguridad: si algo dejó el proyecto inválido, se descarta el lote entero.
  if (!ProjectSchema.safeParse(actual).success) {
    return {
      project,
      rejected: [...rejected, { op: ops, reason: 'el resultado no sería un proyecto válido' }],
    };
  }

  return { project: actual, rejected };
}

/** Devuelve el proyecto nuevo, o un string con el motivo del rechazo. */
function aplicarUna(p: Project, op: Op): Project | string {
  const conPista = (role: string, cambio: (t: Track) => Track | string): Project | string => {
    const tracks: Track[] = [];
    for (const t of p.tracks) {
      if (t.role !== role) { tracks.push(t); continue; }
      const nuevo = cambio(t);
      if (typeof nuevo === 'string') return nuevo;
      tracks.push(nuevo);
    }
    return { ...p, tracks };
  };

  switch (op.type) {
    case 'set_macro':
      return conPista(op.track, (t) =>
        (MACROS[t.role] as readonly string[]).includes(op.macro)
          ? { ...t, macros: { ...t.macros, [op.macro]: op.value } }
          : `la pista ${t.role} no tiene un macro llamado ${op.macro}`);

    case 'set_pattern':
      return conPista(op.track, (t) => ({ ...t, pattern: op.mini }));

    case 'set_sound':
      return conPista(op.track, (t) => ({ ...t, sound: op.sound }));

    case 'set_track':
      return conPista(op.track, (t) => ({
        ...t,
        gain: op.gain ?? t.gain,
        muted: op.muted ?? t.muted,
      }));

    case 'set_raw':
      return conPista(op.track, (t) => ({ ...t, raw: op.code }));

    case 'set_global':
      return { ...p, bpm: op.bpm };
  }
}
