import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * EVTX Binary Parser — Extrai eventos e IOCs de arquivos .evtx (Windows Event Log)
 * Formato: https://github.com/libyal/libevtx/blob/main/documentation/Windows%20XML%20Event%20Log%20(EVTX).asciidoc
 *
 * File header: "ElfFile\x00" (8 bytes), 4096 bytes total
 * Chunks: 65536 bytes each, magic "ElfChnk\x00"
 * Records: magic 0x00002a2a, contain BinXml
 */

const EVTX_MAGIC = [0x45, 0x6c, 0x66, 0x46, 0x69, 0x6c, 0x65, 0x00]; // "ElfFile\0"
const CHUNK_MAGIC = [0x45, 0x6c, 0x66, 0x43, 0x68, 0x6e, 0x6b, 0x00]; // "ElfChnk\0"
const RECORD_MAGIC = 0x00002a2a;

interface EvtxEvent {
  recordId: number;
  timestamp: string;
  eventId: number;
  level: number;
  levelName: string;
  channel: string;
  provider: string;
  computer: string;
  keywords: string;
  task: number;
  opcode: number;
  processId: number;
  threadId: number;
  rawXml: string;
  userData: Record<string, string>;
}

interface EvtxAnalysis {
  fileInfo: {
    chunkCount: number;
    eventCount: number;
    fileSize: number;
    firstEvent: string;
    lastEvent: string;
    duration: number;
    majorVersion: number;
    minorVersion: number;
  };
  events: EvtxEvent[];
  iocs: {
    eventIdDistribution: Record<number, number>;
    levelDistribution: Record<string, number>;
    channelDistribution: Record<string, number>;
    providerDistribution: Record<string, number>;
    computerNames: string[];
    topEventIds: { eventId: number; count: number; description: string }[];
    suspiciousFindings: string[];
    securityEvents: {
      logonAttempts: number;
      failedLogons: number;
      accountLockouts: number;
      privilegeEscalation: number;
      serviceInstalls: number;
      policyChanges: number;
      processCreation: number;
      powershellExec: number;
      scheduledTasks: number;
      firewallChanges: number;
    };
    timelineHotspots: { hour: string; count: number }[];
  };
  statistics: {
    eventsPerSecond: number;
    avgEventSize: number;
    uniqueEventIds: number;
    uniqueProviders: number;
  };
}

const EVENT_LEVEL_NAMES: Record<number, string> = {
  0: "LogAlways", 1: "Critical", 2: "Error", 3: "Warning", 4: "Information", 5: "Verbose",
};

// Well-known Windows Security Event IDs with descriptions
const KNOWN_EVENT_IDS: Record<number, string> = {
  // Security
  4624: "Logon bem-sucedido",
  4625: "Falha de logon",
  4634: "Logoff",
  4648: "Logon com credenciais explícitas",
  4672: "Privilégios especiais atribuídos",
  4688: "Criação de novo processo",
  4689: "Término de processo",
  4697: "Serviço instalado no sistema",
  4698: "Tarefa agendada criada",
  4699: "Tarefa agendada excluída",
  4700: "Tarefa agendada habilitada",
  4701: "Tarefa agendada desabilitada",
  4702: "Tarefa agendada atualizada",
  4719: "Política de auditoria alterada",
  4720: "Conta de usuário criada",
  4722: "Conta de usuário habilitada",
  4723: "Tentativa de alterar senha",
  4724: "Tentativa de redefinir senha",
  4725: "Conta de usuário desabilitada",
  4726: "Conta de usuário excluída",
  4728: "Membro adicionado a grupo global",
  4732: "Membro adicionado a grupo local",
  4735: "Grupo local alterado",
  4740: "Conta bloqueada",
  4756: "Membro adicionado a grupo universal",
  4767: "Conta desbloqueada",
  4776: "Validação de credenciais",
  4778: "Sessão reconectada",
  4779: "Sessão desconectada",
  // System
  6005: "Serviço de log de eventos iniciado",
  6006: "Serviço de log de eventos parado",
  6008: "Desligamento inesperado",
  7034: "Serviço encerrado inesperadamente",
  7035: "Controle de serviço enviado",
  7036: "Estado do serviço alterado",
  7040: "Tipo de início do serviço alterado",
  7045: "Serviço instalado",
  // PowerShell
  4103: "Execução de módulo PowerShell",
  4104: "Bloco de script PowerShell",
  // Firewall
  2003: "Perfil de firewall alterado",
  2004: "Regra de firewall adicionada",
  2005: "Regra de firewall modificada",
  2006: "Regra de firewall excluída",
  // Sysmon (if installed)
  1: "Sysmon: Criação de processo",
  3: "Sysmon: Conexão de rede",
  7: "Sysmon: Imagem carregada",
  8: "Sysmon: CreateRemoteThread",
  10: "Sysmon: ProcessAccess",
  11: "Sysmon: Arquivo criado",
  13: "Sysmon: Valor de registro alterado",
  22: "Sysmon: Consulta DNS",
};

