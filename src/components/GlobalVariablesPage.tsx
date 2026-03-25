import { useForgeStore } from '../store/index.ts';

interface GlobalVariablesPageProps {
  viewId: string;
}

export default function GlobalVariablesPage({ viewId }: GlobalVariablesPageProps) {
  const tree = useForgeStore((s) => s.tree);
  const view = tree.views.find((v) => v.id === viewId);

  if (!view) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <p>View not found.</p>
      </div>
    );
  }

  const globals = view.globalVariables ?? [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      <h2 className="text-lg font-semibold text-slate-100 mb-4">
        Global Variables — {view.name}
      </h2>
      {globals.length === 0 ? (
        <p className="text-sm text-slate-500">
          No global variables defined for this view yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {globals.map((gv) => (
            <li key={gv.name} className="text-sm text-slate-300">
              <span className="font-mono text-forge-amber">${'{'}${gv.name}{'}'}</span>
              {gv.description && <span className="ml-2 text-slate-500">— {gv.description}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
