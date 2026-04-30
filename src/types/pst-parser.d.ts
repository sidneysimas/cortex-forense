declare module "pst-parser" {
  export class PSTFile {
    constructor(buffer: ArrayBuffer);
    getMessageStore(): unknown;
    getRootFolder(): Folder;
    getFolder(nid: number): Folder;
    getMessage(nid: number): Message;
  }

  export class Folder {
    get nid(): number;
    get displayName(): string;
    get contentCount(): number;
    get unreadCount(): number;
    get hasSubfolders(): boolean;
    getSubFolderEntries(): Record<string, unknown>[];
    getContents(start?: number, end?: number): Record<string, unknown>[];
    getSubFolder(nid: number): Folder;
    getMessage(nid: number): Message;
    getAllProperties(): Record<string, unknown>;
  }

  export class Message {
    get nid(): number;
    get subject(): string;
    get body(): string | undefined;
    get bodyHTML(): string | undefined;
    get hasAttachments(): boolean;
    getAllProperties(): Record<string, unknown>;
    getAllRecipients(): Record<string, unknown>[];
    getAttachmentEntries(): Record<string, unknown>[];
    getAttachment(index: number): Record<string, unknown> | null;
  }

  export class MessageStore {}
}