const SUSPICIOUS_EVENT_IDS = new Set([
  4625, 4648, 4672, 4688, 4697, 4698, 4719, 4720, 4724, 4726, 4740,
  7045, 4104, 1, 3, 8, 10,
]);

function checkMagic(dv: DataView, offset: number, magic: number[]): boolean {
  for (let i = 0; i < magic.length; i++) {
    if (dv.getUint8(offset + i) !== magic[i]) return false;
  }
  return true;
}

/**
 * Extract XML-like text from BinXml record data.
 * BinXml is a complex binary format; we do a best-effort text extraction
 * pulling UTF-16LE strings and known tag patterns.
 */
function extractStringsFromBinXml(data: Uint8Array): { xml: string; fields: Record<string, string> } {
  const strings: string[] = [];
  const fields: Record<string, string> = {};
  let i = 0;

  // Try to find UTF-16LE strings (common in EVTX)
  while (i < data.length - 1) {
    // Look for printable UTF-16LE characters
    if (data[i] >= 0x20 && data[i] < 0x7f && data[i + 1] === 0) {
      let str = "";
      let j = i;
      while (j < data.length - 1 && data[j] >= 0x20 && data[j] < 0x7f && data[j + 1] === 0) {
        str += String.fromCharCode(data[j]);
        j += 2;
      }
      if (str.length >= 2) {
        strings.push(str);
      }
      i = j;
    } else {
      i++;
    }
  }

  // Try to identify common field patterns
  for (const s of strings) {
    if (s.match(/^[A-Z][a-z]+$/)) continue; // skip generic words
    if (s.includes("\\") && s.includes(".")) fields["path"] = s;
    if (s.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) fields["ip"] = s;
    if (s.match(/^S-1-\d+-/)) fields["sid"] = s;
  }

  return { xml: strings.join(" | "), fields };
}

interface ParsedRecord {
  recordId: number;
  timestamp: string;
  eventId: number;
  level: number;
  channel: string;
  provider: string;
  computer: string;
  keywords: string;
  task: number;
  opcode: number;
  processId: number;
  threadId: number;
  rawXml: string;
  userData: Record<string, string>;
}

