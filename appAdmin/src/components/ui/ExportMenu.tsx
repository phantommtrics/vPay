import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

type ExportFormat = 'csv' | 'pdf';

type ExportMenuProps = {
  disabled?: boolean;
  onExport: (format: ExportFormat) => void | Promise<void>;
};

export function ExportMenu({ disabled = false, onExport }: ExportMenuProps) {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  async function handleExport(format: ExportFormat) {
    setExporting(format);
    try {
      await onExport(format);
      setOpen(false);
    } finally {
      setExporting(null);
    }
  }

  const options: { format: ExportFormat; label: string; icon: typeof FileSpreadsheet }[] = [
    { format: 'csv', label: 'CSV', icon: FileSpreadsheet },
    { format: 'pdf', label: 'PDF', icon: FileText },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled || exporting !== null}
        onClick={() => setOpen((value) => !value)}
        className="btn-secondary inline-flex items-center gap-2"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {exporting ? 'Exporting…' : 'Export'}
        <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
        >
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.format}
                type="button"
                role="menuitem"
                disabled={exporting !== null}
                onClick={() => void handleExport(option.format)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-heading)] transition-colors hover:bg-[var(--color-canvas-subtle)] disabled:opacity-50"
              >
                <Icon size={15} className="text-[var(--color-text-muted)]" />
                {option.label}
                {exporting === option.format ? (
                  <Loader2 size={13} className="ml-auto animate-spin text-[var(--color-text-muted)]" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
