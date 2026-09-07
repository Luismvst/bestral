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