function parseEvtxRecord(dv: DataView, offset: number, chunkData: Uint8Array): ParsedRecord | null {
  try {
    if (offset + 28 > chunkData.length) return null;
    
    const magic = dv.getUint32(offset, true);
    if (magic !== RECORD_MAGIC) return null;

    const recordSize = dv.getUint32(offset + 4, true);
    if (recordSize < 28 || recordSize > 65536 || offset + recordSize > chunkData.length) return null;

    const recordId = Number(dv.getBigUint64(offset + 8, true));
    
    // Timestamp: Windows FILETIME (100ns intervals since 1601-01-01)
    const fileTimeLow = dv.getUint32(offset + 16, true);
    const fileTimeHigh = dv.getUint32(offset + 20, true);
    const fileTime = BigInt(fileTimeHigh) * BigInt(0x100000000) + BigInt(fileTimeLow);
    // Convert to Unix: subtract 116444736000000000 (100ns ticks between 1601 and 1970)
    const unixMs = Number((fileTime - BigInt("116444736000000000")) / BigInt(10000));
    const timestamp = new Date(unixMs).toISOString();

    // BinXml starts at offset + 24
    const binXmlStart = offset + 24;
    const binXmlEnd = offset + recordSize - 4; // last 4 bytes = copy of size
    const binXmlData = chunkData.slice(binXmlStart, binXmlEnd);

    // Extract what we can from the BinXml
    const { xml, fields } = extractStringsFromBinXml(binXmlData);

    // Try to extract EventID, Level, Channel, Provider from the binary
    // These are typically in the System section of BinXml
    let eventId = 0;
    let level = 4; // default Information
    let channel = "";
    let provider = "";
    let computer = "";
    let task = 0;
    let opcode = 0;
    let processId = 0;
    let threadId = 0;
    let keywords = "";

    // Simple heuristic: scan for known patterns in the extracted strings
    const allStrings = xml.split(" | ");
    for (const s of allStrings) {
      if (s === "Security" || s === "System" || s === "Application" || 
          s.includes("PowerShell") || s.includes("Sysmon") || 
          s.includes("Microsoft-Windows-")) {
        if (!channel && (s === "Security" || s === "System" || s === "Application" || 
            s.startsWith("Microsoft-Windows-"))) {
          channel = s;
        }
        if (!provider && s.startsWith("Microsoft-Windows-")) {
          provider = s;
        }
      }
      if (s.match(/^[A-Z0-9-]+\$?$/) && s.length > 3 && s.length < 30 && !s.includes("-Windows-")) {
        if (!computer) computer = s;
      }
    }

    // Try to extract EventID from the BinXml binary data
    // In standard EVTX BinXml, after the fragment header and element start,
    // EventID is typically a 2-byte value
    // We scan for small integers that could be event IDs
    if (binXmlData.length > 10) {
      // Look for EventID pattern in first ~50 bytes of BinXml
      // The EventID is usually a uint16 early in the template data
      for (let scan = 0; scan < Math.min(50, binXmlData.length - 4); scan++) {
        const val = binXmlData[scan] | (binXmlData[scan + 1] << 8);
        if (val > 0 && val < 65535 && KNOWN_EVENT_IDS[val] !== undefined) {
          eventId = val;
          break;
        }
      }
      // If not found in known IDs, take first reasonable uint16 from template area
      if (eventId === 0 && binXmlData.length > 4) {
        // BinXml typically has: 0x0F (fragment), 0x01/0x41 (element start)...
        // Skip to template data area
        for (let scan = 4; scan < Math.min(30, binXmlData.length - 2); scan++) {
          const val = binXmlData[scan] | (binXmlData[scan + 1] << 8);
          if (val > 0 && val <= 65534) {
            eventId = val;
            break;
          }
        }
      }

      // Extract level byte (usually near EventID)
      // Level is a single byte, values 0-5
      for (let scan = 0; scan < Math.min(40, binXmlData.length); scan++) {
        if (binXmlData[scan] <= 5 && scan > 2) {
          const prev = binXmlData[scan - 1];
          const next = scan + 1 < binXmlData.length ? binXmlData[scan + 1] : 0;
          // Level byte is typically surrounded by other small values (task, opcode)
          if (prev <= 20 && next <= 20) {
            level = binXmlData[scan];
            break;
          }
        }
      }
    }

    // Extract ProcessId and ThreadId if we can find 32-bit values
    if (binXmlData.length > 20) {
      const tempDv = new DataView(binXmlData.buffer, binXmlData.byteOffset, binXmlData.length);
      for (let scan = 8; scan < Math.min(40, binXmlData.length - 8); scan += 4) {
        const v = tempDv.getUint32(scan, true);
        if (v > 0 && v < 100000 && processId === 0) {
          processId = v;
        } else if (v > 0 && v < 100000 && processId > 0 && threadId === 0) {
          threadId = v;
          break;
        }
      }
    }

    return {
      recordId,
      timestamp,
      eventId,
      level,
      channel: channel || "Unknown",
      provider: provider || "",
      computer,
      keywords,
      task,
      opcode,
      processId,
      threadId,
      rawXml: xml.slice(0, 1000),
      userData: fields,
    };
  } catch {
    return null;
  }
}

