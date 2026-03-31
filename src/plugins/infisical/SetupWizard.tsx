import { useState, useCallback } from 'react';
import { InfisicalClient } from './api.ts';
import { useForgeStore } from '../../store/index.ts';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Server,
  Shield,
  XCircle,
} from 'lucide-react';
import type { SecretProject } from '../../types/secrets-provider.ts';

export interface SetupWizardProps {
  pluginName: string;
  onComplete: () => void;
  onCancel: () => void;
}

const STEP_TITLES = [
  'Prerequisites',
  'Create API Credentials',
  'Configure Infisical Project',
  'Choose Access Level',
  'Connect to Infisical',
  'Connected!',
] as const;

const INPUT_CLASSES =
  'w-full px-2.5 py-1.5 bg-forge-obsidian border border-forge-steel rounded text-[13px] text-slate-200 outline-none focus:border-forge-amber focus:shadow-[0_0_0_2px_rgba(245,158,11,0.15)] transition-colors';

// --- Step Components ---

function StepPrerequisites() {
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-slate-300 leading-relaxed">
        Infisical is a self-hosted secrets manager that lets Forge retrieve and store sensitive values like API keys,
        passwords, and tokens. Before continuing, make sure you have:
      </p>
      <ol className="space-y-3 text-[13px] text-slate-300">
        <li className="flex items-start gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-forge-amber/20 text-forge-amber text-[12px] font-bold flex items-center justify-center mt-0.5">
            1
          </span>
          <span>
            A running <strong className="text-slate-200">Infisical instance</strong> (Docker or LXC)
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-forge-amber/20 text-forge-amber text-[12px] font-bold flex items-center justify-center mt-0.5">
            2
          </span>
          <span>
            A <strong className="text-slate-200">reverse proxy</strong> (e.g. Nginx Proxy Manager) in front of the
            Infisical API with CORS headers enabled
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-forge-amber/20 text-forge-amber text-[12px] font-bold flex items-center justify-center mt-0.5">
            3
          </span>
          <span>
            <strong className="text-slate-200">Admin access</strong> to create API credentials (Machine Identity)
          </span>
        </li>
      </ol>
      <div className="bg-forge-charcoal border border-forge-steel rounded-lg p-3 mt-2">
        <p className="text-[12px] text-slate-400 leading-relaxed">
          <strong className="text-slate-300">CORS setup:</strong> In your reverse proxy, add a custom header{' '}
          <code className="text-forge-amber font-mono text-[11px]">Access-Control-Allow-Origin: *</code> to the
          Infisical API proxy host. Forge calls the API directly from the browser, so this header is required.
        </p>
      </div>
    </div>
  );
}

