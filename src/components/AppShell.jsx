import { useAuth } from '../context/AuthContext';

export default function AppShell({ title, tabs, activeTab, onTabChange, children }) {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-plum-50">
      <header className="bg-plum-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400 font-display text-lg font-semibold text-plum-900">
              P
            </div>
            <div>
              <p className="font-display text-lg font-semibold leading-tight">{title}</p>
              <p className="text-xs text-plum-200">{profile?.displayName}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg border border-plum-600 px-3 py-1.5 text-sm text-plum-100 transition hover:bg-plum-800"
          >
            Sign out
          </button>
        </div>
        {tabs && (
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === t.id
                    ? 'border-gold-400 text-white'
                    : 'border-transparent text-plum-300 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
