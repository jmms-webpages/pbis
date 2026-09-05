export default function TeacherSidebar({ classes, view, onSelectDashboard, onSelectClass, onNewClass, collapsed }) {
  return (
    <aside
      className={`shrink-0 border-r border-plum-800 bg-plum-900 text-white transition-all ${
        collapsed ? 'w-0 overflow-hidden' : 'w-60'
      }`}
    >
      <div className="flex h-full flex-col p-4">
        <button
          onClick={onSelectDashboard}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
            view === 'dashboard' ? 'bg-plum-700 text-white' : 'text-plum-200 hover:bg-plum-800'
          }`}
        >
          <DashboardIcon />
          Dashboard
        </button>

        <div className="mt-6 flex items-center justify-between px-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-plum-400">Classes</span>
          <button
            onClick={onNewClass}
            title="New class"
            className="flex h-5 w-5 items-center justify-center rounded-full bg-plum-700 text-sm leading-none text-gold-300 hover:bg-plum-600"
          >
            +
          </button>
        </div>

        <ul className="mt-2 flex-1 space-y-0.5 overflow-y-auto">
          {classes.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onSelectClass(c.id)}
                className={`flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition ${
                  view === c.id ? 'bg-plum-700 text-white' : 'text-plum-200 hover:bg-plum-800'
                }`}
              >
                <span className="text-sm font-medium">{c.className}</span>
                <span className="text-xs opacity-60">
                  Period {c.period} · Grade {c.gradeLevel}
                </span>
              </button>
            </li>
          ))}
          {classes.length === 0 && (
            <li className="px-3 py-4 text-xs text-plum-400">No classes yet — tap + to add one.</li>
          )}
        </ul>
      </div>
    </aside>
  );
}

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
