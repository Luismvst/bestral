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
