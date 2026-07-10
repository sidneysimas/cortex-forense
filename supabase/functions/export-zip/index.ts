import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatBrt(date?: string | null, brt?: string | null): string {
  if (brt) return brt;
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (BRT)`;
}

// Minimal ZIP creation without external deps
function createZip(files: { name: string; content: Uint8Array }[]): Uint8Array {
  const entries: { header: Uint8Array; data: Uint8Array; centralHeader: Uint8Array; offset: number }[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const now = new Date();
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
    const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

    // CRC32
    let crc = 0xffffffff;
    for (let i = 0; i < file.content.length; i++) {
      crc ^= file.content[i];
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc ^= 0xffffffff;

    // Local file header (30 bytes + name)
    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(localHeader);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version
    lv.setUint16(8, 0, true); // compression: stored
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc >>> 0, true);
    lv.setUint32(18, file.content.length, true); // compressed
    lv.setUint32(22, file.content.length, true); // uncompressed
    lv.setUint16(26, nameBytes.length, true);
    new Uint8Array(localHeader, 30).set(nameBytes);

    // Central directory header (46 bytes + name)
    const centralHeader = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(centralHeader);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc >>> 0, true);
    cv.setUint32(20, file.content.length, true);
    cv.setUint32(24, file.content.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true); // offset
    new Uint8Array(centralHeader, 46).set(nameBytes);

    const headerBytes = new Uint8Array(localHeader);
    entries.push({ header: headerBytes, data: file.content, centralHeader: new Uint8Array(centralHeader), offset });
    offset += headerBytes.length + file.content.length;
  }

  // Build final ZIP
  let centralDirSize = 0;
  entries.forEach((e) => (centralDirSize += e.centralHeader.length));

  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, offset, true);

  const totalSize = offset + centralDirSize + 22;
  const result = new Uint8Array(totalSize);
  let pos = 0;

  for (const e of entries) {
    result.set(e.header, pos); pos += e.header.length;
    result.set(e.data, pos); pos += e.data.length;
  }
  for (const e of entries) {
    result.set(e.centralHeader, pos); pos += e.centralHeader.length;
  }
  result.set(new Uint8Array(eocd), pos);

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { caseId } = await req.json();
    if (!caseId) {
      return new Response(JSON.stringify({ error: "caseId obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch case + evidences
    const [caseResult, evidencesResult] = await Promise.all([
      supabase.from("cases").select("*").eq("id", caseId).eq("user_id", user.id).single(),
      supabase.from("evidences").select("*").eq("case_id", caseId).eq("user_id", user.id).order("created_at"),
    ]);

    const caseData = caseResult.data;
    if (!caseData) {
      return new Response(JSON.stringify({ error: "Caso não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evidences = evidencesResult.data || [];
    const encoder = new TextEncoder();
    const zipFiles: { name: string; content: Uint8Array }[] = [];

    // Add case info file
    const caseInfo = `CASO: ${caseData.title}\nNúmero: ${caseData.case_number || "N/A"}\nVara: ${caseData.court || "N/A"}\nStatus: ${caseData.status}\nDescrição: ${caseData.description || "N/A"}\nCriado em: ${formatBrt(caseData.created_at, caseData.created_at_brt)}\n\nTotal de evidências: ${evidences.length}`;
    zipFiles.push({ name: "caso-info.txt", content: encoder.encode(caseInfo) });

    // Add each evidence as a text file
    for (let i = 0; i < evidences.length; i++) {
      const ev = evidences[i] as any;
      const idx = String(i + 1).padStart(3, "0");
      const content = [
        `EVIDÊNCIA #${i + 1}`,
        `Título: ${ev.title || "N/A"}`,
        `Módulo: ${ev.module}`,
        `Data: ${formatBrt(ev.created_at, ev.created_at_brt || ev.metadata?.iso27037?.chainOfCustody?.acquisitionTimeBR)}`,
        `Hash SHA-256: ${ev.file_hash || "N/A"}`,
        ev.tsa_timestamp ? `TSA: ${formatBrt(ev.tsa_timestamp)}` : "",
        ev.blockchain_tx ? `Blockchain TX: ${ev.blockchain_tx}\nRede: ${ev.blockchain_network}` : "",
        `\n--- ENTRADA ---\n${ev.input_content || "N/A"}`,
        `\n--- RESULTADO ---\n${ev.result_content || "N/A"}`,
      ].filter(Boolean).join("\n");

      zipFiles.push({ name: `evidencias/${idx}-${ev.module}.txt`, content: encoder.encode(content) });
    }

    const zipData = createZip(zipFiles);
    const base64 = btoa(String.fromCharCode(...zipData));

    return new Response(JSON.stringify({
      zipBase64: base64,
      filename: `caso-${caseData.case_number || caseData.id.slice(0, 8)}.zip`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("export-zip error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro na exportação" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
