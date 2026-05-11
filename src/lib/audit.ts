import { supabase } from "@/integrations/supabase/client";
import { sendNotification } from "@/lib/notifications";

/**
 * ISO 27037:2013 — Conformidade com ABNT NBR ISO/IEC 27037
 * Princípios: Auditabilidade, Repetibilidade, Reprodutibilidade, Justificabilidade
 */

function getDeviceInfo() {
   const now = new Date();
   // Brasília is UTC-3
   const brOffset = -3 * 60 * 60 * 1000;
   const brTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + brOffset);
   
   return {
     userAgent: navigator.userAgent,
     platform: navigator.platform,
     language: navigator.language,
     screenResolution: `${screen.width}x${screen.height}`,
     timezone: "America/Sao_Paulo",
     timestamp: now.toISOString(),
     timestampBR: brTime.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) + " (BRT)",
     vendor: (navigator as any).vendor || "—",
     hardwareConcurrency: navigator.hardwareConcurrency || 0,
     deviceMemory: (navigator as any).deviceMemory || null,
     online: navigator.onLine,
     referrer: document.referrer || null,
     pageUrl: window.location.href,
     pagePath: window.location.pathname,
   };
}

let cachedIp: string | null = null;
async function getClientIp(): Promise<string | null> {
  if (cachedIp !== null) return cachedIp;
  try {
    const r = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    cachedIp = j.ip || null;
    return cachedIp;
  } catch {
    return null;
  }
}

 export async function logAudit(action: string, module: string, details: Record<string, unknown> = {}) {
   // Dispatch custom event for real-time UI updates
   window.dispatchEvent(new CustomEvent('audit_log_realtime', { 
     detail: { action, module, timestamp: new Date().toISOString() } 
   }));
 
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const deviceInfo = getDeviceInfo();
  const ipAddress = await getClientIp();

  await supabase.from("audit_logs").insert([{
    user_id: user.id,
    action,
    module,
    ip_address: ipAddress,
    details: {
      ...details,
      iso27037: {
        standard: "ABNT NBR ISO/IEC 27037:2013",
        principle: "auditabilidade",
        agent: user.email,
        agentId: user.id,
        ip: ipAddress,
        device: deviceInfo,
      },
    },
  } as any]);
}

/**
 * Registra acesso à evidência na cadeia de custódia (ISO 27037 §2.1)
 */
export async function logEvidenceAccess(
  evidenceId: string,
  action: "view" | "export" | "certify" | "modify" | "share",
  justification?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("evidence_access_log" as any).insert([{
    evidence_id: evidenceId,
    user_id: user.id,
    action,
    user_agent: navigator.userAgent,
    justification: justification || null,
  }]);
}

/**
 * Gera hash SHA-256 do conteúdo (ISO 27037 — verificação de integridade)
 */
export async function generateSHA256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function saveEvidence({
  module,
  title,
  inputContent,
  resultContent,
  filePath,
  fileHash,
  metadata,
  caseId,
}: {
  module: string;
  title: string;
  inputContent: string;
  resultContent: string;
  filePath?: string;
  fileHash?: string;
  metadata?: Record<string, unknown>;
  caseId?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // ISO 27037: Use provided fileHash (direct source) or compute one from textual input
  const sourceHash = fileHash || await generateSHA256(inputContent);
  const deviceInfo = getDeviceInfo();

  const iso27037Metadata = {
    ...(metadata || {}),
    iso27037: {
      standard: "ABNT NBR ISO/IEC 27037:2013",
      compliance: true,
      principles: {
        auditabilidade: "Processo documentado com logs de auditoria",
        repetibilidade: "Hash SHA-256 permite verificação independente",
        reprodutibilidade: "Dados preservados em formato original",
        justificabilidade: "Ação registrada com agente e dispositivo identificados",
      },
      acquisition: {
        method: filePath ? `Preservação de arquivo via módulo ${module}` : `Input textual via módulo ${module}`,
        agent: user.email,
        agentId: user.id,
        timestamp: new Date().toISOString(),
        device: deviceInfo,
        hashAlgorithm: "SHA-256",
        hashValue: sourceHash,
      },
      chainOfCustody: {
        initialCustodian: user.email,
        acquisitionTime: new Date().toISOString(),
        preservationMethod: "Armazenamento AES-256 em nuvem com logs de acesso imutáveis",
      },
    },
  };

  const { data: inserted } = await supabase.from("evidences").insert([{
    user_id: user.id,
    module,
    title,
    input_content: inputContent,
    result_content: resultContent,
    file_hash: sourceHash,
    file_path: filePath,
    metadata: iso27037Metadata,
    ...(caseId ? { case_id: caseId } : {}),
  } as any]).select("id").single();

  // Save initial version
  if (inserted) {
    await supabase.from("evidence_versions").insert([{
      evidence_id: inserted.id,
      user_id: user.id,
      version_number: 1,
      title,
      input_content: inputContent,
      result_content: resultContent,
      file_hash: sourceHash,
      file_path: filePath,
      metadata: iso27037Metadata,
      change_summary: "Versão inicial — Aquisição conforme ISO 27037",
    } as any]);

    // Registrar acesso inicial na cadeia de custódia
    await logEvidenceAccess(inserted.id, "view", "Aquisição inicial da evidência digital");
  }

  await logAudit("evidence_saved", module, {
    title,
    hash: sourceHash,
    iso27037_compliant: true,
    has_file: !!filePath
  });

  sendNotification({
    type: "analysis_complete",
    subject: `Evidência registrada: ${title}`,
    body: `Uma nova evidência digital foi registrada na cadeia de custódia conforme ABNT NBR ISO/IEC 27037:2013.\n\nMódulo: ${module}\nTítulo: ${title}\nHash SHA-256: ${sourceHash}\nAgente: ${user.email}\nData: ${new Date().toLocaleString("pt-BR")}`,
    evidenceId: inserted?.id,
    caseId,
  });
}
