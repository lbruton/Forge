import { Plus, Upload, Puzzle } from 'lucide-react';

interface WelcomeScreenProps {
  onRequestImport?: () => void;
  onRequestAddTemplate?: () => void;
  onRequestPlugins?: () => void;
}

function WelcomeScreen({ onRequestImport, onRequestAddTemplate, onRequestPlugins }: WelcomeScreenProps) {
  const handleImport = () => {
    if (onRequestImport) {
      onRequestImport();
    }
  };

  const handleAddTemplate = () => {
    if (onRequestAddTemplate) {
      onRequestAddTemplate();
    }
  };

  const handlePlugins = () => {
    if (onRequestPlugins) {
      onRequestPlugins();
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-8 max-w-lg text-center">
        {/* Logo with ember glow */}
        <div className="relative">
          {/* Glow background */}
          <div
            className="absolute inset-0 -m-8 rounded-full opacity-30 blur-2xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 70%)',
            }}
          />

          {/* Forge logo SVG — inline for zero fetch */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            className="relative w-48 h-48 sm:w-52 sm:h-52"
            aria-label="Forge logo"
          >
            <defs>
              <radialGradient id="welcomeEmberGlow" cx="50%" cy="60%" r="50%">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="welcomeFlameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#B45309" />
                <stop offset="40%" stopColor="#D97706" />
                <stop offset="70%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#FBBF24" />
              </linearGradient>
              <linearGradient id="welcomeAnvilGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="50%" stopColor="#334155" />
                <stop offset="100%" stopColor="#1E293B" />
              </linearGradient>
              <linearGradient id="welcomeAnvilHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#64748B" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#334155" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Background glow */}
            <circle cx="256" cy="280" r="200" fill="url(#welcomeEmberGlow)" />

            {/* Anvil body */}
            <rect
              x="176"
              y="370"
              width="160"
              height="30"
              rx="4"
              fill="url(#welcomeAnvilGrad)"
              stroke="#1E293B"
              strokeWidth="2"
            />
            <path
              d="M 206 370 L 216 320 L 296 320 L 306 370 Z"
              fill="url(#welcomeAnvilGrad)"
              stroke="#1E293B"
              strokeWidth="2"
            />
            <path
              d="M 156 320 L 156 280 Q 156 265 171 265 L 341 265 Q 356 265 356 280 L 356 320 Q 356 325 341 325 L 171 325 Q 156 325 156 320 Z"
              fill="url(#welcomeAnvilGrad)"
              stroke="#1E293B"
              strokeWidth="2"
            />
            <rect x="166" y="270" width="180" height="8" rx="3" fill="url(#welcomeAnvilHighlight)" />
            <path
              d="M 156 280 Q 156 265 171 265 L 156 272 Q 120 280 110 290 Q 100 300 110 310 L 156 320 Q 156 325 156 320 L 156 280 Z"
              fill="url(#welcomeAnvilGrad)"
              stroke="#1E293B"
              strokeWidth="2"
            />

            {/* Sparks */}
            <g fill="#FBBF24">
              <circle cx="200" cy="240" r="3" opacity="0.9" />
              <circle cx="230" cy="225" r="2.5" opacity="0.8" />
              <circle cx="270" cy="220" r="3" opacity="0.9" />
              <circle cx="310" cy="235" r="2" opacity="0.7" />
              <circle cx="185" cy="220" r="2" opacity="0.6" />
              <circle cx="320" cy="215" r="2.5" opacity="0.8" />
              <circle cx="175" cy="200" r="1.5" opacity="0.5" />
              <circle cx="340" cy="195" r="1.5" opacity="0.4" />
              <circle cx="250" cy="195" r="2" opacity="0.6" />
              <circle cx="290" cy="200" r="1.5" opacity="0.5" />
              <circle cx="210" cy="175" r="1.5" opacity="0.3" />
              <circle cx="300" cy="180" r="1" opacity="0.3" />
              <circle cx="260" cy="165" r="1.5" opacity="0.25" />
            </g>

            {/* Flame tongues */}
            <g opacity="0.7">
              <path
                d="M 240 265 Q 235 240 240 220 Q 245 200 250 215 Q 255 230 250 265 Z"
                fill="url(#welcomeFlameGrad)"
                opacity="0.5"
              />
              <path
                d="M 260 265 Q 255 235 260 210 Q 268 185 272 210 Q 276 235 270 265 Z"
                fill="url(#welcomeFlameGrad)"
                opacity="0.6"
              />
              <path
                d="M 280 265 Q 278 245 282 230 Q 286 218 288 232 Q 290 245 286 265 Z"
                fill="url(#welcomeFlameGrad)"
                opacity="0.4"
              />
            </g>

            {/* FORGE text */}
            <text
              x="256"
              y="448"
              textAnchor="middle"
              fontFamily="'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
              fontSize="56"
              fontWeight="700"
              letterSpacing="12"
              fill="#E2E8F0"
            >
              FORGE
            </text>
            <text
              x="256"
              y="478"
              textAnchor="middle"
              fontFamily="'Inter', 'Segoe UI', sans-serif"
              fontSize="14"
              fontWeight="400"
              letterSpacing="4"
              fill="#94A3B8"
            >
              NETWORK WORKSHOP
            </text>
          </svg>
        </div>

        {/* Tagline */}
        <p className="text-slate-400 italic text-base leading-relaxed">The forge is cold. Light it up.</p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleAddTemplate}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-lg hover:bg-forge-amber-bright transition-colors w-full sm:w-auto"
          >
            <Plus size={16} />
            Add Template
          </button>

          <button
            onClick={handleImport}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-300 border border-forge-steel rounded-lg hover:bg-forge-graphite transition-colors w-full sm:w-auto"
          >
            <Upload size={16} />
            Import .stvault
          </button>

          <button
            onClick={handlePlugins}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors w-full sm:w-auto"
          >
            <Puzzle size={16} />
            Configure Plugins
          </button>
        </div>

        {/* Description */}
        <p className="text-slate-500 text-xs leading-relaxed max-w-sm">
          Create a View for your network, add templates, connect plugins.
        </p>
      </div>
    </div>
  );
}

export default WelcomeScreen;
