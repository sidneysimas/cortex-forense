// Web Worker: runs the JPlag-style structural analysis off the main thread.
// The main UI stays responsive even with thousands of files, and the browser
// never shows "Página sem resposta" — the tab keeps rendering while GST runs.
import {
  analyzeStructural,
  computeEvidenceHash,
  type StructuralReport,
} from "@/lib/structural-plagiarism";

export type WorkerRequest = {
  type: "analyze";
  bundleA: string;
  bundleB: string;
};

export type WorkerResponse =
  | { type: "progress"; done: number; total: number }
  | { type: "done"; report: StructuralReport; hash: string }
  | { type: "error"; message: string };

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (msg.type !== "analyze") return;
  try {
    const report = await analyzeStructural(msg.bundleA, msg.bundleB, {
      minMatch: "adaptive",
      onProgress: (done, total) => {
        (self as unknown as Worker).postMessage({
          type: "progress",
          done,
          total,
        } satisfies WorkerResponse);
      },
    });
    const hash = await computeEvidenceHash(msg.bundleA, msg.bundleB);
    (self as unknown as Worker).postMessage({
      type: "done",
      report,
      hash,
    } satisfies WorkerResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse);
  }
};

export {};