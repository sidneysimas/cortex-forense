import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * PCAP Binary Parser — Extrai IOCs de arquivos .pcap
 * Suporta pcap clássico (magic: 0xa1b2c3d4) e microsecond LE/BE
 */

function readUint16(dv: DataView, offset: number, le: boolean): number {
  return dv.getUint16(offset, le);
}
function readUint32(dv: DataView, offset: number, le: boolean): number {
  return dv.getUint32(offset, le);
}

function ipToString(ip: number): string {
  return `${(ip >>> 24) & 0xff}.${(ip >>> 16) & 0xff}.${(ip >>> 8) & 0xff}.${ip & 0xff}`;
}

interface PcapPacket {
  timestamp: number;
  srcIp: string;
  dstIp: string;
  srcPort: number;
  dstPort: number;
  protocol: string;
  protocolNumber: number;
  length: number;
  flags?: string;
  info?: string;
}

interface DnsQuery {
  name: string;
  type: string;
  timestamp: number;
}

interface PcapAnalysis {
  fileInfo: {
    version: string;
    linkType: number;
    snapLen: number;
    packetCount: number;
    fileSize: number;
    duration: number;
    startTime: string;
    endTime: string;
  };
  packets: PcapPacket[];
  iocs: {
    uniqueSrcIps: string[];
    uniqueDstIps: string[];
    uniquePorts: number[];
    protocols: Record<string, number>;
    topTalkers: { ip: string; packets: number; bytes: number }[];
    connections: { src: string; dst: string; port: number; protocol: string; count: number }[];
    dnsQueries: DnsQuery[];
    suspiciousFindings: string[];
  };
  statistics: {
    totalBytes: number;
    avgPacketSize: number;
    packetsPerSecond: number;
    bytesPerSecond: number;
    protocolDistribution: Record<string, number>;
    portDistribution: Record<number, number>;
  };
}

const PROTOCOL_NAMES: Record<number, string> = {
  1: "ICMP", 2: "IGMP", 6: "TCP", 17: "UDP", 41: "IPv6",
  47: "GRE", 50: "ESP", 51: "AH", 58: "ICMPv6", 89: "OSPF",
  132: "SCTP",
};

const WELL_KNOWN_PORTS: Record<number, string> = {
  20: "FTP-Data", 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP",
  53: "DNS", 67: "DHCP", 68: "DHCP", 80: "HTTP", 110: "POP3",
  123: "NTP", 143: "IMAP", 161: "SNMP", 443: "HTTPS", 445: "SMB",
  993: "IMAPS", 995: "POP3S", 1433: "MSSQL", 1521: "Oracle",
  3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL", 5900: "VNC",
  6379: "Redis", 8080: "HTTP-Alt", 8443: "HTTPS-Alt", 27017: "MongoDB",
};

function getTcpFlags(flagsByte: number): string {
  const flags: string[] = [];
  if (flagsByte & 0x01) flags.push("FIN");
  if (flagsByte & 0x02) flags.push("SYN");
  if (flagsByte & 0x04) flags.push("RST");
  if (flagsByte & 0x08) flags.push("PSH");
  if (flagsByte & 0x10) flags.push("ACK");
  if (flagsByte & 0x20) flags.push("URG");
  return flags.join(",");
}

function parseDnsName(dv: DataView, offset: number, maxLen: number): string {
  const parts: string[] = [];
  let pos = offset;
  let safety = 0;
  while (pos < offset + maxLen && safety < 50) {
    safety++;
    const len = dv.getUint8(pos);
    if (len === 0) break;
    if ((len & 0xc0) === 0xc0) break; // pointer, stop
    pos++;
    let part = "";
    for (let i = 0; i < len && pos + i < offset + maxLen; i++) {
      part += String.fromCharCode(dv.getUint8(pos + i));
    }
    parts.push(part);
    pos += len;
  }
  return parts.join(".");
}

