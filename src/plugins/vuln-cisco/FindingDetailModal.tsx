import { useEffect } from 'react';
import { X, CheckCircle, HelpCircle, MinusCircle, ExternalLink, Shield, AlertTriangle } from 'lucide-react';
import { openAdvisoryPopup } from './link-utils.ts';
import type { Finding } from './ScanReportViewer.tsx';

interface FindingDetailModalProps {
  finding: Finding | null;
  onClose: () => void;
}

const SEV_BADGE: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400' },
  HIGH: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  MEDIUM: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  LOW: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  INFO: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
};

export default function FindingDetailModal({ finding, onClose }: FindingDetailModalProps) {
  useEffect(() => {
    if (!finding) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [finding, onClose]);

  if (!finding) return null;

  const sevColors = SEV_BADGE[finding.severity] ?? SEV_BADGE.INFO;
  const sourceLabel = finding.source === 'cisco_openvuln' ? 'Cisco' : 'Nuclei';
  const sourceBadge =
    finding.source === 'cisco_openvuln' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-purple-500/15 text-purple-400';
  const sourceFullName = finding.source === 'cisco_openvuln' ? 'Cisco PSIRT' : 'Nuclei Network Scanner';

  const descriptionText = finding.description || finding.summary;
  const hasRemediation = !!finding.remediation;
  const hasImpact = !!finding.impact;
  const hasReferences = finding.references?.length > 0;
  const hasCves = finding.cve_ids?.length > 0;
  const hasCwes = finding.cwe?.length > 0;
  const hasEpss = finding.epss_score > 0;
  const hasKev = finding.kev === true;
  const hasFixVersions = finding.first_fixed?.length > 0;
  const noFixAvailable =
    hasFixVersions && finding.first_fixed.some((v) => v.toLowerCase().includes('no fix available'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl max-w-4xl w-full mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-700">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-slate-400">{finding.advisory_id}</span>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${sourceBadge}`}>
                {sourceLabel}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-slate-200">{finding.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex gap-6 p-6">
          {/* Left column */}
          <div className="w-3/5 space-y-5">
            {/* Description */}
            {descriptionText && (
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">Description</div>
                <p className="text-sm text-slate-300 leading-relaxed">{descriptionText}</p>
              </div>
            )}

            {/* Remediation */}
            {hasRemediation && (
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">Remediation</div>
                <p className="text-sm text-green-400 leading-relaxed">{finding.remediation}</p>
              </div>
            )}

            {/* Impact */}
            {hasImpact && (
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">Impact</div>
                <p className="text-sm text-slate-300 leading-relaxed">{finding.impact}</p>
              </div>
            )}

            {/* References */}
            {hasReferences && (
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">References</div>
                <ul className="space-y-1">
                  {finding.references.map((ref, i) => (
                    <li key={i}>
                      <a
                        href={ref}
                        onClick={(e) => openAdvisoryPopup(ref, e)}
                        className="text-amber-400 hover:text-amber-300 underline text-sm truncate inline-flex items-center gap-1 max-w-full cursor-pointer"
                      >
                        <span className="truncate">{ref}</span>
                        <ExternalLink size={12} className="shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CVE IDs */}
            {hasCves && (
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">CVE IDs</div>
                <div className="flex flex-wrap gap-2">
                  {finding.cve_ids.map((cve) => (
                    <a
                      key={cve}
                      href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                      onClick={(e) => openAdvisoryPopup(`https://nvd.nist.gov/vuln/detail/${cve}`, e)}
                      className="text-amber-400 text-sm font-mono inline-flex items-center gap-1 hover:text-amber-300 cursor-pointer"
                    >
                      {cve}
                      <ExternalLink size={10} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* CWE IDs */}
            {hasCwes && (
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">CWE IDs</div>
                <div className="flex flex-wrap gap-2">
                  {finding.cwe.map((cwe) => (
                    <span
                      key={cwe}
                      className="inline-block px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs font-mono"
                    >
                      {cwe}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="w-2/5 space-y-5">
            {/* Severity badge */}
            <div className="text-center">
              <span
                className={`inline-block px-4 py-2 rounded-lg text-sm font-bold uppercase ${sevColors.bg} ${sevColors.text}`}
              >
                <Shield size={14} className="inline mr-1.5 -mt-0.5" />
                {finding.severity}
              </span>
            </div>

            {/* CVSS Score */}
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-100 font-mono">
                {finding.cvss_base.toFixed(1)} <span className="text-sm font-normal text-slate-500">/ 10.0</span>
              </div>
              <div className="text-xs uppercase tracking-wider text-slate-500 mt-0.5">CVSS Base Score</div>
            </div>

            {/* EPSS */}
            {hasEpss && (
              <div className="bg-slate-700/40 rounded-lg p-3">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">EPSS</div>
                <div className="text-sm text-slate-400">
                  <span className="text-slate-200 font-semibold">{(finding.epss_score * 100).toFixed(2)}%</span>{' '}
                  probability of exploitation
                </div>
                <div className="text-sm text-slate-400 mt-0.5">
                  <span className="text-slate-200 font-semibold">{(finding.epss_percentile * 100).toFixed(0)}th</span>{' '}
                  percentile
                </div>
              </div>
            )}

            {/* KEV Status */}
            {hasKev && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-400" />
                  <span className="bg-red-500/15 text-red-400 font-bold text-xs px-2 py-0.5 rounded">CISA KEV</span>
                </div>
                {finding.kev_date_added && (
                  <div className="text-xs text-slate-500 mt-1.5">Added: {finding.kev_date_added}</div>
                )}
                {finding.kev_due_date && (
                  <div className="text-xs text-slate-500 mt-0.5">Due: {finding.kev_due_date}</div>
                )}
              </div>
            )}

            {/* Fix Version */}
            {hasFixVersions && (
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">Fix Version</div>
                <div className="space-y-0.5">
                  {finding.first_fixed.map((version, i) => (
                    <div
                      key={i}
                      className={`text-sm font-mono ${noFixAvailable ? 'text-amber-400' : 'text-slate-300'}`}
                    >
                      {version}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Product Match */}
            {finding.product_match && finding.product_match !== 'no_data' && (
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">Product Match</div>
                <div className="flex items-center gap-1.5 text-sm">
                  {finding.product_match === 'verified' ? (
                    <>
                      <CheckCircle size={14} className="text-green-400" />
                      <span className="text-green-400">Verified</span>
                    </>
                  ) : (
                    <>
                      <HelpCircle size={14} className="text-amber-400" />
                      <span className="text-amber-400">Unverified</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {finding.product_match === 'no_data' && (
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">Product Match</div>
                <div className="flex items-center gap-1.5 text-sm">
                  <MinusCircle size={14} className="text-slate-500" />
                  <span className="text-slate-500">No data</span>
                </div>
              </div>
            )}

            {/* Source */}
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Source</div>
              <div className="text-xs text-slate-500">{sourceFullName}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
