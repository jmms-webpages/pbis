import { useAuth } from '../context/AuthContext';

export default function AppShell({ title, tabs, activeTab, onTabChange, children }) {
  const { profile, signOut } = useAuth();
  const hasTabs = Boolean(tabs && tabs.length > 0);

  return (
    <div className="min-h-screen bg-plum-50">
      <header className="bg-plum-900 text-white shadow-md">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-stretch gap-3 sm:gap-5">
            {/* Polar bear logo stretched from top to bottom of the purple header */}
            <div className="flex shrink-0 items-center justify-center self-stretch py-0">
              <img
                src="/polar-bear-head.png"
                alt="Jackson Polar Bears"
                width={hasTabs ? 112 : 64}
                height={hasTabs ? 112 : 64}
                loading="eager"
                decoding="sync"
                className={`${
                  hasTabs
                    ? 'h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28'
                    : 'h-14 w-14 sm:h-16 sm:w-16'
                } object-contain`}
              />
            </div>

            {/* Right section: Title row on top + Dashboard tabs shifted right of the logo */}
            <div className="flex flex-1 min-w-0 flex-col justify-between">
              <div className="flex items-center justify-between gap-4 pt-2.5 pb-1 sm:pt-3 sm:pb-1.5">
                <div className="min-w-0">
                  <h1 className="font-display text-lg sm:text-xl font-bold leading-tight tracking-wide text-white truncate">
                    {title}
                  </h1>
                  {profile?.displayName && (
                    <p className="text-xs text-plum-200 truncate">
                      {profile.displayName}
                      {profile.role ? ` • ${profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}` : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={signOut}
                  className="shrink-0 rounded-lg border border-plum-600 bg-plum-800/60 px-3 py-1.5 text-xs sm:text-sm font-medium text-plum-100 transition hover:bg-plum-800 hover:text-white"
                >
                  Sign out
                </button>
              </div>

              {hasTabs && (
                <nav className="flex gap-1 overflow-x-auto">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onTabChange(t.id)}
                      className={`whitespace-nowrap border-b-2 px-3 sm:px-4 py-2 text-sm font-medium transition ${
                        activeTab === t.id
                          ? 'border-gold-400 text-white font-semibold'
                          : 'border-transparent text-plum-300 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </nav>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
