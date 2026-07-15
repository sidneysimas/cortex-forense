import { useMemo, useState } from "react";
import { FileCode2, Search, GitCompare, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  parseBundleToFiles,
  type StructuralReport,
  type StructuralMatch,
} from "@/lib/structural-plagiarism";

type Category =
  | "IDÊNTICO"
  | "ALTA SIMILARIDADE"
  | "SIMILAR PARCIAL"
  | "DIVERGENTE"
  | "SEM CORRESPONDÊNCIA";

function classify(sim: number): Category {
  if (sim >= 85) return "IDÊNTICO";
  if (sim >= 60) return "ALTA SIMILARIDADE";
  if (sim >= 30) return "SIMILAR PARCIAL";
  if (sim > 0) return "DIVERGENTE";
  return "SEM CORRESPONDÊNCIA";
}

const CATEGORY_STYLE: Record<Category, string> = {
  "IDÊNTICO": "bg-red-500/20 text-red-300 border-red-500/40",
  "ALTA SIMILARIDADE": "bg-orange-500/20 text-orange-300 border-orange-500/40",
  "SIMILAR PARCIAL": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "DIVERGENTE": "bg-sky-500/10 text-sky-300 border-sky-500/25",
  "SEM CORRESPONDÊNCIA": "bg-white/5 text-white/40 border-white/10",
};

const CATEGORY_ORDER: Category[] = [
  "IDÊNTICO",
  "ALTA SIMILARIDADE",
  "SIMILAR PARCIAL",
  "DIVERGENTE",
  "SEM CORRESPONDÊNCIA",
];

type FileRow = {
  path: string;
  tokens: number;
  pairPath: string | null;
  sim: number;
  category: Category;
};

function buildRows(
  files: { file: string; tokens: unknown[] }[],
  best: Map<string, { other: string; sim: number }>,
): FileRow[] {
  return files
    .map((f) => {
      const b = best.get(f.file);
      const sim = b?.sim ?? 0;
      return {
        path: f.file,
        tokens: f.tokens.length,
        pairPath: b?.other ?? null,
        sim,
        category: classify(sim),
      } satisfies FileRow;
    })
    .sort((a, b) => (b.sim - a.sim) || a.path.localeCompare(b.path));
}

