import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

type CopyIdProps = {
  value: string;
  label?: string;
};

export function CopyId({ value, label }: CopyIdProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex items-center gap-1 font-mono text-xs text-[var(--color-text-muted)] hover:text-[var(--color-heading)]"
      title={value}>
      {label ?? `${value.slice(0, 12)}…`}
      {copied ? <Check size={12} className="text-[var(--color-accent)]" /> : <Copy size={12} />}
    </button>
  );
}
