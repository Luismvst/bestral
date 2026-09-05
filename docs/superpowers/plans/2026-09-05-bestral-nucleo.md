# Bestral — Plan 1: Núcleo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un usuario escriba "techno hipnótico a 132, kick seco, bajo rodante", lo oiga en cinco segundos dividido en cinco pistas, y pueda esculpirlo con mandos y con frases sin que se le rompa lo que ha bloqueado.

**Architecture:** El proyecto es un JSON que es la única fuente de verdad. Un compilador puro lo traduce a un string de código Strudel. Un aplicador valida las operaciones que emite el LLM y rechaza las que tocan pistas bloqueadas. El motor evalúa el string y lo intercambia en caliente. Nada del núcleo musical toca el servidor salvo la llamada al LLM.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Vitest · Zod · AI SDK v6 vía AI Gateway · `@strudel/web`

**Spec:** `docs/superpowers/specs/2026-09-05-bestral-design.md`

## Global Constraints

- **Node 24**, npm (no hay pnpm en la máquina de desarrollo).
- **El LLM nunca escribe el proyecto ni código Strudel suelto.** Emite operaciones; el aplicador decide.
- **El candado se comprueba en el aplicador, después del modelo, nunca en el prompt.**
- **Seis operaciones exactas:** `set_macro`, `set_pattern`, `set_sound`, `set_track`, `set_global`, `set_raw`. No añadir más.
- **Cinco roles fijos:** `kick`, `bass`, `hats`, `perc`, `atmos`. No se crean ni se borran pistas.
- **Macros cerrados** (spec §6): kick `cuerpo/click/cola/saturación` · bass `acidez/peso/glide` · hats `densidad/brillo/swing` · perc `densidad/caos/espacio` · atmos `anchura/oscuridad/movimiento`. Valores `0..1`.
- **v1 es 100% síntesis.** Ningún sample, ningún `bank()`, ningún nombre de drum machine.
- **No se testea el audio.** Los tests son puros: strings y estructuras.
- **El compilador produce un string**, no un Pattern. El panel de código muestra ese mismo string.
- **Sin campo de longitud del loop:** la variación larga sale de las alternancias `<>` de la mini-notation.
- **Idioma de la UI: español.**

---

### Task 1: Scaffold y primer test verde

**Files:**
- Create: proyecto Next.js en la raíz del repo
- Create: `vitest.config.ts`
- Create: `src/lib/version.ts`
- Test: `src/lib/version.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: proyecto ejecutable con `npm run dev` y `npm test` funcionando

- [ ] **Step 1: Crear el proyecto Next.js en la raíz existente**

El repo ya tiene `docs/` y `.gitignore`. `create-next-app` en un directorio no vacío funciona si no hay conflictos de nombre.

```bash
npx --yes create-next-app@latest . --typescript --tailwind --app --src-dir --eslint --import-alias "@/*" --yes
```

- [ ] **Step 2: Instalar dependencias del núcleo**

```bash
npm i zod @strudel/web ai
npm i -D vitest
```

- [ ] **Step 3: Configurar Vitest**

Crear `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

Añadir a `package.json` en `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Escribir el test que falla**

Crear `src/lib/version.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { APP_NAME } from './version';

describe('version', () => {
  it('expone el nombre de la aplicación', () => {
    expect(APP_NAME).toBe('Bestral');
  });
});
```

- [ ] **Step 5: Ejecutar el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./version"`

- [ ] **Step 6: Implementar**

Crear `src/lib/version.ts`:

```ts
export const APP_NAME = 'Bestral';
```

- [ ] **Step 7: Ejecutar el test y verificar que pasa**

Run: `npm test`
Expected: PASS — 1 passed

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Vitest"
```

---

### Task 2: Modelo de proyecto

**Files:**
- Create: `src/lib/project.ts`
- Test: `src/lib/project.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type TrackRole = 'kick' | 'bass' | 'hats' | 'perc' | 'atmos'`
  - `const ROLES: readonly TrackRole[]`
  - `const MACROS: Record<TrackRole, readonly string[]>`
  - `type Track`, `type Project`
  - `const ProjectSchema`
  - `function defaultProject(): Project`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/project.test.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test src/lib/project.test.ts`
Expected: FAIL — `Failed to resolve import "./project"`

- [ ] **Step 3: Implementar**

Crear `src/lib/project.ts`:

```ts
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

export const ProjectSchema = z.object({
  bpm: z.number().int().min(60).max(200),
  swing: z.number().min(0).max(1),
  tracks: z.array(TrackSchema).length(ROLES.length),
});

export type Track = z.infer<typeof TrackSchema> & { role: TrackRole };
export type Project = z.infer<typeof ProjectSchema> & { tracks: Track[] };

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
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test src/lib/project.test.ts`
Expected: PASS — 7 passed

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: modelo de proyecto con roles y macros cerrados"
```

---

### Task 3: Mapeo de macros a parámetros de síntesis

Aquí vive el criterio musical. Es la parte que decide si Bestral suena bien, y por eso está aislada en su propio archivo.

**Files:**
- Create: `src/lib/macros.ts`
- Test: `src/lib/macros.test.ts`

**Interfaces:**
- Consumes: `TrackRole` de `src/lib/project.ts`
- Produces: `function macroParams(role: TrackRole, macros: Record<string, number>): string` — cadena de métodos Strudel encadenados, sin punto inicial. Ejemplo: `s("sine").decay(0.2).sustain(0)`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/macros.test.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test src/lib/macros.test.ts`
Expected: FAIL — `Failed to resolve import "./macros"`

