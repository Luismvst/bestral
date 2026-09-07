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
