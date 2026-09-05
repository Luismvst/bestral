import { z } from 'zod';

export const ROLES = ['kick', 'bass', 'hats', 'perc', 'atmos'] as const;
export type TrackRole = (typeof ROLES)[number];

/** Macros cerrados por rol (spec §6). Vocabulario del techno, no de DSP. */
export const MACROS = {
  kick:  ['cuerpo', 'click', 'cola', 'saturación'],
  bass:  ['acidez', 'peso', 'glide'],
  hats:  ['densidad', 'brillo', 'swing'],
  perc:  ['densidad', 'caos', 'espacio'],
  atmos: ['anchura', 'oscuridad', 'movimiento'],
} as const satisfies Record<TrackRole, readonly string[]>;

const TrackSchema = z.object({
  role: z.enum(ROLES),
  sound: z.string().min(1),
  pattern: z.string(),
  macros: z.record(z.string(), z.number().min(0).max(1)),
  raw: z.string().nullable(),
  gain: z.number().min(0).max(1.5),
  muted: z.boolean(),
  locked: z.boolean(),
});

export const ProjectSchema = z
  .object({
    bpm: z.number().int().min(60).max(200),
    swing: z.number().min(0).max(1),
    tracks: z.array(TrackSchema).length(ROLES.length),
  })
  .superRefine((project, ctx) => {
    const seenRoles = new Set<TrackRole>();
    project.tracks.forEach((track, i) => {
      if (seenRoles.has(track.role)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `rol duplicado: '${track.role}' ya aparece en otra pista`,
          path: ['tracks', i, 'role'],
        });
      }
      seenRoles.add(track.role);

      const expected = new Set<string>(MACROS[track.role]);
      const actual = new Set(Object.keys(track.macros));
      if (expected.size !== actual.size || [...expected].some((m) => !actual.has(m))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `los macros de la pista '${track.role}' deben ser exactamente [${MACROS[track.role].join(', ')}]`,
          path: ['tracks', i, 'macros'],
        });
      }
    });
    for (const role of ROLES) {
      if (!seenRoles.has(role)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `falta la pista de rol '${role}'`,
          path: ['tracks'],
        });
      }
    }
  });

export type Track = z.infer<typeof TrackSchema>;
export type Project = z.infer<typeof ProjectSchema>;

/** Todos los macros del rol a 0.5: punto de partida neutro. */
function neutralMacros(role: TrackRole): Record<string, number> {
  return Object.fromEntries(MACROS[role].map((m) => [m, 0.5]));
}

const DEFAULT_PATTERNS: Record<TrackRole, string> = {
  kick:  'c1*4',
  bass:  '<c2 c2 eb2 c2>',
  hats:  '~ x ~ x',
  perc:  '~',
  atmos: '~',
};

const DEFAULT_GAIN: Record<TrackRole, number> = {
  kick: 0.95, bass: 0.7, hats: 0.35, perc: 0.5, atmos: 0.4,
};

export function defaultProject(): Project {
  return {
    bpm: 132,
    swing: 0,
    tracks: ROLES.map((role) => ({
      role,
      sound: role,
      pattern: DEFAULT_PATTERNS[role],
      macros: neutralMacros(role),
      raw: null,
      gain: DEFAULT_GAIN[role],
      muted: false,
      locked: false,
    })),
  };
}