- [ ] **Step 3: Implementar**

Crear `src/lib/macros.ts`:

```ts
import type { TrackRole } from './project';

// REGLA: ningún macro emite note() ni gain().
//   note() lo pone el patrón de la pista y competirían (ver compile.ts).
//   gain() lo pone el compilador desde track.gain; encadenar dos gain() hace
//   que el segundo pise al primero y el macro dejaría de tener efecto.

/** Interpola linealmente y redondea, para que el código generado sea legible. */
const lerp = (v: number, min: number, max: number, dec = 2): number =>
  Number((min + (max - min) * v).toFixed(dec));

/** Curva exponencial: para frecuencias, donde el oído no es lineal. */
const expLerp = (v: number, min: number, max: number): number =>
  Math.round(min * Math.pow(max / min, v));

type Chain = string[];

function kick(m: Record<string, number>): Chain {
  const c: Chain = [
    `s("sine")`,
    // cuerpo: paso bajo más cerrado = más sub y menos cuerpo medio
    `lpf(${expLerp(1 - m.cuerpo, 90, 400)})`,
    `decay(${lerp(m.cola, 0.08, 0.55)})`,
    `sustain(0)`,
    // click: ataque más corto = más transiente
    `attack(${lerp(m.click, 0.004, 0, 4)})`,
  ];
  if (m['saturación'] > 0.02) c.push(`shape(${lerp(m['saturación'], 0, 0.75)})`);
  return c;
}

function bass(m: Record<string, number>): Chain {
  // acidez: cutoff y resonancia acoplados. Es el gesto del 303.
  const c: Chain = [
    `s("sawtooth")`,
    `cutoff(${expLerp(m.acidez, 180, 4000)})`,
    `resonance(${lerp(m.acidez, 2, 28, 1)})`,
    `decay(${lerp(m.acidez, 0.35, 0.12)})`,
    `sustain(${lerp(m.peso, 0.05, 0.4)})`,
  ];
  if (m.glide > 0.02) c.push(`slide(${lerp(m.glide, 0, 0.5)})`);
  return c;
}

function hats(m: Record<string, number>): Chain {
  return [
    `s("white")`,
    `hpf(${expLerp(m.brillo, 3000, 12000)})`,
    `decay(${lerp(m.brillo, 0.06, 0.015, 3)})`,
    `sustain(0)`,
  ];
}

function perc(m: Record<string, number>): Chain {
  const c: Chain = [
    `s("white")`,
    `bpf(${expLerp(m.densidad, 700, 3500)})`,
    `decay(${lerp(m.espacio, 0.05, 0.22)})`,
    `sustain(0)`,
  ];
  if (m.espacio > 0.05) c.push(`room(${lerp(m.espacio, 0, 0.6)})`);
  // caos: probabilidad de que un golpe se caiga, para que no sea un bucle muerto
  if (m.caos > 0.05) c.push(`degradeBy(${lerp(m.caos, 0, 0.45)})`);
  return c;
}

function atmos(m: Record<string, number>): Chain {
  return [
    `s("sawtooth")`,
    `cutoff(${expLerp(1 - m.oscuridad, 250, 2600)})`,
    `attack(${lerp(m.movimiento, 0.2, 1.6)})`,
    `release(${lerp(m.movimiento, 0.5, 3)})`,
    `room(${lerp(m.anchura, 0.2, 0.9)})`,
  ];
}

const BY_ROLE: Record<TrackRole, (m: Record<string, number>) => Chain> = {
  kick, bass, hats, perc, atmos,
};

/**
 * Traduce los macros semánticos de una pista a métodos Strudel encadenados.
 * Devuelve `metodo(a).metodo(b)` sin punto inicial: el compilador lo antepone.
 */
export function macroParams(role: TrackRole, macros: Record<string, number>): string {
  return BY_ROLE[role](macros).join('.');
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test src/lib/macros.test.ts`
Expected: PASS — 7 passed

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: mapeo de macros semánticos a síntesis"
```

---

### Task 4: Compilador

**Files:**
- Create: `src/lib/compile.ts`
- Test: `src/lib/compile.test.ts`

**Interfaces:**
- Consumes: `Project`, `Track` de `project.ts`; `macroParams` de `macros.ts`
- Produces:
  - `function compileTrack(track: Track): string | null` — `null` si la pista no debe sonar
  - `function compile(project: Project): string` — documento Strudel completo

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/compile.test.ts`:

```ts
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

  it('el swing global se aplica solo cuando es mayor que cero', () => {
    expect(compile({ ...defaultProject(), swing: 0 })).not.toContain('.swingBy');
    expect(compile({ ...defaultProject(), swing: 0.3 })).toContain('.swingBy');
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
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test src/lib/compile.test.ts`
Expected: FAIL — `Failed to resolve import "./compile"`

- [ ] **Step 3: Implementar**

Crear `src/lib/compile.ts`:

