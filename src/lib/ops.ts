import { z } from 'zod';
import { ROLES } from './project';

const role = z.enum(ROLES);

export const OpSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set_macro'), track: role, macro: z.string(), value: z.number().min(0).max(1) }),
  z.object({ type: z.literal('set_pattern'), track: role, mini: z.string().min(1).max(200) }),
  z.object({ type: z.literal('set_sound'), track: role, sound: z.string().min(1) }),
  z.object({ type: z.literal('set_track'), track: role, gain: z.number().min(0).max(1.5).optional(), muted: z.boolean().optional() }),
  z.object({ type: z.literal('set_global'), bpm: z.number().int().min(60).max(200) }),
  z.object({ type: z.literal('set_raw'), track: role, code: z.string().max(600).nullable() }),
]);

export const OpsSchema = z.array(OpSchema).max(12);

export type Op = z.infer<typeof OpSchema>;
