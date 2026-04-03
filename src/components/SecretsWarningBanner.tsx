import { useState } from 'react';
import { AlertCircle, AlertTriangle, Shield, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { SecretFinding, SecretSeverity } from '../lib/secrets-detector';

interface SecretsWarningBannerProps {
  findings: SecretFinding[];
  onNavigate: (line: number) => void;
  onDismiss: () => void;
}

/** Severity dot color classes. */
const DOT_COLOR: Record<SecretSeverity, string> = {
  critical: 'bg-red-500',
  high: 'bg-amber-500',
  low: 'bg-slate-500',
};

/** Banner color sets keyed by highest severity. */
const BANNER_COLORS: Record<SecretSeverity, { bg: string; border: string; text: string; dismiss: string }> = {
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
    dismiss: 'text-red-400/60 hover:text-red-400',
  },
  high: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    dismiss: 'text-amber-400/60 hover:text-amber-400',
  },
  low: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
    text: 'text-slate-400',
    dismiss: 'text-slate-400/60 hover:text-slate-400',
  },
};

/** Severity label color classes. */
const SEVERITY_TEXT: Record<SecretSeverity, string> = {
  critical: 'text-red-400',
  high: 'text-amber-400',
  low: 'text-slate-400',
};

export function SecretsWarningBanner({ findings, onNavigate, onDismiss }: SecretsWarningBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (findings.length === 0) return null;

  // Count by severity
  const counts: Record<SecretSeverity, number> = { critical: 0, high: 0, low: 0 };
  for (const f of findings) {
    counts[f.severity]++;
  }

  // Highest severity
  const highest: SecretSeverity = counts.critical > 0 ? 'critical' : counts.high > 0 ? 'high' : 'low';

  // Summary text: "3 exposed secrets (2 critical, 1 high)"
  const parts: string[] = [];
  if (counts.critical > 0) parts.push(`${counts.critical} critical`);
  if (counts.high > 0) parts.push(`${counts.high} high`);
  if (counts.low > 0) parts.push(`${counts.low} low`);
  const summary = `${findings.length} exposed secret${findings.length !== 1 ? 's' : ''}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;

  const colors = BANNER_COLORS[highest];

  // Icon based on severity
  const Icon = highest === 'critical' ? AlertCircle : highest === 'high' ? AlertTriangle : Shield;

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-lg text-sm transition-colors`}>
      {/* Header row */}
      <div className={`flex items-center gap-2 px-4 py-2.5 ${colors.text}`}>
        <Icon size={16} className="shrink-0" />
        <span className="flex-1">{summary}</span>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={`shrink-0 ${colors.dismiss} transition-colors`}
          aria-label={expanded ? 'Collapse findings' : 'Expand findings'}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className={`shrink-0 ${colors.dismiss} transition-colors`}
          aria-label="Dismiss warning"
        >
          <X size={14} />
        </button>
      </div>

      {/* Expanded finding list */}
      {expanded && (
        <div>
          {findings.map((finding, idx) => (
            <button
              key={`${finding.ruleId}-${finding.line}-${idx}`}
              type="button"
              onClick={() => onNavigate(finding.line)}
              className="w-full flex items-center gap-2 px-3 py-1.5 border-t border-white/5 hover:bg-white/5 cursor-pointer text-left transition-colors"
            >
              <span className="font-mono text-slate-500 text-xs shrink-0 w-14">
                Line {finding.line}
              </span>
              <span
                className={`w-2 h-2 rounded-full inline-block shrink-0 ${DOT_COLOR[finding.severity]}`}
              />
              <span className={`text-xs uppercase shrink-0 ${SEVERITY_TEXT[finding.severity]}`}>
                {finding.severity}
              </span>
              <span className="text-xs text-slate-400 truncate">{finding.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