```ts
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
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test src/lib/compile.test.ts`
Expected: PASS — 9 passed

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: compilador puro de proyecto a código Strudel"
```

---

### Task 5: Operaciones y aplicador

Esta tarea define el producto. El test del candado es el más importante del repositorio.

**Files:**
- Create: `src/lib/ops.ts`
- Create: `src/lib/apply.ts`
- Test: `src/lib/apply.test.ts`

**Interfaces:**
- Consumes: `Project`, `Track`, `MACROS`, `ROLES`, `ProjectSchema` de `project.ts`
- Produces:
  - En `ops.ts`: `const OpSchema`, `const OpsSchema`, `type Op` (unión discriminada por `type`)
  - En `apply.ts`: `type Rejection = { op: unknown; reason: string }` y
    `function applyOps(project: Project, ops: unknown[]): { project: Project; rejected: Rejection[] }`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/apply.test.ts`:

```ts
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
    const r = applyOps(defaultProject(), [{ type: 'set_global', bpm: 145, swing: 0.2 }]);
    expect(r.project.tracks).toHaveLength(5);
    expect(r.rejected).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test src/lib/apply.test.ts`
Expected: FAIL — `Failed to resolve import "./apply"`

- [ ] **Step 3: Implementar el esquema de operaciones**

Crear `src/lib/ops.ts`:

```ts
import { z } from 'zod';
import { ROLES } from './project';

const role = z.enum(ROLES);

export const OpSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set_macro'), track: role, macro: z.string(), value: z.number().min(0).max(1) }),
  z.object({ type: z.literal('set_pattern'), track: role, mini: z.string().min(1).max(200) }),
  z.object({ type: z.literal('set_sound'), track: role, sound: z.string().min(1) }),
  z.object({ type: z.literal('set_track'), track: role, gain: z.number().min(0).max(1.5).optional(), muted: z.boolean().optional() }),
  z.object({ type: z.literal('set_global'), bpm: z.number().int().min(60).max(200).optional(), swing: z.number().min(0).max(1).optional() }),
  z.object({ type: z.literal('set_raw'), track: role, code: z.string().max(600).nullable() }),
]);

export const OpsSchema = z.array(OpSchema).max(12);

export type Op = z.infer<typeof OpSchema>;
```

- [ ] **Step 4: Implementar el aplicador**

Crear `src/lib/apply.ts`:

```ts
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
      const t = actual.tracks.find((x) => x.role === op.track);
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
      return { ...p, bpm: op.bpm ?? p.bpm, swing: op.swing ?? p.swing };
  }
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test src/lib/apply.test.ts`
Expected: PASS — 14 passed

- [ ] **Step 6: Ejecutar toda la batería**

Run: `npm test`
Expected: PASS — todos los archivos en verde

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: aplicador de operaciones con candados por pista"
```

---

### Task 6: Motor de audio

Primera tarea que toca el navegador. La API exacta de evaluación de Strudel se fija aquí con una comprobación real, no de memoria.

**Files:**
- Create: `src/engine/strudel.ts`
- Create: `src/app/probe/page.tsx` (página temporal de verificación, se borra en el paso 7)

**Interfaces:**
- Consumes: nada
- Produces:
  - `async function initEngine(): Promise<void>`
  - `function playCode(code: string): void`
  - `function playQuantized(code: string, bpm: number): void`
  - `function stopEngine(): void`

- [ ] **Step 1: Página de sonda para fijar la API**

Crear `src/app/probe/page.tsx`:

```tsx
'use client';
import { useState } from 'react';

const CODE = `setcps(0.55)\n\n$: note("c1*4").s("sine").lpf(200).decay(0.2).sustain(0)`;

export default function Probe() {
  const [log, setLog] = useState<string[]>([]);
  const di = (m: string) => setLog((l) => [...l, m]);

  const run = async () => {
    const w = window as unknown as Record<string, unknown>;
    const mod = await import('@strudel/web');
    di('claves del módulo: ' + Object.keys(mod).join(', '));
    await (mod as unknown as { initStrudel: () => Promise<void> }).initStrudel();
    di('initStrudel ok');
    di('evaluate global: ' + typeof w.evaluate);
    di('webaudioRepl global: ' + typeof w.webaudioRepl);
    try {
      await (w.evaluate as (c: string) => Promise<unknown>)(CODE);
      di('OK: evaluate(code) suena');
    } catch (e) { di('evaluate falló: ' + String(e)); }
  };

  return (
    <main style={{ padding: 24, fontFamily: 'monospace' }}>
      <button onClick={run}>PROBE</button>
      <pre>{log.join('\n')}</pre>
    </main>
  );
}
```

- [ ] **Step 2: Ejecutar la sonda y anotar el resultado**

Run: `npm run dev`, abrir `http://localhost:3000/probe`, pulsar PROBE.

Expected: la línea `OK: evaluate(code) suena` y un kick audible a 132 BPM.

**Criterio de decisión — anotar cuál se cumple:**
- Si `evaluate global: function` y suena → camino A en el paso 3.
- Si no, pero `webaudioRepl global: function` → camino B en el paso 3.

- [ ] **Step 3: Implementar el motor**

Crear `src/engine/strudel.ts`. Dejar activo el camino que se cumplió en el paso 2 y borrar el otro:

