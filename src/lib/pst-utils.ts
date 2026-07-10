import { PSTFile, Folder } from "pst-parser";

/**
 * Fix mojibake text: detect CJK/replacement chars that shouldn't be in Latin text
 * and attempt to recover by treating char codes as raw bytes.
 */
/**
 * Fix mojibake: detect CJK/replacement chars from mis-decoded Windows-1252.
 * Handles two cases:
 * 1. All chars ≤255: bytes were mapped 1:1 as Latin-1, try UTF-8 re-decode
 * 2. Chars >255 (CJK from Utf8ArrayToStr misinterpreting W1252 as multi-byte UTF-8):
 *    Attempt to reverse the UTF-8 multi-byte encoding to recover original bytes
 */
function fixEncoding(text: string | null | undefined): string | null {
  if (!text) return text as string | null;
  
  // Only process if we detect mojibake indicators
  if (!/[\u4e00-\u9fff\ufffd]/.test(text)) return text;

  // Case 1: all chars ≤255 — direct byte recovery
  let allLowBytes = true;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 255) { allLowBytes = false; break; }
  }
  
  if (allLowBytes) {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return text; // Already Latin-1, keep as-is
    }
  }

  // Case 2: has chars >255 — reverse the UTF-8 multi-byte misinterpretation
  // Utf8ArrayToStr reads Windows-1252 bytes as UTF-8 sequences:
  //   2-byte: 110xxxxx 10xxxxxx → single char U+0080..U+07FF
  //   3-byte: 1110xxxx 10xxxxxx 10xxxxxx → single char U+0800..U+FFFF
  // We reverse this to recover original bytes, then decode as Windows-1252
  try {
    const recovered: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const cp = text.charCodeAt(i);
      if (cp < 0x80) {
        recovered.push(cp);
      } else if (cp === 0xFFFD) {
        // Replacement char — original byte unknown, use '?'
        recovered.push(0x3F);
      } else if (cp < 0x800) {
        // Was a 2-byte UTF-8 sequence: recover 2 original bytes
        recovered.push(0xC0 | (cp >> 6));
        recovered.push(0x80 | (cp & 0x3F));
      } else {
        // Was a 3-byte UTF-8 sequence: recover 3 original bytes
        recovered.push(0xE0 | (cp >> 12));
        recovered.push(0x80 | ((cp >> 6) & 0x3F));
        recovered.push(0x80 | (cp & 0x3F));
      }
    }
    // Now decode recovered bytes as Windows-1252
    const WIN1252 = "\u20ac\u0081\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u008d\u017d\u008f\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u009d\u017e\u0178";
    const result = recovered.map(b => {
      if (b >= 0x80 && b <= 0x9f) return WIN1252[b - 0x80] || String.fromCharCode(b);
      return String.fromCharCode(b);
    }).join("");
    
    // Sanity check: result should have more Latin chars and fewer CJK
    if (!/[\u4e00-\u9fff]/.test(result)) return result;
  } catch { /* fall through */ }

  return text;
}

export interface PstFolderNode {
  nid: number;
  displayName: string;
  contentCount: number;
  unreadCount: number;
  hasSubfolders: boolean;
  children?: PstFolderNode[];
}

export interface EmailEntry {
  nid: number;
  subject: string;
  senderName: string;
  senderEmail: string;
  receivedDate: string;
  hasAttachment: boolean;
  read: boolean;
}

export interface EmailAttachment {
  name: string;
  size: number;
  index: number;
}

export interface EmailDetail {
  subject: string;
  senderName: string;
  senderEmail: string;
  receivedDate: string;
  toRecipients: string;
  ccRecipients: string;
  bodyHtml: string | null;
  bodyText: string | null;
  hasAttachments: boolean;
  attachments: EmailAttachment[];
}

let currentPstFile: PSTFile | null = null;

export function openPstFile(buffer: ArrayBuffer): PSTFile {
  currentPstFile = new PSTFile(buffer);
  return currentPstFile;
}

export function getPstFile(): PSTFile | null {
  return currentPstFile;
}

