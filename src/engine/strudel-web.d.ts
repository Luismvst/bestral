// @strudel/web no publica tipos (sin .d.ts en el paquete, sin @types/strudel__web).
// Declaración mínima con la forma real de los exports que usamos (comprobado
// leyendo node_modules/@strudel/web/web.mjs y dist/index.mjs: son named exports
// del módulo, no globales en `window`).
declare module '@strudel/web' {
  export function initStrudel(options?: Record<string, unknown>): Promise<unknown>;
  export function evaluate(code: string, autoplay?: boolean): Promise<unknown>;
  export function hush(): void;
}
