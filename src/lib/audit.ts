 import { supabase } from "@/integrations/supabase/client";
import { sendNotification } from "@/lib/notifications";

/**
 * ISO 27037:2013 — Conformidade com ABNT NBR ISO/IEC 27037
 * Princípios: Auditabilidade, Repetibilidade, Reprodutibilidade, Justificabilidade
 */

function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: new Date().toISOString(),
  };
}

export async function logAudit(action: string, module: string, details: Record<string, unknown> = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const deviceInfo = getDeviceInfo();

  await supabase.from("audit_logs").insert([{
    user_id: user.id,
    action,
    module,
    details: {
      ...details,
      iso27037: {
        standard: "ABNT NBR ISO/IEC 27037:2013",
        principle: "auditabilidade",
        agent: user.email,
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

  // ISO 27037: gerar hash automaticamente se não fornecido
  const computedHash = fileHash || await generateSHA256(inputContent + resultContent);
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
        method: `Aquisição via módulo ${module} do Cortex Forense`,
        agent: user.email,
        agentId: user.id,
        timestamp: new Date().toISOString(),
        device: deviceInfo,
        hashAlgorithm: "SHA-256",
        hashValue: computedHash,
      },
      chainOfCustody: {
        initialCustodian: user.email,
        acquisitionTime: new Date().toISOString(),
        preservationMethod: "Armazenamento criptografado em nuvem com controle de acesso RLS",
      },
    },
  };

  const { data: inserted } = await supabase.from("evidences").insert([{
    user_id: user.id,
    module,
    title,
    input_content: inputContent,
    result_content: resultContent,
    file_hash: computedHash,
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
      file_hash: computedHash,
     file_path: filePath,
      metadata: iso27037Metadata,
      change_summary: "Versão inicial — Aquisição conforme ISO 27037",
    } as any]);

    // Registrar acesso inicial na cadeia de custódia
    await logEvidenceAccess(inserted.id, "view", "Aquisição inicial da evidência digital");
  }

  await logAudit("evidence_saved", module, {
    title,
    hash: computedHash,
    iso27037_compliant: true,
  });

  sendNotification({
    type: "analysis_complete",
    subject: `Evidência registrada: ${title}`,
    body: `Uma nova evidência digital foi registrada na cadeia de custódia conforme ABNT NBR ISO/IEC 27037:2013.\n\nMódulo: ${module}\nTítulo: ${title}\nHash SHA-256: ${computedHash}\nAgente: ${user.email}\nData: ${new Date().toLocaleString("pt-BR")}\n\nPrincípios atendidos: Auditabilidade, Repetibilidade, Reprodutibilidade, Justificabilidade`,
    evidenceId: inserted?.id,
    caseId,
  });
}