```ts
'use client';

let arrancado = false;
let evaluar: ((code: string) => Promise<unknown>) | null = null;
let t0 = 0;

/** Arranca Strudel. Debe llamarse desde un gesto real del usuario (spec §11.3). */
export async function initEngine(): Promise<void> {
  if (arrancado) return;
  const mod = await import('@strudel/web');
  await (mod as unknown as { initStrudel: () => Promise<void> }).initStrudel();

  const w = window as unknown as Record<string, unknown>;

  // --- CAMINO A: evaluate global ---
  evaluar = w.evaluate as (code: string) => Promise<unknown>;

  // --- CAMINO B: repl propio (borrar el camino A si se usa este) ---
  // const repl = (w.webaudioRepl as () => { evaluate: (c: string) => Promise<unknown> })();
  // evaluar = (code) => repl.evaluate(code);

  if (typeof evaluar !== 'function') throw new Error('Strudel: no hay forma de evaluar código');
  arrancado = true;
  t0 = performance.now();
}

/**
 * Evalúa el documento. Si ya sonaba, Strudel lo intercambia en caliente
 * manteniendo la fase del ciclo (validado en el spike, spec §8).
 */
export function playCode(code: string): void {
  if (!arrancado || !evaluar) throw new Error('initEngine() no se ha llamado');
  void evaluar(code);
}

let pendiente: string | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;

/**
 * Encola el documento y lo aplica en el siguiente límite de compás.
 * Sin esto, cada edición entra a contratiempo y en techno se oye (spec §11.2).
 *
 * ponytail: cuantización por reloj de pared contra el arranque del motor.
 * Si el desfase acumulado molesta, engancharse al scheduler de Strudel.
 */
export function playQuantized(code: string, bpm: number): void {
  pendiente = code;
  if (temporizador) return;
  const compasMs = (60_000 / bpm) * 4;
  const espera = compasMs - ((performance.now() - t0) % compasMs);
  temporizador = setTimeout(() => {
    temporizador = null;
    if (pendiente) { playCode(pendiente); pendiente = null; }
  }, espera);
}

export function stopEngine(): void {
  if (temporizador) { clearTimeout(temporizador); temporizador = null; }
  pendiente = null;
  (window as unknown as { hush?: () => void }).hush?.();
}
```

- [ ] **Step 4: Verificar el intercambio en caliente y la cuantización**

Añadir a `src/app/probe/page.tsx` un segundo botón que alterne entre estos dos documentos usando `playQuantized(doc, 132)`:

```tsx
const A = `setcps(0.55)\n\n$: note("c1*4").s("sine").lpf(200).decay(0.2).sustain(0)\n$: note("<c2 eb2>").s("sawtooth").cutoff(300)`;
const B = A.replace('cutoff(300)', 'cutoff(2500).resonance(20)');
```

Pulsarlo repetidamente y a destiempo.

Expected: el kick **no se interrumpe ni se reinicia**, el bajo se abre y se cierra, y el cambio **siempre entra en el pulso**, nunca a mitad de compás.

- [ ] **Step 5: Borrar la sonda y commit**

```bash
rm -rf src/app/probe
git add -A
git commit -m "feat: motor de audio con intercambio en caliente cuantizado"
```

---

### Task 7: Historial de deshacer

**Files:**
- Create: `src/lib/history.ts`
- Test: `src/lib/history.test.ts`

**Interfaces:**
- Consumes: `Project` de `project.ts`
- Produces:
  - `type History = { pasado: Project[]; presente: Project; futuro: Project[] }`
  - `function nuevaHistoria(p: Project): History`
  - `function empujar(h: History, p: Project): History`
  - `function deshacer(h: History): History`
  - `function rehacer(h: History): History`
  - `function puedeDeshacer(h: History): boolean`
  - `function puedeRehacer(h: History): boolean`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/history.test.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test src/lib/history.test.ts`
Expected: FAIL — `Failed to resolve import "./history"`

- [ ] **Step 3: Implementar**

Crear `src/lib/history.ts`:

```ts
import type { Project } from './project';

const MAX = 50;

export type History = { pasado: Project[]; presente: Project; futuro: Project[] };

export function nuevaHistoria(p: Project): History {
  return { pasado: [], presente: p, futuro: [] };
}

export function empujar(h: History, p: Project): History {
  return { pasado: [...h.pasado, h.presente].slice(-MAX), presente: p, futuro: [] };
}

export function deshacer(h: History): History {
  if (h.pasado.length === 0) return h;
  return {
    pasado: h.pasado.slice(0, -1),
    presente: h.pasado[h.pasado.length - 1],
    futuro: [h.presente, ...h.futuro],
  };
}

export function rehacer(h: History): History {
  if (h.futuro.length === 0) return h;
  const [siguiente, ...resto] = h.futuro;
  return { pasado: [...h.pasado, h.presente], presente: siguiente, futuro: resto };
}