function findProp(props: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = props[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  // Also try case-insensitive match
  const propsKeys = Object.keys(props);
  for (const key of keys) {
    const lower = key.toLowerCase();
    const match = propsKeys.find(k => k.toLowerCase() === lower);
    if (match && typeof props[match] === "string" && (props[match] as string).trim()) {
      return (props[match] as string).trim();
    }
  }
  return "";
}

function formatDate(props: Record<string, unknown>): string {
  const dateVal = props["MessageDeliveryTime"] || props["ClientSubmitTime"] || props["CreationTime"];
  if (dateVal instanceof Date) {
    return dateVal.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }
  if (typeof dateVal === "string") {
    try {
      return new Date(dateVal).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    } catch { /* ignore */ }
  }
  return "";
}

export function buildFolderTree(pstFile: PSTFile): PstFolderNode[] {
  const rootFolder = pstFile.getRootFolder();
  return buildSubFolders(rootFolder);
}

function buildSubFolders(folder: Folder): PstFolderNode[] {
  const entries = folder.getSubFolderEntries();
  const nodes: PstFolderNode[] = [];

  for (const entry of entries) {
    const nid = entry.nid as number;
    try {
      const subFolder = folder.getSubFolder(nid);
      const node: PstFolderNode = {
        nid,
        displayName: subFolder.displayName || `Pasta ${nid}`,
        contentCount: subFolder.contentCount || 0,
        unreadCount: subFolder.unreadCount || 0,
        hasSubfolders: subFolder.hasSubfolders || false,
        children: [],
      };

      if (subFolder.hasSubfolders) {
        try {
          node.children = buildSubFolders(subFolder);
        } catch { /* ignore corrupt subfolders */ }
      }

      nodes.push(node);
    } catch {
      // Skip folders that can't be read
    }
  }

  return nodes;
}

export function getEmailsForFolder(pstFile: PSTFile, folderNid: number, start = 0, count = 100): EmailEntry[] {
  const folder = findFolder(pstFile, folderNid);
  if (!folder) return [];

  const end = Math.min(start + count, folder.contentCount);
  const contents = folder.getContents(start, end);

  return contents.map((entry: Record<string, unknown>) => {
    const nid = entry.nid as number;
    return {
      nid,
      subject: fixEncoding(findProp(entry, ["Subject", "SubjectW", "ConversationTopic", "ConversationTopicW", "NormalizedSubject", "NormalizedSubjectW"])) || "",
      senderName: fixEncoding(findProp(entry, ["SenderName", "SenderNameW", "SentRepresentingName", "SentRepresentingNameW", "DisplayFrom", "DisplayFromW"])) || "",
      senderEmail: findProp(entry, ["SenderSmtpAddress", "SenderSmtpAddressW", "SenderEmailAddress", "SenderEmailAddressW", "SentRepresentingSmtpAddress", "SentRepresentingEmailAddress"]) || "",
      receivedDate: formatDate(entry),
      hasAttachment: Boolean(entry["HasAttachments"] || (typeof entry["MessageFlags"] === "number" && (entry["MessageFlags"] as number) & 0x10)),
      read: Boolean(typeof entry["MessageFlags"] === "number" && (entry["MessageFlags"] as number) & 0x01),
    };
  });
}

function findFolder(pstFile: PSTFile, targetNid: number): Folder | null {
  const root = pstFile.getRootFolder();
  return findFolderRecursive(root, targetNid);
}

function findFolderRecursive(folder: Folder, targetNid: number): Folder | null {
  const entries = folder.getSubFolderEntries();
  for (const entry of entries) {
    const nid = entry.nid as number;
    try {
      const sub = folder.getSubFolder(nid);
      if (nid === targetNid) return sub;
      if (sub.hasSubfolders) {
        const found = findFolderRecursive(sub, targetNid);
        if (found) return found;
      }
    } catch { /* skip */ }
  }
  return null;
}

export function getEmailDetail(pstFile: PSTFile, folderNid: number, emailNid: number): EmailDetail | null {
  const folder = findFolder(pstFile, folderNid);
  if (!folder) return null;

  try {
    const message = folder.getMessage(emailNid);
    if (!message) return null;

    let props: Record<string, unknown> = {};
    try { props = message.getAllProperties ? message.getAllProperties() : {}; } catch { /* ignore */ }

    let recipients: Record<string, unknown>[] = [];
    try { recipients = message.getAllRecipients ? message.getAllRecipients() : []; } catch { /* ignore */ }

    const toList = recipients
      .filter((r: Record<string, unknown>) => (r["RecipientType"] as number) === 1 || !r["RecipientType"])
      .map((r: Record<string, unknown>) => r["DisplayName"] || r["SmtpAddress"] || "")
      .join("; ");
    const ccList = recipients
      .filter((r: Record<string, unknown>) => (r["RecipientType"] as number) === 2)
      .map((r: Record<string, unknown>) => r["DisplayName"] || r["SmtpAddress"] || "")
      .join("; ");

    let attachmentEntries: Record<string, unknown>[] = [];
    try { attachmentEntries = message.getAttachmentEntries ? message.getAttachmentEntries() : []; } catch { /* ignore */ }

    const attachments: EmailAttachment[] = attachmentEntries.map((a: Record<string, unknown>, i: number) => ({
      name: (a["AttachLongFilename"] as string) || (a["AttachLongFilenameW"] as string) || (a["AttachFilename"] as string) || (a["AttachFilenameW"] as string) || (a["DisplayName"] as string) || (a["DisplayNameW"] as string) || findProp(a, ["AttachLongFilename", "AttachFilename", "DisplayName", "AttachLongFilenameW", "AttachFilenameW", "DisplayNameW"]) || "anexo",
      size: (a["AttachSize"] as number) || 0,
      index: i,
    }));

    let subject = "";
    try { subject = fixEncoding(message.subject || findProp(props, ["Subject", "SubjectW", "ConversationTopic", "NormalizedSubject"])) || ""; } catch { /* ignore */ }

    let bodyHtml: string | null = null;
    try { bodyHtml = fixEncoding(message.bodyHTML) || null; } catch { /* ignore */ }

    let bodyText: string | null = null;
    try { bodyText = fixEncoding(message.body) || null; } catch { /* ignore */ }

    return {
      subject,
      senderName: fixEncoding(findProp(props, ["SenderName", "SenderNameW", "SentRepresentingName", "SentRepresentingNameW", "DisplayFrom"])) || "",
      senderEmail: findProp(props, ["SenderSmtpAddress", "SenderSmtpAddressW", "SenderEmailAddress", "SenderEmailAddressW"]) || "",
      receivedDate: formatDate(props),
      toRecipients: fixEncoding(toList) || "",
      ccRecipients: fixEncoding(ccList) || "",
      bodyHtml,
      bodyText,
      hasAttachments: message.hasAttachments || false,
      attachments,
    };
  } catch (err) {
    console.error("Error reading email:", err);
    return null;
  }
}

export function getAttachmentData(pstFile: PSTFile, folderNid: number, emailNid: number, attachmentIndex: number): { data: ArrayBuffer; name: string; mimeType: string } | null {
  const folder = findFolder(pstFile, folderNid);
  if (!folder) return null;

  try {
    const message = folder.getMessage(emailNid);
    const att = message.getAttachment(attachmentIndex);
    if (!att) return null;

    const name = (att["AttachLongFilename"] as string) || (att["AttachFilename"] as string) || (att["DisplayName"] as string) || "anexo";
    const mimeType = (att["AttachMimeTag"] as string) || "application/octet-stream";
    
    // The binary data is typically in AttachDataBinary
    const binaryData = att["AttachDataBinary"] || att["AttachDataObject"];
    if (!binaryData) return null;

    let uint8: Uint8Array;
    if (binaryData instanceof Uint8Array) {
      uint8 = binaryData;
    } else if (binaryData instanceof ArrayBuffer) {
      uint8 = new Uint8Array(binaryData);
    } else if (typeof binaryData === "object" && "buffer" in (binaryData as Record<string, unknown>)) {
      const view = binaryData as { buffer: ArrayBufferLike; byteOffset: number; byteLength: number };
      uint8 = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    } else {
      return null;
    }
    const buffer = uint8.slice().buffer as ArrayBuffer;

    return { data: buffer, name, mimeType };
  } catch (err) {
    console.error("Error reading attachment:", err);
    return null;
  }
}
