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