export const puedeDeshacer = (h: History) => h.pasado.length > 0;
export const puedeRehacer = (h: History) => h.futuro.length > 0;
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test src/lib/history.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: historial de deshacer y rehacer"
```

---

### Task 8: Mesa de mezclas

Primera vez que se oye Bestral entero. Al terminar esta tarea hay un producto usable sin IA.

**Files:**
- Create: `src/components/MacroKnob.tsx`
- Create: `src/components/TrackStrip.tsx`
- Create: `src/components/Mixer.tsx`
- Modify: `src/app/page.tsx` (reemplazar el contenido del scaffold)

**Interfaces:**
- Consumes: `Project`, `Track`, `MACROS`, `applyOps`, `compile`, `initEngine`, `playQuantized`, `stopEngine`, y todo `history.ts`
- Produces: `<Mixer project={Project} onChange={(p: Project) => void} />`

- [ ] **Step 1: El knob**

Crear `src/components/MacroKnob.tsx`:

```tsx
'use client';

export function MacroKnob({ nombre, valor, deshabilitado, onChange }: {
  nombre: string;
  valor: number;
  deshabilitado: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs ${deshabilitado ? 'opacity-40' : ''}`}>
      <span className="flex justify-between">
        <span>{nombre}</span>
        <span className="tabular-nums text-neutral-500">{Math.round(valor * 100)}</span>
      </span>
      <input
        type="range" min={0} max={1} step={0.01} value={valor} disabled={deshabilitado}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={nombre}
        className="w-full accent-lime-400"
      />
    </label>
  );
}
```

- [ ] **Step 2: La tira de pista**

Crear `src/components/TrackStrip.tsx`:

```tsx
'use client';
import { MACROS, type Track } from '@/lib/project';
import { MacroKnob } from './MacroKnob';

export function TrackStrip({ track, enSolo, onOp, onToggleLock, onToggleSolo }: {
  track: Track;
  enSolo: boolean;
  onOp: (op: unknown) => void;
  onToggleLock: () => void;
  onToggleSolo: () => void;
}) {
  const enCodigo = track.raw !== null;

  return (
    <div className={`rounded border p-3 ${track.locked ? 'border-amber-400' : 'border-neutral-800'}`}>
      <div className="flex items-center gap-2">
        <strong className="flex-1 uppercase tracking-wide">{track.role}</strong>
        <button
          onClick={() => onOp({ type: 'set_track', track: track.role, muted: !track.muted })}
          aria-pressed={track.muted} title="Silenciar"
          className={`px-2 text-xs ${track.muted ? 'bg-neutral-700' : ''}`}>M</button>
        {/* Solo: es escucha, no una propiedad del proyecto. Vive en la UI y no
            entra en el historial, para que deshacer no revierta un solo. */}
        <button onClick={onToggleSolo} aria-pressed={enSolo} title="Escuchar solo esta pista"
          className={`px-2 text-xs ${enSolo ? 'bg-lime-400 text-black' : ''}`}>S</button>
        {/* El candado NO pasa por el aplicador: es la UI quien manda sobre él (spec §5) */}
        <button
          onClick={onToggleLock} aria-pressed={track.locked}
          title={track.locked ? 'Desbloquear' : 'Bloquear: la IA no podrá tocarla'}
          className={`px-2 text-xs ${track.locked ? 'bg-amber-400 text-black' : ''}`}>
          {track.locked ? '🔒' : '🔓'}
        </button>
      </div>

      {enCodigo && (
        <p className="mt-2 text-xs text-amber-400">En modo código: los macros están desactivados.</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {MACROS[track.role].map((m) => (
          <MacroKnob key={m} nombre={m} valor={track.macros[m] ?? 0.5}
            deshabilitado={enCodigo || track.locked}
            onChange={(v) => onOp({ type: 'set_macro', track: track.role, macro: m, value: v })} />
        ))}
        <MacroKnob nombre="volumen" valor={track.gain} deshabilitado={track.locked}
          onChange={(v) => onOp({ type: 'set_track', track: track.role, gain: v })} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: La mesa**

Crear `src/components/Mixer.tsx`:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import type { Project } from '@/lib/project';
import { applyOps } from '@/lib/apply';
import { compile } from '@/lib/compile';
import { initEngine, playQuantized, stopEngine } from '@/engine/strudel';
import { TrackStrip } from './TrackStrip';

export function Mixer({ project, onChange }: {
  project: Project;
  onChange: (p: Project) => void;
}) {
  const [sonando, setSonando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [solo, setSolo] = useState<string | null>(null);
  const yaSono = useRef(false);

  // El solo es escucha, no estado del proyecto: se aplica al compilar y ya.
  const paraSonar: Project = solo === null ? project : {
    ...project,
    tracks: project.tracks.map((t) => (t.role === solo ? t : { ...t, muted: true })),
  };

  // Recompila y reprograma en cuanto cambia el proyecto. Nunca llama al LLM.
  useEffect(() => {
    if (!sonando) return;
    playQuantized(compile(paraSonar), paraSonar.bpm);
    // paraSonar se deriva de project y solo; ambos están en las dependencias
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, solo, sonando]);

  // El AudioContext exige un gesto real del usuario (spec §11.3).
  const arrancar = async () => {
    await initEngine();
    yaSono.current = true;
    setSonando(true);
  };

  const parar = () => { stopEngine(); setSonando(false); };

  const aplicar = (op: unknown) => {
    const r = applyOps(project, [op]);
    setAviso(r.rejected[0]?.reason ?? null);
    if (r.rejected.length === 0) onChange(r.project);
  };

  const alternarCandado = (role: string) => onChange({
    ...project,
    tracks: project.tracks.map((t) => (t.role === role ? { ...t, locked: !t.locked } : t)),
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={sonando ? parar : arrancar}
          className="rounded bg-lime-400 px-4 py-2 font-bold text-black">
          {sonando ? 'PARAR' : yaSono.current ? 'SONAR' : 'EMPEZAR'}
        </button>
        <label className="text-sm">
          BPM{' '}
          <input type="number" min={60} max={200} value={project.bpm}
            onChange={(e) => aplicar({ type: 'set_global', bpm: Number(e.target.value) })}
            className="w-16 bg-neutral-900 px-1" />
        </label>
      </div>

      {aviso && <p role="status" className="text-sm text-amber-400">{aviso}</p>}

      <div className="grid gap-3 md:grid-cols-5">
        {project.tracks.map((t) => (
          <TrackStrip key={t.role} track={t} onOp={aplicar}
            enSolo={solo === t.role}
            onToggleSolo={() => setSolo(solo === t.role ? null : t.role)}
            onToggleLock={() => alternarCandado(t.role)} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Cablearlo en la página**

Reemplazar por completo el contenido de `src/app/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { defaultProject } from '@/lib/project';
import { nuevaHistoria, empujar, deshacer, rehacer, puedeDeshacer, puedeRehacer } from '@/lib/history';
import { Mixer } from '@/components/Mixer';

export default function Home() {
  const [h, setH] = useState(() => nuevaHistoria(defaultProject()));

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <header className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Bestral</h1>
        <button onClick={() => setH(deshacer(h))} disabled={!puedeDeshacer(h)}
          className="text-sm disabled:opacity-30">Deshacer</button>
        <button onClick={() => setH(rehacer(h))} disabled={!puedeRehacer(h)}
          className="text-sm disabled:opacity-30">Rehacer</button>
      </header>

      <Mixer project={h.presente} onChange={(p) => setH(empujar(h, p))} />
    </main>
  );
}
```

- [ ] **Step 5: Verificar a mano**

Run: `npm run dev`, abrir `http://localhost:3000`

Comprobar en este orden:
1. EMPEZAR → suena un loop de techno con kick, bajo y hats.
2. Mover `acidez` del bajo → el filtro se abre **sin cortes**.
3. Silenciar el kick con M → desaparece y el resto sigue en fase.
4. Pulsar S en el bajo → solo se oye el bajo; volver a pulsarlo lo devuelve todo.
5. Bloquear el bajo → sus knobs se deshabilitan.
6. Deshacer → el estado anterior vuelve y se oye. **El solo no se revierte**: es escucha, no proyecto.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: mesa de mezclas con macros, candados y deshacer"
```

---

### Task 9: El chat

**Files:**
- Create: `src/lib/prompt.ts`
- Create: `src/app/api/chat/route.ts`
- Create: `src/components/ChatPanel.tsx`
- Create: `.env.example`
- Modify: `src/app/page.tsx`
- Test: `src/lib/prompt.test.ts`

**Interfaces:**
- Consumes: `Project`, `MACROS`, `ProjectSchema`, `OpsSchema`, `applyOps`
- Produces:
  - `function systemPrompt(project: Project): string`
  - `POST /api/chat` con cuerpo `{ mensaje: string, project: Project }` → `{ ops: Op[], comentario: string }`
  - `<ChatPanel project={Project} onOps={(ops: unknown[]) => string[]} />` — `onOps` devuelve los motivos de rechazo

- [ ] **Step 1: Escribir los tests del prompt**

Crear `src/lib/prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { systemPrompt } from './prompt';
import { defaultProject } from './project';

describe('prompt del sistema', () => {
  it('incluye el estado actual de cada pista', () => {
    const p = systemPrompt(defaultProject());
    for (const role of ['kick', 'bass', 'hats', 'perc', 'atmos']) expect(p).toContain(role);
  });

  it('nombra las pistas bloqueadas para no gastar operaciones en ellas', () => {
    const proj = defaultProject();
    proj.tracks[0].locked = true;
    expect(systemPrompt(proj)).toContain('BLOQUEADA');
  });

  it('lista los macros válidos de cada rol', () => {
    const p = systemPrompt(defaultProject());
    expect(p).toContain('saturación');
    expect(p).toContain('acidez');
  });

  it('advierte de que no hay samples disponibles', () => {
    expect(systemPrompt(defaultProject()).toLowerCase()).toContain('sample');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test src/lib/prompt.test.ts`
Expected: FAIL — `Failed to resolve import "./prompt"`

- [ ] **Step 3: Implementar el prompt**

Crear `src/lib/prompt.ts`:

```ts
import { MACROS, type Project } from './project';

export function systemPrompt(project: Project): string {
  const pistas = project.tracks.map((t) => {
    const macros = Object.entries(t.macros).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ');
    const marcas = [
      t.locked ? 'BLOQUEADA' : null,
      t.muted ? 'silenciada' : null,
      t.raw !== null ? 'en modo código' : null,
    ].filter(Boolean).join(', ');
    const cuerpo = t.raw !== null
      ? `código: ${t.raw}`
      : `patrón: "${t.pattern}" · macros: ${macros}`;
    return `- ${t.role}${marcas ? ` (${marcas})` : ''} · ${cuerpo} · macros válidos: ${MACROS[t.role].join(', ')}`;
  }).join('\n');

  return `Eres el motor musical de Bestral, un estudio de techno.

Traduces lo que pide el usuario a operaciones sobre el proyecto. NO escribes prosa larga
ni explicas teoría musical: devuelves operaciones y un comentario de una frase.

ESTADO ACTUAL — ${project.bpm} BPM, swing ${project.swing}
${pistas}

REGLAS
- Las pistas marcadas BLOQUEADA no se tocan. Cualquier operación sobre ellas será rechazada,
  así que no la emitas: dilo en el comentario.
- Prefiere set_macro a set_pattern. Los macros son continuos y reversibles; reescribir el
  patrón destruye lo que el usuario ya había conseguido.
- Cambia solo lo que se te pide. Si piden "más ácido el bajo", no toques el kick.
- Los valores de macro van de 0 a 1. Para "un poco más" mueve ~0.15; para "mucho más", ~0.35.
- set_pattern usa mini-notation de Strudel. Para que el loop dure varios compases usa
  alternancias: "<c1*4 c1*4 c1*4 [c1*4 c1]>" varía a lo largo de cuatro compases.
- NO hay samples cargados. No uses bank() ni nombres de drum machines: todo es síntesis, y el
  timbre se controla con los macros.
- set_raw solo cuando lo que piden no cabe en los macros ni en el patrón. Avisa en el
  comentario de que esa pista pasa a modo código.
- El comentario va en español, en una frase, y dice qué has cambiado.`;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test src/lib/prompt.test.ts`
Expected: PASS — 4 passed

- [ ] **Step 5: La ruta de API**

Crear `src/app/api/chat/route.ts`:

```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { ProjectSchema } from '@/lib/project';
import { OpsSchema } from '@/lib/ops';
import { systemPrompt } from '@/lib/prompt';

export const maxDuration = 30;

const Entrada = z.object({
  mensaje: z.string().min(1).max(500),
  project: ProjectSchema,
});

export async function POST(req: Request) {
  const parsed = Entrada.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: 'petición inválida' }, { status: 400 });

  const { mensaje, project } = parsed.data;

  try {
    const { object } = await generateObject({
      model: 'anthropic/claude-sonnet-5',
      schema: z.object({ ops: OpsSchema, comentario: z.string().max(300) }),
      system: systemPrompt(project as never),
      prompt: mensaje,
    });
    return Response.json(object);
  } catch {
    return Response.json({ error: 'el modelo no ha podido responder' }, { status: 502 });
  }
}
```

- [ ] **Step 6: Variables de entorno**

Crear `.env.example`:

```
AI_GATEWAY_API_KEY=
```

Crear `.env.local` con una clave real de AI Gateway. Ya está cubierto por el patrón `.env*` de `.gitignore`.

- [ ] **Step 7: El panel de chat**

Crear `src/components/ChatPanel.tsx`:

```tsx
'use client';
import { useState, type FormEvent } from 'react';
import type { Project } from '@/lib/project';

type Turno = { yo: string; bestral: string };

export function ChatPanel({ project, onOps }: {
  project: Project;
  onOps: (ops: unknown[]) => string[];
}) {
  const [texto, setTexto] = useState('');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [pensando, setPensando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const mensaje = texto.trim();
    if (!mensaje || pensando) return;
    setTexto('');
    setPensando(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje, project }),
      });
      if (!res.ok) throw new Error('fallo');
      const { ops, comentario } = await res.json();
      const rechazos = onOps(ops);
      setTurnos((t) => [...t, {
        yo: mensaje,
        bestral: rechazos.length ? `${comentario} (no aplicado: ${rechazos.join('; ')})` : comentario,
      }]);
    } catch {
      setTurnos((t) => [...t, { yo: mensaje, bestral: 'No he podido con eso. Prueba otra vez.' }]);
    } finally {
      setPensando(false);
    }
  };

  return (
    <aside className="mt-6 flex flex-col gap-3">
      <div className="space-y-3 text-sm">
        {turnos.map((t, i) => (
          <div key={i}>
            <p className="text-neutral-400">{t.yo}</p>
            <p className="text-lime-400">{t.bestral}</p>
          </div>
        ))}
        {/* Latencia asimétrica: el chat tarda segundos, los knobs no (spec §11.4) */}
        {pensando && <p className="animate-pulse text-neutral-500">pensando…</p>}
      </div>

      <form onSubmit={enviar} className="flex gap-2">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} disabled={pensando}
          placeholder="haz el bajo más ácido"
          className="flex-1 rounded bg-neutral-900 px-3 py-2 text-sm" />
        <button disabled={pensando}
          className="rounded bg-lime-400 px-3 font-bold text-black disabled:opacity-40">↵</button>
      </form>
    </aside>
  );
}
```

- [ ] **Step 8: Cablearlo en la página**

En `src/app/page.tsx`, añadir estos imports:

```tsx
import { applyOps } from '@/lib/apply';
import { ChatPanel } from '@/components/ChatPanel';
```

Y añadir dentro de `<main>`, bajo el `<Mixer>`:

```tsx
<ChatPanel
  project={h.presente}
  onOps={(ops) => {
    const r = applyOps(h.presente, ops);
    if (r.rejected.length < ops.length) setH(empujar(h, r.project));
    return r.rejected.map((x) => x.reason);
  }}
