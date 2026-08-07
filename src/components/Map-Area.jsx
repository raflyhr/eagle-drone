const logoUrl = 'https://lh3.googleusercontent.com/aida/AP1WRLtVE_7213Rt9fqz8YTDohCzOiDbD_uWKRr1kjImrtZsVtlxefE2AvOT_QVYo98G6t3Tu6uvn9AhHp3HygArhNKDpNBmmtuzLmw1OIoo2KKmc9LI4Y47XDZ8B9xtg0NBcOyn7cn5UkYrSARxPkqqgEpV8KPbZZ0MXnH0brQ0eRgbl6hwjd8kPJ4rUycWB6Uf8PsD1xZir08Xc4UVkwEsWUUnztCi1O24dbWvSdYznXA468dOiNeeznyKZQT5'

const navigationItems = [
  ['dashboard', 'Mission Overview', 'mission'],
  ['map', 'Map & Search Area', 'map'],
  ['target', 'Detection Events', 'events'],
  ['history', 'Flight History', 'history'],
  ['settings', 'System Settings', 'settings'],
]

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function MapArea({ onNavigate }) {
  return (
    <div className="flex h-screen justify-center overflow-hidden bg-[#0b0e14]">
      <div className="relative flex h-full w-full overflow-hidden bg-surface-container-lowest">
        <aside className="z-50 hidden h-full w-64 shrink-0 flex-col border-r border-white/10 bg-surface-container py-5 md:flex">
          <div className="mb-8 flex items-center gap-3 px-6">
            <img alt="Eagle Drone Logo" className="h-10 w-10 rounded-md object-cover" src={logoUrl} />
            <div><h1 className="font-headline-md text-2xl font-bold tracking-tight text-primary">Eagle Drone</h1><p className="font-body-sm text-sm text-on-surface-variant">SAR Command Unit</p></div>
          </div>
          <nav className="flex-1 space-y-2 px-4">
            {navigationItems.map(([icon, label, page]) => (
              <button key={label} onClick={() => page && onNavigate(page)} className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition ${page === 'map' ? 'border-r-2 border-primary bg-primary/5 font-bold text-primary' : 'font-medium text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'}`}>
                <Icon className={page === 'map' ? '[font-variation-settings:"FILL"_1]' : ''}>{icon}</Icon>
                <span className="font-label-caps text-xs tracking-[.08em]">{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-white/5 bg-surface px-4 md:px-6">
            <div className="flex items-center gap-4"><h2 className="font-headline-sm text-lg font-bold text-on-surface">Map & Search Area</h2><div className="flex items-center gap-2 rounded-full border border-white/10 bg-surface-container-high px-3 py-1"><Icon className="text-[16px] text-secondary">emergency</Icon><span className="font-data-md text-sm text-secondary">SAR-2026-041</span><span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-error" /><span className="font-label-caps text-xs text-error">Active</span></div></div>
            <div className="flex items-center gap-3"><button className="relative text-on-surface-variant hover:text-primary"><Icon>notifications</Icon><span className="absolute right-0 top-0 h-2 w-2 rounded-full border border-surface bg-error" /></button><div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-primary/30 bg-surface-variant"><Icon className="text-on-surface-variant">person</Icon></div></div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            <section className="relative min-h-[520px] flex-1 overflow-hidden bg-surface-container-low">
              <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(#32353c_1px,transparent_1px)] [background-size:24px_24px]" />
              <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_35%,rgba(74,217,232,.08)_35%,rgba(74,217,232,.08)_36%,transparent_36%,transparent_64%,rgba(199,191,255,.08)_64%,rgba(199,191,255,.08)_65%,transparent_65%)]" />
              <div className="map-overlay pointer-events-none absolute inset-0" />
              <div className="absolute left-4 top-4 flex flex-wrap gap-3 md:left-6 md:top-6"><Info icon="my_location" label="UAV Pos" value="45.892N, 7.341E" variant="secondary" /><Info icon="radar" label="Active Sector" value="C-4 (Alpine Ridge)" variant="primary" /></div>
              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"><div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full border-2 border-secondary/50"><Icon className="rotate-45 text-secondary">navigation</Icon></div><div className="mt-2 flex flex-col items-center rounded border border-white/10 bg-surface-container/90 px-2 py-1"><span className="font-data-md text-sm text-secondary">EGL-01</span><span className="font-label-caps text-xs text-on-surface-variant">ALT: 450m</span></div></div>
              <div className="absolute bottom-6 left-6 rounded-lg border border-white/10 bg-surface-container/90 p-3 backdrop-blur-sm"><p className="font-label-caps text-[10px] text-on-surface-variant">MAP LAYER</p><p className="data-font mt-1 text-xs text-on-surface">TOPOGRAPHIC · SECTOR GRID</p></div>
            </section>

            <aside className="z-30 flex w-full shrink-0 flex-col border-l border-white/10 bg-surface-container lg:w-96">
              <div className="flex-1 space-y-6 overflow-y-auto p-6"><section><h3 className="mb-4 flex items-center gap-2 font-headline-sm text-lg text-on-surface"><Icon>route</Icon>Active Waypoints</h3><div className="space-y-3"><Waypoint no="1" title="Alpha Ridge Base" meta="Cleared - 14:02" icon="check_circle" done /><Waypoint no="2" title="Sector C-4 Center" meta="En Route - ETA 2m" icon="sync" active /><Waypoint no="3" title="Ravine Echo" meta="Pending" icon="schedule" faded /></div></section><section><h3 className="mb-4 flex items-center gap-2 font-headline-sm text-lg text-on-surface"><Icon>analytics</Icon>Environment</h3><div className="grid grid-cols-2 gap-3">{[['Wind SPD', '14 m/s'], ['Visibility', '12 km'], ['Temp', '-4 °C'], ['Signal', '98%']].map(([label, value]) => <div className="rounded-lg border border-white/5 bg-surface-container-low p-3" key={label}><p className="mb-1 font-label-caps text-xs text-on-surface-variant">{label}</p><p className={`font-data-lg text-lg ${label === 'Temp' ? 'text-secondary' : 'text-on-surface'}`}>{value}</p></div>)}</div></section></div>
            </aside>
          </div>

          <footer className="z-40 flex h-8 shrink-0 items-center justify-between border-t border-white/5 bg-surface-container-lowest px-4"><div className="flex gap-3 md:gap-6"><Status color="bg-secondary-fixed" label="Receiver: OK" /><Status color="bg-secondary-fixed" label="Telemetry: LNK" /><Status color="bg-primary" label="AI: RDY" /></div><span className="font-label-caps text-[10px] text-on-surface-variant opacity-50">v4.2.0-PRO</span></footer>
        </main>
      </div>
    </div>
  )
}

function Info({ icon, label, value, variant }) {
  const styles = variant === 'secondary' ? 'border-secondary/30 text-secondary' : 'border-primary/30 text-primary'
  return <div className={`flex items-center gap-3 rounded-lg border bg-surface-container/90 px-4 py-2 backdrop-blur-sm ${styles}`}><Icon>{icon}</Icon><div><p className="font-label-caps text-xs text-on-surface-variant">{label}</p><p className="font-data-md text-sm">{value}</p></div></div>
}

function Waypoint({ no, title, meta, icon, active, done, faded }) {
  return <div className={`flex items-center gap-4 rounded-lg border p-4 ${active ? 'border-primary/30 bg-primary/5' : 'border-white/5 bg-surface-container-low'} ${faded ? 'opacity-50' : ''}`}><div className={`flex h-8 w-8 items-center justify-center rounded-full font-data-md text-sm ${active ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface'}`}>{no}</div><div className="flex-1"><p className={`font-body-sm text-sm ${active ? 'text-primary' : 'text-on-surface'}`}>{title}</p><p className="font-data-md text-sm text-on-surface-variant">{meta}</p></div><Icon className={done ? 'text-green-400' : active ? 'animate-spin text-primary' : 'text-on-surface-variant'}>{icon}</Icon></div>
}

function Status({ color, label }) {
  return <span className="data-font flex items-center gap-1 text-[11px] text-outline"><span className={`h-1.5 w-1.5 rounded-full ${color}`} />{label}</span>
}

export default MapArea
