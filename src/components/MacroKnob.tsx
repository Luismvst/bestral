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
