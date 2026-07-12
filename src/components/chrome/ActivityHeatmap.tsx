const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function ActivityHeatmap({ matrix }: { matrix: number[][] }) {
  let max = 0;
  for (const row of matrix) for (const v of row) if (v > max) max = v;

  const intensity = (v: number) => {
    if (!max || !v) return 0;
    return v / max;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-[3px] items-center">
          <div />
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="text-[9px] text-white/30 text-center">{h}</div>
          ))}
          {matrix.map((row, d) => (
            <>
              <div key={`d-${d}`} className="text-[10px] text-white/40 font-medium">{DAYS[d]}</div>
              {row.map((v, h) => {
                const t = intensity(v);
                return (
                  <div
                    key={`${d}-${h}`}
                    title={`${DAYS[d]} ${h}h — ${v} visitas`}
                    className="aspect-square rounded-[3px] border border-white/[0.03]"
                    style={{
                      background: t === 0
                        ? "rgba(255,255,255,0.03)"
                        : `rgba(16, 185, 129, ${0.2 + t * 0.8})`,
                    }}
                  />
                );
              })}
            </>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-[10px] text-white/40">
          <span>Menor</span>
          <div className="flex gap-[2px]">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((a) => (
              <div key={a} className="h-2.5 w-4 rounded-sm" style={{ background: `rgba(16,185,129,${a})` }} />
            ))}
          </div>
          <span>Maior</span>
          <span className="ml-auto">Pico: {max} visitas/hora</span>
        </div>
      </div>
    </div>
  );
}