function StepCreateCredentials() {
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-slate-400 leading-relaxed">
        Infisical uses <em>Machine Identities</em> for API access. Follow these steps to create one:
      </p>
      <ol className="space-y-3 text-[13px] text-slate-300">
        {[
          'Open Infisical Admin Console',
          'Go to Organization Settings \u2192 Access Control \u2192 Machine Identities',
          'Click "Create" \u2192 name it "Forge"',
          'Under Authentication, select "Universal Auth"',
          'Click "Create Client Secret"',
          "Copy the Client ID and Client Secret (you'll need both in step 5)",
        ].map((text, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-forge-charcoal border border-forge-steel text-slate-400 text-[12px] font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <div className="bg-forge-charcoal border border-forge-steel rounded-lg p-3 mt-4">
        <p className="text-[12px] text-forge-amber flex items-center gap-2">
          <Shield size={14} className="shrink-0" />
          Keep this tab open — you'll paste these values in the Connect step.
        </p>
      </div>
    </div>
  );
}

function StepProjectSetup() {
  return (
    <div className="space-y-4">
      <ol className="space-y-3 text-[13px] text-slate-300">
        {[
          'In Infisical, create a new project called "Forge" (or use an existing project)',
          'Go to Project Settings \u2192 Machine Identities',
          'Add the "Forge" identity created in step 2',
          'Choose the role (see next step for guidance)',
        ].map((text, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-forge-charcoal border border-forge-steel text-slate-400 text-[12px] font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepAccessLevel({
  accessLevel,
  setAccessLevel,
}: {
  accessLevel: 'read-only' | 'full';
  setAccessLevel: (level: 'read-only' | 'full') => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <button
          onClick={() => { setAccessLevel('read-only'); }}
          className={`w-full text-left p-4 rounded-lg border transition-colors ${
            accessLevel === 'read-only'
              ? 'border-forge-amber bg-forge-amber/5'
              : 'border-forge-steel bg-forge-charcoal hover:border-slate-500'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                accessLevel === 'read-only' ? 'border-forge-amber' : 'border-slate-500'
              }`}
            >
              {accessLevel === 'read-only' && <div className="w-2 h-2 rounded-full bg-forge-amber" />}
            </div>
            <span className="text-[13px] font-semibold text-slate-200">Read Only (Viewer)</span>
          </div>
          <p className="text-[12px] text-slate-400 ml-7">
            Browse and retrieve secrets. Cannot create or update secrets from Forge. Best for teams that manage secrets
            directly in Infisical.
          </p>
        </button>

        <button
          onClick={() => setAccessLevel('full')}
          className={`w-full text-left p-4 rounded-lg border transition-colors ${
            accessLevel === 'full'
              ? 'border-forge-amber bg-forge-amber/5'
              : 'border-forge-steel bg-forge-charcoal hover:border-slate-500'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                accessLevel === 'full' ? 'border-forge-amber' : 'border-slate-500'
              }`}
            >
              {accessLevel === 'full' && <div className="w-2 h-2 rounded-full bg-forge-amber" />}
            </div>
            <span className="text-[13px] font-semibold text-slate-200">Full Access (Admin/Member)</span>
          </div>
          <p className="text-[12px] text-slate-400 ml-7">
            Browse, retrieve, create, and update secrets. Enables syncing Forge global variables to Infisical. Best for
            solo operators.
          </p>
        </button>
      </div>

      <div className="bg-forge-charcoal border border-forge-steel rounded-lg p-3">
        <p className="text-[12px] text-slate-400">
          This is controlled by the role you assigned in Infisical. Forge detects the access level automatically on
          connection.
        </p>
      </div>
    </div>
  );
}

function StepConnect({
  endpoint,
  setEndpoint,
  clientId,
  setClientId,
  clientSecret,
  setClientSecret,
  testResult,
  testing,
  onTest,
}: {
  endpoint: string;
  setEndpoint: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  clientSecret: string;
  setClientSecret: (v: string) => void;
  testResult: { connected: boolean; canWrite: boolean; error?: string } | null;
  testing: boolean;
  onTest: () => void;
}) {
  const [secretRevealed, setSecretRevealed] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Infisical API URL</label>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => { setEndpoint(e.target.value); }}
          placeholder="https://infisical-api.example.com"
          className={INPUT_CLASSES}
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Client ID</label>
        <input
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Client ID from step 2"
          className={INPUT_CLASSES}
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Client Secret</label>
        <div className="relative">
          <input
            type={secretRevealed ? 'text' : 'password'}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Client Secret from step 2"
            className={INPUT_CLASSES}
          />
          <button
            type="button"
            onClick={() => setSecretRevealed((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {secretRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <button
        onClick={onTest}
        disabled={testing || !endpoint.trim() || !clientId.trim() || !clientSecret.trim()}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-forge-amber text-forge-obsidian text-[13px] font-semibold rounded-md hover:bg-amber-400 transition-colors disabled:opacity-50"
      >
        {testing ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Testing...
          </>
        ) : (
          <>
            <Server size={14} />
            Test Connection
          </>
        )}
      </button>

      {testResult && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border ${
            testResult.connected ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'
          }`}
        >
          {testResult.connected ? (
            <>
              <CheckCircle2 size={16} className="text-green-400 shrink-0" />
              <span className="text-[13px] text-green-400">
                Connected ({testResult.canWrite ? 'Full Access' : 'Read Only'})
              </span>
            </>
          ) : (
            <>
              <XCircle size={16} className="text-red-400 shrink-0" />
              <span className="text-[13px] text-red-400">{testResult.error || 'Connection failed'}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StepSummary({
  endpoint,
  canWrite,
  projects,
  defaultProjectId,
  setDefaultProjectId,
  defaultEnvironment,
  setDefaultEnvironment,
}: {
  endpoint: string;
  canWrite: boolean;
  projects: SecretProject[];
  defaultProjectId: string;
  setDefaultProjectId: (v: string) => void;
  defaultEnvironment: string;
  setDefaultEnvironment: (v: string) => void;
}) {
  const selectedProject = projects.find((p) => p.id === defaultProjectId);
  const environments = selectedProject?.environments ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <CheckCircle2 size={32} className="text-green-400" />
        <div>
          <p className="text-[14px] font-semibold text-slate-200">Successfully connected to Infisical</p>
          <p className="text-[12px] text-slate-400">{endpoint}</p>
        </div>
      </div>

      <div className="bg-forge-charcoal border border-forge-graphite rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-slate-400">Access Level</span>
          <span className="text-[12px] text-slate-200 font-medium">{canWrite ? 'Full Access' : 'Read Only'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-slate-400">Projects</span>
          <span className="text-[12px] text-slate-200 font-medium">{projects.length}</span>
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Default Project</label>
        <select
          value={defaultProjectId}
          onChange={(e) => setDefaultProjectId(e.target.value)}
          className={`${INPUT_CLASSES} cursor-pointer`}
        >
          <option value="">Select a project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Default Environment</label>
        <select
          value={defaultEnvironment}
          onChange={(e) => setDefaultEnvironment(e.target.value)}
          className={`${INPUT_CLASSES} cursor-pointer`}
        >
          {environments.length > 0 ? (
            environments.map((env) => (
              <option key={env.slug} value={env.slug}>
                {env.name}
              </option>
            ))
          ) : (
            <>
              <option value="dev">Development</option>
              <option value="staging">Staging</option>
              <option value="prod">Production</option>
            </>
          )}
        </select>
      </div>
    </div>
  );
}

// --- Main Wizard ---

export default function SetupWizard({ pluginName, onComplete, onCancel }: SetupWizardProps) {
  const updatePluginSettings = useForgeStore((s) => s.updatePluginSettings);
  const setPluginHealth = useForgeStore((s) => s.setPluginHealth);

  const [step, setStep] = useState(0);
  const [accessLevel, setAccessLevel] = useState<'read-only' | 'full'>('full');

  // Connect step state
  const [endpoint, setEndpoint] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    canWrite: boolean;
    error?: string;
  } | null>(null);

  // Summary step state
  const [projects, setProjects] = useState<SecretProject[]>([]);
  const [defaultProjectId, setDefaultProjectId] = useState('');
  const [defaultEnvironment, setDefaultEnvironment] = useState('dev');

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const client = new InfisicalClient(endpoint.trim(), clientId.trim(), clientSecret.trim());
      const result = await client.testConnection();
      setTestResult(result);

      if (result.connected) {
        // Pre-fetch projects for the summary step
        try {
          const projectList = await client.listProjects();
          setProjects(projectList);
        } catch {
          // Non-fatal — user can still complete setup
          setProjects([]);
        }
      }
    } catch (err) {
      setTestResult({
        connected: false,
        canWrite: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  }, [endpoint, clientId, clientSecret]);

  const handleFinish = useCallback(() => {
    updatePluginSettings(pluginName, {
      endpoint: endpoint.trim(),
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      defaultProjectId,
      defaultEnvironment,
    });
    setPluginHealth(pluginName, {
      status: 'active',
      lastChecked: new Date().toISOString(),
    });
    onComplete();
  }, [
    pluginName,
    endpoint,
    clientId,
    clientSecret,
    defaultProjectId,
    defaultEnvironment,
    updatePluginSettings,
    setPluginHealth,
    onComplete,
  ]);

  const canAdvance = (): boolean => {
    if (step === 4) {
      return testResult !== null && testResult.connected;
    }
    return true;
  };

  const isLastStep = step === STEP_TITLES.length - 1;
  const isFirstStep = step === 0;

  return (
    <div className="flex flex-col h-full bg-forge-obsidian">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-forge-graphite bg-forge-charcoal">
        <Shield size={20} className="text-forge-amber shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-slate-200">Infisical Setup</h2>
          <span className="text-[11px] text-slate-500">
            Step {step + 1} of {STEP_TITLES.length} — {STEP_TITLES[step]}
          </span>
        </div>
        <button onClick={onCancel} className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors">
          Cancel
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-6 pt-4">
        <div className="flex gap-1.5">
          {STEP_TITLES.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-forge-amber' : 'bg-forge-steel'}`}
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <h3 className="text-[15px] font-semibold text-slate-200 mb-4">{STEP_TITLES[step]}</h3>

        {step === 0 && <StepPrerequisites />}
        {step === 1 && <StepCreateCredentials />}
        {step === 2 && <StepProjectSetup />}
        {step === 3 && <StepAccessLevel accessLevel={accessLevel} setAccessLevel={setAccessLevel} />}
        {step === 4 && (
          <StepConnect
            endpoint={endpoint}
            setEndpoint={setEndpoint}
            clientId={clientId}
            setClientId={setClientId}
            clientSecret={clientSecret}
            setClientSecret={setClientSecret}
            testResult={testResult}
            testing={testing}
            onTest={handleTest}
          />
        )}
        {step === 5 && (
          <StepSummary
            endpoint={endpoint}
            canWrite={testResult?.canWrite ?? false}
            projects={projects}
            defaultProjectId={defaultProjectId}
            setDefaultProjectId={setDefaultProjectId}
            defaultEnvironment={defaultEnvironment}
            setDefaultEnvironment={setDefaultEnvironment}
          />
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-forge-graphite bg-forge-charcoal">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={isFirstStep}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        {isLastStep ? (
          <button
            onClick={handleFinish}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-forge-amber text-forge-obsidian text-[13px] font-semibold rounded-md hover:bg-amber-400 transition-colors"
          >
            <Check size={14} />
            Done
          </button>
        ) : (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-forge-amber text-forge-obsidian text-[13px] font-semibold rounded-md hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            {step === 0 ? 'I have Infisical running' : 'Next'}
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