function parseEvtx(buffer: ArrayBuffer): EvtxAnalysis {
  const dv = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Validate file header
  if (!checkMagic(dv, 0, EVTX_MAGIC)) {
    throw new Error("Formato inválido. Apenas arquivos .evtx (Windows Event Log) são suportados.");
  }

  if (buffer.byteLength < 4096) {
    throw new Error("Arquivo muito pequeno para ser um .evtx válido.");
  }

  // File header fields
  const majorVersion = dv.getUint16(0x12, true);
  const minorVersion = dv.getUint16(0x14, true);
  const chunkCountHeader = dv.getUint16(0x10, true);

  const events: EvtxEvent[] = [];
  const MAX_EVENTS = 100000;
  let chunkCount = 0;

  // Parse chunks starting at offset 4096
  let chunkOffset = 4096;
  const CHUNK_SIZE = 65536;

  while (chunkOffset + CHUNK_SIZE <= buffer.byteLength && events.length < MAX_EVENTS) {
    if (!checkMagic(dv, chunkOffset, CHUNK_MAGIC)) {
      chunkOffset += CHUNK_SIZE;
      continue;
    }

    chunkCount++;

    // Parse records within this chunk
    // Records start at offset 512 within the chunk (after chunk header)
    const chunkData = bytes.slice(chunkOffset, chunkOffset + CHUNK_SIZE);
    const chunkDv = new DataView(chunkData.buffer, chunkData.byteOffset, chunkData.length);

    let recordOffset = 512; // records start after 512-byte chunk header

    let safetyCounter = 0;
    while (recordOffset + 28 < CHUNK_SIZE && events.length < MAX_EVENTS && safetyCounter < 5000) {
      safetyCounter++;

      const record = parseEvtxRecord(chunkDv, recordOffset, chunkData);
      if (!record) {
        // Try to find next record magic
        let found = false;
        for (let scan = recordOffset + 1; scan < CHUNK_SIZE - 4; scan++) {
          if (chunkDv.getUint32(scan, true) === RECORD_MAGIC) {
            recordOffset = scan;
            found = true;
            break;
          }
        }
        if (!found) break;
        continue;
      }

      events.push({
        ...record,
        levelName: EVENT_LEVEL_NAMES[record.level] || `Level-${record.level}`,
      });

      // Move to next record
      const recordSize = chunkDv.getUint32(recordOffset + 4, true);
      if (recordSize < 28 || recordSize > 65536) break;
      recordOffset += recordSize;
    }

    chunkOffset += CHUNK_SIZE;
  }

  if (events.length === 0) {
    throw new Error("Nenhum evento encontrado no arquivo .evtx. O arquivo pode estar vazio ou corrompido.");
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Compute IOCs and statistics
  const eventIdDist: Record<number, number> = {};
  const levelDist: Record<string, number> = {};
  const channelDist: Record<string, number> = {};
  const providerDist: Record<string, number> = {};
  const computerSet = new Set<string>();
  const hourlyCount: Record<string, number> = {};

  const secEvents = {
    logonAttempts: 0, failedLogons: 0, accountLockouts: 0,
    privilegeEscalation: 0, serviceInstalls: 0, policyChanges: 0,
    processCreation: 0, powershellExec: 0, scheduledTasks: 0, firewallChanges: 0,
  };

  for (const evt of events) {
    eventIdDist[evt.eventId] = (eventIdDist[evt.eventId] || 0) + 1;
    levelDist[evt.levelName] = (levelDist[evt.levelName] || 0) + 1;
    channelDist[evt.channel] = (channelDist[evt.channel] || 0) + 1;
    if (evt.provider) providerDist[evt.provider] = (providerDist[evt.provider] || 0) + 1;
    if (evt.computer) computerSet.add(evt.computer);

    const hour = evt.timestamp.slice(0, 13); // YYYY-MM-DDTHH
    hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;

    // Security categorization
    switch (evt.eventId) {
      case 4624: secEvents.logonAttempts++; break;
      case 4625: secEvents.failedLogons++; break;
      case 4740: secEvents.accountLockouts++; break;
      case 4672: secEvents.privilegeEscalation++; break;
      case 7045: case 4697: secEvents.serviceInstalls++; break;
      case 4719: secEvents.policyChanges++; break;
      case 4688: case 1: secEvents.processCreation++; break;
      case 4103: case 4104: secEvents.powershellExec++; break;
      case 4698: case 4699: case 4700: case 4701: case 4702: secEvents.scheduledTasks++; break;
      case 2003: case 2004: case 2005: case 2006: secEvents.firewallChanges++; break;
    }
  }

  // Suspicious findings
  const suspiciousFindings: string[] = [];

  if (secEvents.failedLogons > 10) {
    suspiciousFindings.push(`${secEvents.failedLogons} falhas de logon detectadas — possível brute force`);
  }
  if (secEvents.accountLockouts > 0) {
    suspiciousFindings.push(`${secEvents.accountLockouts} bloqueios de conta — indica atividade suspeita`);
  }
  if (secEvents.privilegeEscalation > 5) {
    suspiciousFindings.push(`${secEvents.privilegeEscalation} atribuições de privilégios especiais — possível escalação`);
  }
  if (secEvents.serviceInstalls > 3) {
    suspiciousFindings.push(`${secEvents.serviceInstalls} instalações de serviço — verificar legitimidade`);
  }
  if (secEvents.powershellExec > 20) {
    suspiciousFindings.push(`${secEvents.powershellExec} execuções PowerShell — possível uso malicioso`);
  }
  if (secEvents.policyChanges > 0) {
    suspiciousFindings.push(`${secEvents.policyChanges} alterações de política de auditoria — possível cobertura de rastros`);
  }
  if (secEvents.scheduledTasks > 5) {
    suspiciousFindings.push(`${secEvents.scheduledTasks} operações com tarefas agendadas — verificar persistência`);
  }
  if (secEvents.firewallChanges > 0) {
    suspiciousFindings.push(`${secEvents.firewallChanges} alterações de firewall — possível desativação de proteções`);
  }

  // Check for critical/error events
  const criticalCount = levelDist["Critical"] || 0;
  const errorCount = levelDist["Error"] || 0;
  if (criticalCount > 0) {
    suspiciousFindings.push(`${criticalCount} eventos críticos encontrados — requer atenção imediata`);
  }
  if (errorCount > 50) {
    suspiciousFindings.push(`${errorCount} eventos de erro — possível instabilidade ou ataque`);
  }

  // Check for event log clearing (Event ID 1102)
  if (eventIdDist[1102]) {
    suspiciousFindings.push(`Log de auditoria foi limpo (${eventIdDist[1102]}x) — possível anti-forense`);
  }
  // Unexpected shutdown
  if (eventIdDist[6008]) {
    suspiciousFindings.push(`${eventIdDist[6008]} desligamentos inesperados detectados`);
  }

  // Top Event IDs
  const topEventIds = Object.entries(eventIdDist)
    .map(([id, count]) => ({
      eventId: Number(id),
      count,
      description: KNOWN_EVENT_IDS[Number(id)] || "Evento desconhecido",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  // Timeline hotspots
  const timelineHotspots = Object.entries(hourlyCount)
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);

  const firstTs = events[0]?.timestamp || "";
  const lastTs = events[events.length - 1]?.timestamp || "";
  const duration = firstTs && lastTs
    ? (new Date(lastTs).getTime() - new Date(firstTs).getTime()) / 1000
    : 0;

  return {
    fileInfo: {
      chunkCount,
      eventCount: events.length,
      fileSize: buffer.byteLength,
      firstEvent: firstTs,
      lastEvent: lastTs,
      duration,
      majorVersion,
      minorVersion,
    },
    events: events.slice(0, 1000), // limit for response size
    iocs: {
      eventIdDistribution: eventIdDist,
      levelDistribution: levelDist,
      channelDistribution: channelDist,
      providerDistribution: providerDist,
      computerNames: [...computerSet].sort(),
      topEventIds,
      suspiciousFindings,
      securityEvents: secEvents,
      timelineHotspots,
    },
    statistics: {
      eventsPerSecond: duration > 0 ? Math.round(events.length / duration * 100) / 100 : events.length,
      avgEventSize: Math.round(buffer.byteLength / events.length),
      uniqueEventIds: Object.keys(eventIdDist).length,
      uniqueProviders: Object.keys(providerDist).length,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = req.headers.get("content-type") || "";
    let evtxBuffer: ArrayBuffer;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.base64) {
        const raw = body.base64.replace(/^data:[^;]+;base64,/, "");
        const binary = atob(raw);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        evtxBuffer = bytes.buffer;
      } else {
        throw new Error("Envie o arquivo como base64 no campo 'base64'");
      }
    } else if (contentType.includes("application/octet-stream")) {
      evtxBuffer = await req.arrayBuffer();
    } else {
      throw new Error("Content-Type não suportado. Use application/json com base64.");
    }

    if (evtxBuffer.byteLength < 4096) {
      throw new Error("Arquivo muito pequeno para ser um .evtx válido");
    }

    const analysis = parseEvtx(evtxBuffer);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-evtx error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro na análise" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
