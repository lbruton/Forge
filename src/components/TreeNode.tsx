import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronRight, Plus, MoreVertical, Copy } from 'lucide-react';
import { useForgeStore } from '../store/index.ts';

interface TreeNodeProps {
  id: string;
  label: ReactNode;
  icon: ReactNode;
  depth: number;
  hasChildren: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onAdd?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  contextMenuExtras?: { label: string; onClick: () => void; className?: string }[];
  isSection?: boolean;
  children?: ReactNode;
}

export function TreeNode({
  id,
  label,
  icon,
  depth,
  hasChildren,
  isSelected = false,
  onSelect,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
  contextMenuExtras,
  isSection = false,
  children,
}: TreeNodeProps) {
  const { preferences, toggleExpandedNode } = useForgeStore();
  const isExpanded = preferences.expandedNodes.includes(id);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!contextMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [contextMenuOpen]);

  const hasMenuActions = !!(onAdd ?? onEdit ?? onDuplicate ?? onDelete ?? contextMenuExtras?.length);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!hasMenuActions) return; // no actions = no menu
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  const handleDotsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPosition({ x: rect.right, y: rect.bottom });
    setContextMenuOpen(true);
  };

  return (
    <div>
      <div
        className={`
          group flex items-center gap-1.5 cursor-pointer select-none
          transition-colors duration-150
          ${isSelected ? 'border-l-[3px] border-forge-amber text-forge-amber bg-forge-amber/5' : 'border-l-[3px] border-transparent text-slate-400'}
          ${!isSelected ? 'hover:bg-forge-graphite hover:text-slate-200' : ''}
        `}
        style={{ paddingLeft: `${depth * 14 + 8}px`, paddingRight: '8px', paddingTop: '5px', paddingBottom: '5px' }}
        onClick={() => {
          if (hasChildren && !onSelect) toggleExpandedNode(id);
          onSelect?.();
        }}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => { setHovered(true); }}
        onMouseLeave={() => { setHovered(false); }}
      >
        {hasChildren ? (
          <ChevronRight
            size={12}
            className={`shrink-0 text-slate-500 transition-transform duration-150 hover:text-slate-200 ${isExpanded ? 'rotate-90' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpandedNode(id);
            }}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <span className="shrink-0">{icon}</span>
        <span
          className={`text-[13px] truncate flex-1 ${isSelected ? 'text-inherit' : isSection ? 'font-semibold text-slate-300' : 'font-medium text-amber-200/80'}`}
        >
          {label}
        </span>

        {onAdd && hovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="shrink-0 p-0.5 rounded text-slate-500 hover:text-forge-amber hover:bg-forge-graphite transition-colors"
            title="Add child"
          >
            <Plus size={14} />
          </button>
        )}

        {hovered && (onEdit ?? onDuplicate ?? onDelete) && (
          <button
            onClick={handleDotsClick}
            className="shrink-0 p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-forge-graphite transition-colors"
          >
            <MoreVertical size={14} />
          </button>
        )}
      </div>

      {/* Context menu */}
      {contextMenuOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-forge-charcoal border border-forge-steel rounded-lg shadow-xl py-1 min-w-[120px]"
          style={{ left: menuPosition.x, top: menuPosition.y }}
        >
          {onAdd && (
            <button
              className="w-full text-left px-3 py-1.5 text-[13px] text-slate-300 hover:bg-forge-graphite hover:text-slate-100 transition-colors flex items-center gap-2"
              onClick={() => {
                setContextMenuOpen(false);
                onAdd();
              }}
            >
              <Plus size={12} />
              Add
            </button>
          )}
          {onEdit && (
            <button
              className="w-full text-left px-3 py-1.5 text-[13px] text-slate-300 hover:bg-forge-graphite hover:text-slate-100 transition-colors"
              onClick={() => {
                setContextMenuOpen(false);
                onEdit();
              }}
            >
              Edit
            </button>
          )}
          {onDuplicate && (
            <button
              className="w-full text-left px-3 py-1.5 text-[13px] text-slate-300 hover:bg-forge-graphite hover:text-slate-100 transition-colors flex items-center gap-2"
              onClick={() => {
                setContextMenuOpen(false);
                onDuplicate();
              }}
            >
              <Copy size={12} />
              Duplicate
            </button>
          )}
          {onDelete && (
            <button
              className="w-full text-left px-3 py-1.5 text-[13px] text-red-400 hover:bg-forge-graphite hover:text-red-300 transition-colors"
              onClick={() => {
                setContextMenuOpen(false);
                onDelete();
              }}
            >
              Delete
            </button>
          )}
          {contextMenuExtras?.map((item) => (
            <button
              key={item.label}
              className={
                item.className ??
                'w-full text-left px-3 py-1.5 text-[13px] text-slate-300 hover:bg-forge-graphite hover:text-slate-100 transition-colors'
              }
              onClick={() => {
                setContextMenuOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Children */}
      {hasChildren && isExpanded && children}
    </div>
  );
}