function FileList({
  side,
  rows,
  filter,
  onOpen,
}: {
  side: "A" | "B";
  rows: FileRow[];
  filter: string;
  onOpen: (row: FileRow) => void;
}) {
  const filtered = filter
    ? rows.filter((r) => r.path.toLowerCase().includes(filter.toLowerCase()))
    : rows;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
          {side}
        </div>
        <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
          Repositório {side} — {rows.length} arquivos
        </p>
      </div>
      <div className="max-h-[360px] overflow-auto custom-scrollbar rounded-xl border border-white/5 divide-y divide-white/5">
        {filtered.length === 0 && (
          <p className="text-[11px] text-white/30 italic p-3">Nenhum arquivo encontrado.</p>
        )}
        {filtered.map((r) => {
          const clickable = r.pairPath !== null;
          return (
            <button
              key={r.path}
              type="button"
              onClick={() => clickable && onOpen(r)}
              disabled={!clickable}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                clickable ? "hover:bg-white/[0.04] cursor-pointer" : "cursor-default opacity-70"
              }`}
            >
              <FileCode2 className="h-3 w-3 text-white/30 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono text-white/80 truncate" title={r.path}>
                  {r.path}
                </p>
                <p className="text-[10px] text-white/40 truncate">
                  {r.tokens} tokens
                  {r.pairPath && (
                    <>
                      {" · ↔ "}
                      <span className="text-white/50" title={r.pairPath}>
                        {r.pairPath.split("/").pop()}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`text-[9px] font-bold border ${CATEGORY_STYLE[r.category]}`}
              >
                {r.category === "SEM CORRESPONDÊNCIA" ? "SEM PAR" : `${r.sim}%`}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FileInventoryPanel({
  bundleA,
  bundleB,
  report,
}: {
  bundleA: string;
  bundleB: string;
  report: StructuralReport;
}) {
  const [filter, setFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRow, setDialogRow] = useState<{ side: "A" | "B"; row: FileRow } | null>(null);

  const { rowsA, rowsB, matchesByFileA, matchesByFileB, counts } = useMemo(() => {
    const filesA = parseBundleToFiles(bundleA);
    const filesB = parseBundleToFiles(bundleB);

    const bestA = new Map<string, { other: string; sim: number }>();
    const bestB = new Map<string, { other: string; sim: number }>();
    for (const p of report.filePairs) {
      const a = bestA.get(p.a);
      if (!a || p.similarity > a.sim) bestA.set(p.a, { other: p.b, sim: p.similarity });
      const b = bestB.get(p.b);
      if (!b || p.similarity > b.sim) bestB.set(p.b, { other: p.a, sim: p.similarity });
    }

    const rowsA = buildRows(filesA, bestA);
    const rowsB = buildRows(filesB, bestB);

    const matchesByFileA = new Map<string, StructuralMatch[]>();
    const matchesByFileB = new Map<string, StructuralMatch[]>();
    for (const m of report.matches) {
      if (!matchesByFileA.has(m.fileA)) matchesByFileA.set(m.fileA, []);
      matchesByFileA.get(m.fileA)!.push(m);
      if (!matchesByFileB.has(m.fileB)) matchesByFileB.set(m.fileB, []);
      matchesByFileB.get(m.fileB)!.push(m);
    }

    const allRows = [...rowsA, ...rowsB];
    const counts: Record<Category, number> = {
      "IDÊNTICO": 0,
      "ALTA SIMILARIDADE": 0,
      "SIMILAR PARCIAL": 0,
      "DIVERGENTE": 0,
      "SEM CORRESPONDÊNCIA": 0,
    };
    for (const r of allRows) counts[r.category]++;

    return { rowsA, rowsB, matchesByFileA, matchesByFileB, counts };
  }, [bundleA, bundleB, report]);

  const openDialog = (side: "A" | "B", row: FileRow) => {
    setDialogRow({ side, row });
    setDialogOpen(true);
  };

  const dialogMatches = useMemo(() => {
    if (!dialogRow) return [];
    const src =
      dialogRow.side === "A"
        ? matchesByFileA.get(dialogRow.row.path)
        : matchesByFileB.get(dialogRow.row.path);
    return (src ?? []).slice(0, 10);
  }, [dialogRow, matchesByFileA, matchesByFileB]);

  return (
    <div className="mb-5 p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <GitCompare className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-bold uppercase tracking-widest text-white">
          Inventário completo de arquivos
        </h4>
        <Badge variant="outline" className="ml-auto text-[9px] text-white/40 border-white/10">
          {rowsA.length + rowsB.length} arquivos (A + B)
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_ORDER.map((c) => (
          <span
            key={c}
            className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${CATEGORY_STYLE[c]}`}
          >
            {c} · {counts[c]}
          </span>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por nome de arquivo..."
          className="h-8 pl-8 text-xs bg-black/40 border-white/10 rounded-xl"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FileList side="A" rows={rowsA} filter={filter} onOpen={(r) => openDialog("A", r)} />
        <FileList side="B" rows={rowsB} filter={filter} onOpen={(r) => openDialog("B", r)} />
      </div>

      <p className="text-[10px] text-white/30 leading-relaxed border-t border-white/5 pt-2">
        Clique em qualquer arquivo com correspondência estrutural para visualizar os trechos
        idênticos detectados pelo Greedy String Tiling. Arquivos "SEM PAR" não têm bloco
        estruturalmente compartilhado com o outro repositório.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl bg-neutral-950 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono text-white flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-primary" />
              {dialogRow?.row.path}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/50">
              {dialogRow && (
                <>
                  Repositório {dialogRow.side} · {dialogRow.row.tokens} tokens ·{" "}
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${CATEGORY_STYLE[dialogRow.row.category]}`}
                  >
                    {dialogRow.row.category} ({dialogRow.row.sim}%)
                  </span>
                  {dialogRow.row.pairPath && (
                    <>
                      {" ↔ "}
                      <span className="font-mono text-white/70">{dialogRow.row.pairPath}</span>
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-auto custom-scrollbar space-y-4 pr-1">
            {dialogMatches.length === 0 && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-xs text-white/50">
                Este arquivo tem similaridade agregada com o par indicado, mas nenhum bloco
                individual atingiu o tamanho mínimo (minMatch = {report.minMatchUsed} tokens) entre
                os {report.matches.length} blocos preservados no relatório. A similaridade vem da
                soma de fragmentos curtos abaixo do limiar de retenção.
              </div>
            )}
            {dialogMatches.map((m, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-black/40 overflow-hidden"
              >
                <div className="px-3 py-2 border-b border-white/10 bg-white/[0.02] flex items-center gap-2 text-[11px]">
                  <Badge
                    variant="outline"
                    className="text-[9px] bg-primary/15 text-primary border-primary/30 font-bold"
                  >
                    Bloco #{i + 1} · {m.length} tokens
                  </Badge>
                  <span className="text-white/40 font-mono truncate">
                    A: {m.fileA} L{m.linesA[0]}–{m.linesA[1]}
                  </span>
                  <span className="text-white/20">↔</span>
                  <span className="text-white/40 font-mono truncate">
                    B: {m.fileB} L{m.linesB[0]}–{m.linesB[1]}
                  </span>
                </div>
                <div className="grid md:grid-cols-2 divide-x divide-white/10">
                  <pre className="p-3 text-[11px] font-mono text-white/75 whitespace-pre-wrap break-words leading-relaxed">
{m.snippetA}
                  </pre>
                  <pre className="p-3 text-[11px] font-mono text-white/75 whitespace-pre-wrap break-words leading-relaxed">
{m.snippetB}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