function parsePcap(buffer: ArrayBuffer): PcapAnalysis {
  const dv = new DataView(buffer);
  const magic = dv.getUint32(0, true);

  let le = true;
  if (magic === 0xa1b2c3d4 || magic === 0xa1b23c4d) {
    le = true;
  } else if (magic === 0xd4c3b2a1 || magic === 0x4d3cb2a1) {
    le = false;
  } else {
    throw new Error("Formato de arquivo inválido. Apenas arquivos .pcap são suportados (não .pcapng).");
  }

  const versionMajor = readUint16(dv, 4, le);
  const versionMinor = readUint16(dv, 6, le);
  const snapLen = readUint32(dv, 16, le);
  const linkType = readUint32(dv, 20, le);

  const packets: PcapPacket[] = [];
  const dnsQueries: DnsQuery[] = [];
  let offset = 24; // global header size
  let totalBytes = 0;
  let firstTs = 0;
  let lastTs = 0;

  const MAX_PACKETS = 50000; // limit for performance

  while (offset + 16 <= buffer.byteLength && packets.length < MAX_PACKETS) {
    const tsSec = readUint32(dv, offset, le);
    const tsUsec = readUint32(dv, offset + 4, le);
    const inclLen = readUint32(dv, offset + 8, le);
    const origLen = readUint32(dv, offset + 12, le);

    const timestamp = tsSec + tsUsec / 1000000;
    if (firstTs === 0) firstTs = timestamp;
    lastTs = timestamp;

    offset += 16; // packet header

    if (offset + inclLen > buffer.byteLength) break;

    totalBytes += origLen;

    // Parse Ethernet header (linkType 1)
    if (linkType === 1 && inclLen >= 34) {
      const etherType = dv.getUint16(offset + 12, false); // always big-endian

      let ipOffset = offset + 14;

      // Handle VLAN tagged (802.1Q)
      if (etherType === 0x8100 && inclLen >= 38) {
        ipOffset = offset + 18;
      }

      // IPv4
      if (etherType === 0x0800 || etherType === 0x8100) {
        const versionIhl = dv.getUint8(ipOffset);
        const ihl = (versionIhl & 0x0f) * 4;
        const ipTotalLen = dv.getUint16(ipOffset + 2, false);
        const protocolNum = dv.getUint8(ipOffset + 9);
        const srcIpRaw = dv.getUint32(ipOffset + 12, false);
        const dstIpRaw = dv.getUint32(ipOffset + 16, false);

        const srcIp = ipToString(srcIpRaw);
        const dstIp = ipToString(dstIpRaw);
        const protocol = PROTOCOL_NAMES[protocolNum] || `Proto-${protocolNum}`;

        let srcPort = 0;
        let dstPort = 0;
        let flags = "";
        let info = "";

        const transportOffset = ipOffset + ihl;

        if (protocolNum === 6 && transportOffset + 14 <= offset + inclLen) {
          // TCP
          srcPort = dv.getUint16(transportOffset, false);
          dstPort = dv.getUint16(transportOffset + 2, false);
          const flagsByte = dv.getUint8(transportOffset + 13);
          flags = getTcpFlags(flagsByte);
          const svc = WELL_KNOWN_PORTS[dstPort] || WELL_KNOWN_PORTS[srcPort] || "";
          info = svc ? `${svc} [${flags}]` : `[${flags}]`;
        } else if (protocolNum === 17 && transportOffset + 8 <= offset + inclLen) {
          // UDP
          srcPort = dv.getUint16(transportOffset, false);
          dstPort = dv.getUint16(transportOffset + 2, false);
          const svc = WELL_KNOWN_PORTS[dstPort] || WELL_KNOWN_PORTS[srcPort] || "";
          info = svc || "";

          // DNS parsing
          if (srcPort === 53 || dstPort === 53) {
            const dnsOffset = transportOffset + 8;
            if (dnsOffset + 12 <= offset + inclLen) {
              const qdCount = dv.getUint16(dnsOffset + 4, false);
              if (qdCount > 0 && qdCount < 10) {
                const name = parseDnsName(dv, dnsOffset + 12, Math.min(256, offset + inclLen - dnsOffset - 12));
                if (name) {
                  dnsQueries.push({ name, type: "A", timestamp });
                  info = `DNS: ${name}`;
                }
              }
            }
          }
        } else if (protocolNum === 1) {
          // ICMP
          if (transportOffset + 2 <= offset + inclLen) {
            const icmpType = dv.getUint8(transportOffset);
            const icmpCode = dv.getUint8(transportOffset + 1);
            info = `ICMP Type=${icmpType} Code=${icmpCode}`;
          }
        }

        packets.push({
          timestamp,
          srcIp, dstIp,
          srcPort, dstPort,
          protocol,
          protocolNumber: protocolNum,
          length: origLen,
          flags,
          info,
        });
      }
    }

    offset += inclLen;
  }

  // Compute IOCs
  const srcIpCount: Record<string, { packets: number; bytes: number }> = {};
  const dstIpSet = new Set<string>();
  const portSet = new Set<number>();
  const protocolCount: Record<string, number> = {};
  const portCount: Record<number, number> = {};
  const connMap: Record<string, { src: string; dst: string; port: number; protocol: string; count: number }> = {};

  for (const pkt of packets) {
    // Src IP stats
    if (!srcIpCount[pkt.srcIp]) srcIpCount[pkt.srcIp] = { packets: 0, bytes: 0 };
    srcIpCount[pkt.srcIp].packets++;
    srcIpCount[pkt.srcIp].bytes += pkt.length;

    dstIpSet.add(pkt.dstIp);

    if (pkt.srcPort) { portSet.add(pkt.srcPort); portCount[pkt.srcPort] = (portCount[pkt.srcPort] || 0) + 1; }
    if (pkt.dstPort) { portSet.add(pkt.dstPort); portCount[pkt.dstPort] = (portCount[pkt.dstPort] || 0) + 1; }

    protocolCount[pkt.protocol] = (protocolCount[pkt.protocol] || 0) + 1;

    const connKey = `${pkt.srcIp}->${pkt.dstIp}:${pkt.dstPort}/${pkt.protocol}`;
    if (!connMap[connKey]) {
      connMap[connKey] = { src: pkt.srcIp, dst: pkt.dstIp, port: pkt.dstPort, protocol: pkt.protocol, count: 0 };
    }
    connMap[connKey].count++;
  }

  // Top talkers
  const topTalkers = Object.entries(srcIpCount)
    .map(([ip, stats]) => ({ ip, ...stats }))
    .sort((a, b) => b.packets - a.packets)
    .slice(0, 20);

  // Top connections
  const connections = Object.values(connMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  // Suspicious findings
  const suspiciousFindings: string[] = [];

  // Port scan detection
  const dstPortsByIp: Record<string, Set<number>> = {};
  for (const pkt of packets) {
    if (!dstPortsByIp[pkt.srcIp]) dstPortsByIp[pkt.srcIp] = new Set();
    if (pkt.dstPort) dstPortsByIp[pkt.srcIp].add(pkt.dstPort);
  }
  for (const [ip, ports] of Object.entries(dstPortsByIp)) {
    if (ports.size > 50) {
      suspiciousFindings.push(`Possível port scan detectado: ${ip} acessou ${ports.size} portas distintas`);
    }
  }

  // Known malicious ports
  const suspiciousPorts = [4444, 5555, 6666, 6667, 1337, 31337, 12345, 65535];
  for (const port of suspiciousPorts) {
    if (portSet.has(port)) {
      suspiciousFindings.push(`Porta suspeita detectada: ${port} (comumente associada a malware/backdoor)`);
    }
  }

  // High volume single destination
  for (const conn of connections) {
    if (conn.count > 1000) {
      suspiciousFindings.push(`Tráfego anômalo: ${conn.src} → ${conn.dst}:${conn.port} (${conn.count} pacotes) — possível DDoS ou exfiltração`);
    }
  }

  // DNS tunneling indicator
  const longDns = dnsQueries.filter(q => q.name.length > 50);
  if (longDns.length > 5) {
    suspiciousFindings.push(`Possível DNS tunneling: ${longDns.length} consultas DNS com nomes longos (>50 chars)`);
  }

  // RFC 1918 check
  const externalIps = [...new Set([...Object.keys(srcIpCount), ...dstIpSet])].filter(ip => {
    return !ip.startsWith("10.") && !ip.startsWith("192.168.") &&
      !ip.match(/^172\.(1[6-9]|2[0-9]|3[01])\./) && ip !== "0.0.0.0" && ip !== "255.255.255.255" &&
      !ip.startsWith("224.") && !ip.startsWith("127.");
  });

  const duration = lastTs - firstTs;
  const startDate = new Date(firstTs * 1000);
  const endDate = new Date(lastTs * 1000);

  return {
    fileInfo: {
      version: `${versionMajor}.${versionMinor}`,
      linkType,
      snapLen,
      packetCount: packets.length,
      fileSize: buffer.byteLength,
      duration,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    },
    packets: packets.slice(0, 500), // limit for response size
    iocs: {
      uniqueSrcIps: Object.keys(srcIpCount).sort(),
      uniqueDstIps: [...dstIpSet].sort(),
      uniquePorts: [...portSet].sort((a, b) => a - b),
      protocols: protocolCount,
      topTalkers,
      connections,
      dnsQueries: dnsQueries.slice(0, 200),
      suspiciousFindings,
    },
    statistics: {
      totalBytes,
      avgPacketSize: packets.length ? Math.round(totalBytes / packets.length) : 0,
      packetsPerSecond: duration > 0 ? Math.round(packets.length / duration) : packets.length,
      bytesPerSecond: duration > 0 ? Math.round(totalBytes / duration) : totalBytes,
      protocolDistribution: protocolCount,
      portDistribution: Object.fromEntries(
        Object.entries(portCount).sort(([, a], [, b]) => b - a).slice(0, 30)
      ),
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

    let pcapBuffer: ArrayBuffer;

    if (contentType.includes("application/octet-stream")) {
      pcapBuffer = await req.arrayBuffer();
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) throw new Error("Nenhum arquivo enviado");
      pcapBuffer = await file.arrayBuffer();
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.base64) {
        const binary = atob(body.base64.replace(/^data:[^;]+;base64,/, ""));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        pcapBuffer = bytes.buffer;
      } else {
        throw new Error("Envie o arquivo como base64 no campo 'base64'");
      }
    } else {
      throw new Error("Content-Type não suportado. Use application/json com base64 ou multipart/form-data.");
    }

    if (pcapBuffer.byteLength < 24) {
      throw new Error("Arquivo muito pequeno para ser um .pcap válido");
    }

    const analysis = parsePcap(pcapBuffer);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-pcap error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro na análise" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
