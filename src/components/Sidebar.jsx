import logoUrl from '../assets/logo-eagle.png'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

export default function Sidebar({ activePage, onNavigate }) {
  const navItems = [
    { id: 'home', icon: 'home', title: 'Mission Overview', page: 'mission' },
    { id: 'control', icon: 'control_camera', title: 'Flight Controls & Map', page: 'map' },
    { id: 'settings', icon: 'settings', title: 'System Settings', page: 'settings' },
    { id: 'history', icon: 'history', title: 'Flight Archives', page: 'history' },
  ]

  const isItemActive = (itemId) => {
    if (activePage === 'mission') return itemId === 'home'
    if (activePage === 'map') return itemId === 'control'
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
          className="flex items-center justify-center bg-transparent transition"
          title="Eagle Drone"
        >
          <img src={logoUrl} alt="Eagle Drone" className="h-14 w-14 object-contain object-center" />
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
