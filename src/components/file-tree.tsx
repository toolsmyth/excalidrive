import { ChevronRight, FilePlus2, Folder, FolderOpen, FolderPlus, Loader2, MoreHorizontal, Pencil, PenLine, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FsNode, NodeKind } from "@/lib/storage/types";

export interface TreeActions {
  toggle: (folder: FsNode) => void;
  open: (drawing: FsNode) => void;
  create: (kind: NodeKind, parentId: string) => void;
  rename: (node: FsNode) => void;
  remove: (node: FsNode) => void;
}

interface TreeProps {
  parentId: string;
  depth: number;
  children: Record<string, FsNode[] | undefined>;
  expanded: Set<string>;
  loading: Set<string>;
  activeId: string | null;
  actions: TreeActions;
}

export function FileTree(props: TreeProps) {
  const items = props.children[props.parentId];
  if (!items) return null;
  if (items.length === 0 && props.depth > 0) {
    return (
      <div className="py-1 text-xs text-muted-foreground" style={{ paddingLeft: 12 + props.depth * 14 + 20 }}>
        Empty
      </div>
    );
  }
  return (
    <ul role={props.depth === 0 ? "tree" : "group"}>
      {items.map((node) => (
        <TreeItem key={node.id} node={node} {...props} />
      ))}
    </ul>
  );
}

function TreeItem({ node, ...props }: TreeProps & { node: FsNode }) {
  const { depth, expanded, loading, activeId, actions } = props;
  const isFolder = node.kind === "folder";
  const isOpen = isFolder && expanded.has(node.id);
  const isActive = activeId === node.id;

  return (
    <li role="treeitem" aria-expanded={isFolder ? isOpen : undefined} aria-selected={isActive}>
      <div
        className={cn(
          "group/item relative flex h-8 items-center gap-1.5 rounded-md pr-1 text-sm text-sidebar-foreground transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button
          className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md cursor-pointer"
          onClick={() => (isFolder ? actions.toggle(node) : actions.open(node))}
          onDoubleClick={() => actions.rename(node)}
          title={node.name}
        >
          {isFolder ? (
            <>
              {loading.has(node.id) ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
              )}
              {isOpen ? <FolderOpen className="size-4 shrink-0 text-muted-foreground" /> : <Folder className="size-4 shrink-0 text-muted-foreground" />}
            </>
          ) : (
            <>
              <span className="w-3.5 shrink-0" />
              <PenLine className="size-4 shrink-0 text-muted-foreground" />
            </>
          )}
          <span className="truncate">{node.name}</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-6 shrink-0 items-center justify-center rounded-md opacity-0 outline-none transition-opacity hover:bg-background/60 focus-visible:opacity-100 group-hover/item:opacity-100 data-[state=open]:opacity-100 cursor-pointer"
            aria-label={`Actions for ${node.name}`}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-44">
            {isFolder && (
              <>
                <DropdownMenuItem onSelect={() => actions.create("drawing", node.id)}>
                  <FilePlus2 /> New drawing
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => actions.create("folder", node.id)}>
                  <FolderPlus /> New folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={() => actions.rename(node)}>
              <Pencil /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => actions.remove(node)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isOpen && <FileTree {...props} parentId={node.id} depth={depth + 1} />}
    </li>
  );
}