/>
```

- [ ] **Step 9: Verificar el candado de extremo a extremo**

Run: `npm run dev`

1. EMPEZAR, y bloquear el kick con su candado.
2. Escribir: **"haz el kick mucho más largo y saturado"**.
   Expected: el kick **no cambia** y la respuesta menciona que está bloqueado.
3. Escribir: **"haz el bajo más ácido"**.
   Expected: el bajo se abre y el kick sigue exactamente igual.

Este es el momento en que se comprueba que Bestral hace lo que promete.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: chat que emite operaciones validadas"
```

---

### Task 10: Panel de código

**Files:**
- Create: `src/components/CodePanel.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `compile`, `compileTrack` de `compile.ts`; `Project`, `TrackRole` de `project.ts`
- Produces: `<CodePanel project={Project} onOp={(op: unknown) => void} />`

- [ ] **Step 1: Implementar el panel**

Crear `src/components/CodePanel.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { compile, compileTrack } from '@/lib/compile';
import type { Project, TrackRole } from '@/lib/project';

export function CodePanel({ project, onOp }: {
  project: Project;
  onOp: (op: unknown) => void;
}) {
  const [editando, setEditando] = useState<TrackRole | null>(null);
  const [borrador, setBorrador] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abrir = (role: TrackRole) => {
    const t = project.tracks.find((x) => x.role === role)!;
    // Al pasar a modo código se parte de lo que ya sonaba, no de una hoja en blanco.
    const compilado = (compileTrack(t) ?? '').replace(/^\$:\s*/, '').replace(/\s*\/\/.*$/, '');
    setBorrador(t.raw ?? compilado);
    setEditando(role);
    setError(null);
  };

  const guardar = async () => {
    if (!editando) return;
    // Se evalúa ANTES de aplicar: nunca se deja el proyecto en estado mudo (spec §7).
    try {
      const w = window as unknown as { evaluate?: (c: string) => Promise<unknown> };
      if (w.evaluate) await w.evaluate(`$: ${borrador}`);
    } catch (e) {
      setError(`Ese código no compila: ${String(e)}`);
      return;
    }
    onOp({ type: 'set_raw', track: editando, code: borrador });
    setEditando(null);
  };

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm uppercase tracking-wide text-neutral-500">Código</h2>

      <pre className="overflow-x-auto rounded bg-black p-3 text-xs text-lime-300">
        {compile(project)}
      </pre>

      <div className="mt-2 flex flex-wrap gap-2">
        {project.tracks.map((t) => (
          <button key={t.role} onClick={() => abrir(t.role)} disabled={t.locked}
            className="rounded border border-neutral-700 px-2 py-1 text-xs disabled:opacity-30">
            editar {t.role}{t.raw !== null ? ' •' : ''}
          </button>
        ))}
      </div>

      {editando && (
        <div className="mt-3 space-y-2">
          <textarea value={borrador} onChange={(e) => setBorrador(e.target.value)} rows={3}
            aria-label={`código de ${editando}`}
            className="w-full rounded bg-black p-2 font-mono text-xs text-lime-300" />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 text-xs">
            <button onClick={guardar}
              className="rounded bg-lime-400 px-3 py-1 font-bold text-black">Aplicar</button>
            <button onClick={() => {
              onOp({ type: 'set_raw', track: editando, code: null });
              setEditando(null);
            }}>Volver a macros</button>
            <button onClick={() => setEditando(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Cablearlo**

En `src/app/page.tsx`, añadir el import:

```tsx
import { CodePanel } from '@/components/CodePanel';
```

Y añadir dentro de `<main>`, bajo el `<ChatPanel>`:

```tsx
<CodePanel
  project={h.presente}
  onOp={(op) => {
    const r = applyOps(h.presente, [op]);
    if (r.rejected.length === 0) setH(empujar(h, r.project));
  }}
/>
```

- [ ] **Step 3: Verificar a mano**

Run: `npm run dev`

1. El panel muestra el código y se actualiza al mover un knob.
2. "editar bass" → aparece lo que ya sonaba, no una hoja en blanco.
3. Escribir un disparate como `note("c2"` sin cerrar → sale el error y **el bajo sigue sonando**.
4. Escribir `note("c2*8").s("square")` → suena, y los knobs del bajo se deshabilitan.
5. "Volver a macros" → los knobs vuelven a funcionar.
6. Bloquear una pista → su botón de editar se deshabilita.

- [ ] **Step 4: Batería completa y commit**

Run: `npm test && npm run build`
Expected: todos los tests en verde y el build sin errores

```bash
git add -A
git commit -m "feat: panel de código con modo override por pista"
```

---

## Estado al terminar

Bestral suena, se edita con las manos y con frases, y respeta los candados. Falta la capa de plataforma —guardar, compartir, exportar WAV, vista móvil—, que va en el Plan 2 y no tiene sentido escribir antes de que el núcleo suene bien.

**Lo primero al terminar, antes de escribir el Plan 2:** sentarse a usarlo media hora con auriculares. Las curvas de la Tarea 3 están escritas a ciegas, y solo el oído dice si `acidez` a 0.7 suena a lo que un productor llama ácido. Ese ajuste es el trabajo que decide si el producto vale algo, y es la razón por la que la Tarea 3 vive aislada en su propio archivo.
