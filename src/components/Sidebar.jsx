function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

export default function Sidebar({ activePage, onNavigate }) {
  const navItems = [
    { id: 'home', icon: 'home', title: 'Mission Overview', page: 'mission' },
    { id: 'control', icon: 'control_camera', title: 'Flight Controls & Map', page: 'map' },
    { id: 'grid', icon: 'grid_view', title: 'Detection Events', page: 'events' },
    { id: 'video', icon: 'videocam', title: 'Live Camera Feed', page: 'mission' },
    { id: 'settings', icon: 'settings', title: 'System Settings', page: 'settings' },
    { id: 'history', icon: 'history', title: 'Flight Archives', page: 'history' },
  ]

  const isItemActive = (itemId) => {
    if (activePage === 'mission') return itemId === 'home'
    if (activePage === 'map') return itemId === 'control'
    if (activePage === 'events') return itemId === 'grid'
    if (activePage === 'settings') return itemId === 'settings'
    if (activePage === 'history') return itemId === 'history'
    return false
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[72px] flex-col items-center justify-between border-r border-slate-200 bg-white py-5">
      {/* Top Logo */}
      <div className="flex flex-col items-center gap-6">
        <button
          onClick={() => onNavigate('mission')}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-800"
          title="Eagle Drone"
        >
          {/* DP / Drone Monogram Logo */}
          <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h5a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H4V8z" />
            <path d="M15 8h4a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-4" />
            <circle cx="9" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </button>

        {/* Navigation Icons Stack */}
        <nav className="flex flex-col items-center gap-2">
          {navItems.map((item) => {
            const isActive = isItemActive(item.id)
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.page)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                }`}
                title={item.title}
              >
                <Icon className={isActive ? '[font-variation-settings:"FILL"_1]' : ''}>{item.icon}</Icon>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Bottom Actions & User Profile */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative group cursor-pointer">
          <img
            src="/assets/pilot_avatar.jpg"
            alt="Pilot Profile"
            className="h-10 w-10 rounded-xl object-cover ring-2 ring-slate-100 shadow-sm transition group-hover:ring-slate-300"
          />
        </div>
      </div>
    </aside>
  )
}
