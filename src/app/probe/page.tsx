'use client';
import { useState } from 'react';
import { initEngine, playCode, playQuantized, stopEngine } from '@/engine/strudel';

// Sólo síntesis: bank("RolandTR909") da 404 (spike), este proyecto no carga samples.
const CODE = `setcps(0.55)\n\n$: note("c1*4").s("sine").lpf(200).decay(0.2).sustain(0)`;
const A = `setcps(0.55)\n\n$: note("c1*4").s("sine").lpf(200).decay(0.2).sustain(0)\n$: note("<c2 eb2>").s("sawtooth").cutoff(300)`;
const B = A.replace('cutoff(300)', 'cutoff(2500).resonance(20)');

export default function Probe() {
  const [log, setLog] = useState<string[]>([]);
  const [flip, setFlip] = useState(false);
  const di = (m: string) => setLog((l) => [...l, m]);

  const probe = async () => {
    try {
      const mod = await import('@strudel/web');
      di('claves del módulo: ' + Object.keys(mod).join(', '));
      const w = window as unknown as Record<string, unknown>;
      di('evaluate global: ' + typeof w.evaluate);
      di('webaudioRepl global: ' + typeof w.webaudioRepl);
      await initEngine();
      di('initEngine ok');
      playCode(CODE);
      di('OK: playCode(code) suena');
    } catch (e) {
      di('fallo: ' + String(e));
    }
  };

  const swap = () => {
    const doc = flip ? B : A;
    di('playQuantized encolado: ' + (flip ? 'B (resonance)' : 'A (cutoff 300)'));
    setFlip(!flip);
    playQuantized(doc, 132);
  };

  const stop = () => {
    stopEngine();
    di('stopEngine');
  };

  return (
    <main style={{ padding: 24, fontFamily: 'monospace' }}>
      <button onClick={probe}>PROBE</button>{' '}
      <button onClick={swap}>SWAP (quantized 132bpm)</button>{' '}
      <button onClick={stop}>STOP</button>
      <pre>{log.join('\n')}</pre>
    </main>
  );
}
