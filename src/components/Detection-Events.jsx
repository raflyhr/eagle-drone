function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

const events = [
  {
    id: 'EVT-9428-A',
    confidence: '94% CONF',
    sector: 'SEC-4 Alpha',
    eta: '00:02:14',
    status: 'CRITICAL',
    statusIcon: 'warning',
    statusClass: 'border-slate-800 bg-slate-900 text-white',
    tags: ['THERMAL', 'STATIONARY'],
  },
  {
    id: 'EVT-9427-B',
    confidence: '78% CONF',
    sector: 'SEC-4 Bravo',
    eta: '00:15:42',
    status: 'REVIEW',
    statusIcon: 'visibility',
    statusClass: 'border-slate-300 bg-slate-100 text-slate-800',
    tags: ['IR/NIR', 'MOVEMENT: LOW'],
  },
  {
    id: 'EVT-9426-C',
    confidence: '42% CONF',
    sector: 'SEC-3 Delta',
    eta: '00:42:10',
    status: 'LOW CONF',
    statusIcon: 'info',
    statusClass: 'border-slate-200 bg-slate-100 text-slate-600',
    tags: ['OPTICAL', 'PATTERN MATCH'],
  },
]

export default function DetectionEvents() {
  return (
    <main className="ml-[72px] flex-1 flex flex-col min-h-screen bg-[#f5f7fa] text-[#0f172a]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#eef2f6] bg-white px-6">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Detection Events</h2>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <Icon className="text-[16px]">filter_list</Icon>
            <span>Filter</span>
          </button>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-[1400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((evt) => (
              <div key={evt.id} className="bento-card overflow-hidden flex flex-col">
                <div className="relative h-44 bg-slate-900 overflow-hidden">
                  <img
                    src="/assets/forest_viewfinder.jpg"
                    alt={evt.id}
                    className="h-full w-full object-cover filter brightness-90"
                  />
                  <span className={`absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold ${evt.statusClass}`}>
                    <Icon className="text-[14px]">{evt.statusIcon}</Icon>
                    {evt.status}
                  </span>
                  <div className="absolute right-3 top-3 rounded-lg bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {evt.confidence}
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-3 flex-1 justify-between">
                  <div className="flex items-center justify-between">
                    <span className="data-font text-base font-bold text-slate-900">{evt.id}</span>
                    <span className="text-xs font-medium text-slate-500">{evt.sector}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {evt.tags.map((tag) => (
                      <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">T-Minus: {evt.eta}</span>
                    <button className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 transition">
                      Inspect
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    )
}
