// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Stub out globals that App.tsx depends on
const mockStore = {
  tree: { views: [] },
  selectedVariantId: null,
  selectedGlobalVariablesViewId: null,
  selectedPluginName: null,
  selectedPluginNodeId: null,
  selectedPluginViewId: null,
  preferences: { sidebarWidth: 256, sidebarCollapsed: false },
  editorDirty: false,
  pendingSaveCallback: null,
  toggleSidebar: vi.fn(),
  addView: vi.fn(),
  addVendor: vi.fn(),
  addModel: vi.fn(),
  addVariant: vi.fn(),
  saveTemplate: vi.fn(),
  setSelectedVariant: vi.fn(),
  setSelectedGlobalVariablesViewId: vi.fn(),
  setSelectedPluginName: vi.fn(),
  setSelectedPluginNodeId: vi.fn(),
  setPluginHealth: vi.fn(),
  getPlugins: vi.fn(() => []),
  getPlugin: vi.fn(),
  registerPlugin: vi.fn(),
  toggleExpandedNode: vi.fn(),
  setEditorDirty: vi.fn(),
  registerSecretsProvider: vi.fn(),
  setSidebarWidth: vi.fn(),
};

vi.mock('../store/index.ts', () => ({
  useForgeStore: Object.assign(vi.fn(() => mockStore), {
    getState: vi.fn(() => mockStore),
    persist: {
      onFinishHydration: vi.fn(() => vi.fn()),
      hasHydrated: vi.fn(() => true),
    },
  }),
}));

vi.mock('../plugins/init.ts', () => ({
  initBundledPlugins: vi.fn(),
}));

vi.mock('../plugins/infisical/provider.ts', () => ({
  InfisicalProvider: vi.fn(),
}));

vi.mock('../plugins/infisical/manifest.ts', () => ({
  INFISICAL_MANIFEST: { id: 'infisical', name: 'Infisical', type: 'integration' },
}));

vi.mock('../lib/plugin-service.ts', () => ({
  healthCheck: vi.fn(),
}));

// Mock child components to keep the test focused on the header
vi.mock('../components/Sidebar.tsx', () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock('../components/WelcomeScreen.tsx', () => ({
  default: () => <div data-testid="welcome" />,
}));

vi.mock('../components/CreateNodeModal.tsx', () => ({
  CreateNodeModal: () => null,
}));

vi.mock('../components/ConfigGenerator.tsx', () => ({
  default: () => null,
}));

vi.mock('../components/TemplateEditor.tsx', () => ({
  default: () => null,
}));

vi.mock('../components/GeneratedConfigViewer.tsx', () => ({
  GeneratedConfigViewer: () => null,
}));

vi.mock('../components/VaultModal.tsx', () => ({
  default: () => null,
}));

vi.mock('../components/GlobalVariablesPage.tsx', () => ({
  default: () => null,
}));

vi.mock('../components/UnsavedChangesModal.tsx', () => ({
  UnsavedChangesModal: () => null,
}));

vi.mock('../components/PluginPanel.tsx', () => ({
  default: () => null,
}));

vi.mock('../components/PluginContentView.tsx', () => ({
  default: () => null,
}));

vi.mock('../components/SectionCardView.tsx', () => ({
  SectionCardView: () => null,
}));

// ── Suite: Portfolio link in header ─────────────────────────────

describe('Portfolio link in header', () => {
  afterEach(() => cleanup());

  beforeEach(async () => {
    const { default: App } = await import('../App.tsx');
    render(<App />);
  });

  test('renders with href pointing to lbruton.cc', () => {
    const link = screen.getByRole('link', { name: /lbruton\.cc/i });
    expect(link).toHaveAttribute('href', 'https://www.lbruton.cc');
  });

  test('opens in new tab with noopener noreferrer', () => {
    const link = screen.getByRole('link', { name: /lbruton\.cc/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('displays text lbruton.cc', () => {
    expect(screen.getByText('lbruton.cc')).toBeInTheDocument();
  });

  test('has hidden sm:inline responsive class', () => {
    const link = screen.getByRole('link', { name: /lbruton\.cc/i });
    expect(link.className).toContain('hidden');
    expect(link.className).toContain('sm:inline');
  });

  test('does NOT use amber accent color', () => {
    const link = screen.getByRole('link', { name: /lbruton\.cc/i });
    expect(link.className).not.toMatch(/amber/);
    expect(link.className).not.toMatch(/forge-amber/);
  });
});
