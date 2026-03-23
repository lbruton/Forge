import { useState, useCallback } from 'react';
import { Copy, Download } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  label?: string;
}

interface DownloadButtonProps {
  text: string;
  filename: string;
  label?: string;
}

export function CopyButton({ text, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <div className="relative inline-block">
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium
          text-slate-400 hover:text-forge-amber bg-forge-graphite/50 hover:bg-forge-graphite
          border border-forge-steel/50 rounded transition-colors duration-150"
        title={label ?? 'Copy to clipboard'}
      >
        <Copy size={12} />
        {label && <span>{label}</span>}
      </button>
      {copied && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1
          text-xs text-forge-amber bg-forge-charcoal border border-forge-steel
          rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
          Copied!
        </span>
      )}
    </div>
  );
}

export function DownloadButton({ text, filename, label }: DownloadButtonProps) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [text, filename]);

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium
        text-slate-400 hover:text-forge-amber bg-forge-graphite/50 hover:bg-forge-graphite
        border border-forge-steel/50 rounded transition-colors duration-150"
      title={label ?? `Download ${filename}`}
    >
      <Download size={12} />
      {label && <span>{label}</span>}
    </button>
  );
}
