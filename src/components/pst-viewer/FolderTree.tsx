import { ChevronRight, ChevronDown, Folder, FolderOpen, Inbox } from "lucide-react";
import { useState } from "react";
import type { PstFolderNode } from "@/lib/pst-utils";

export type { PstFolderNode };

interface FolderTreeProps {
  folders: PstFolderNode[];
  selectedNid: number | null;
  onSelectFolder: (nid: number) => void;
  expandedNids?: Set<number>;
}

const FolderItem = ({
  folder,
  selectedNid,
  onSelectFolder,
  depth = 0,
  expandedNids,
}: {
  folder: PstFolderNode;
  selectedNid: number | null;
  onSelectFolder: (nid: number) => void;
  depth?: number;
  expandedNids?: Set<number>;
}) => {
  const [expanded, setExpanded] = useState(
    expandedNids ? expandedNids.has(folder.nid) : depth < 2
  );
  const isSelected = selectedNid === folder.nid;
  const hasChildren = folder.children && folder.children.length > 0;

  const Icon = depth === 0 ? Inbox : isSelected ? FolderOpen : Folder;

  return (
    <div>
      <button
        onClick={() => {
          onSelectFolder(folder.nid);
          if (hasChildren) setExpanded(!expanded);
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors ${
          isSelected
            ? "bg-primary/15 text-primary font-medium"
            : "text-foreground/80 hover:bg-muted/50"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{folder.displayName}</span>
        {folder.contentCount > 0 && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {folder.contentCount}
          </span>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderItem
              key={child.nid}
              folder={child}
              selectedNid={selectedNid}
              onSelectFolder={onSelectFolder}
              depth={depth + 1}
              expandedNids={expandedNids}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FolderTree = ({ folders, selectedNid, onSelectFolder, expandedNids }: FolderTreeProps) => {
  return (
    <div className="py-2 space-y-0.5 overflow-auto">
      {folders.map((folder) => (
        <FolderItem
          key={folder.nid}
          folder={folder}
          selectedNid={selectedNid}
          onSelectFolder={onSelectFolder}
          expandedNids={expandedNids}
        />
      ))}
    </div>
  );
};

export default FolderTree;
