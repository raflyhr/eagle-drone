import logoUrl from '../assets/logo-eagle.png'
const mapUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAyKw-SlJLPK5V1kyhZYg5VZNESohy1nb_CGeTkegBn5Znl_neLEYhvXYczAr60mfkRGG47EDRByoptidJ5gw1IoyHSiEbICF30VC2Idy3K0A2dCiHyprwpqEWBYye_nS5-ynxfc7IHg9UosZMX2m38bPP-UfshPCQIiwqMwtYQ8NbvjYvNBpb6W0sA48SmINXAHDMtK2JM0afsNq_0LRyehHGr1Vyf9tVBsgrjwK85GsmynYCrRFj3Zg'

const navigationItems = [
  ['dashboard', 'Mission Overview', 'mission'],
  ['map', 'Map & Search Area', 'map'],
  ['target', 'Detection Events', 'events'],
  ['history', 'Flight History', 'history'],
  ['settings', 'System Settings', 'settings'],
]

const missions = [
  ['OP-4922', 'Oct 24, 2023', '02:14:33', '18.4 km', '120m', 'C. Vance', 'Success'],
  ['OP-4921', 'Oct 22, 2023', '01:45:10', '12.1 km', '115m', 'A. Chen', 'Aborted'],
]

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function FlightHistory({ onNavigate }) {
  return (
    <div className="flex h-screen justify-center overflow-hidden bg-[#0b0e14] text-[#e1e2eb]">
      <div className="relative flex h-full w-full overflow-hidden bg-surface-container-lowest">
        <aside className="z-50 hidden h-full w-64 shrink-0 flex-col border-r border-white/10 bg-surface-container py-5 md:flex">
          <div className="mb-8 flex items-center gap-3 px-6">
            <img alt="Eagle Drone Logo" className="h-10 w-24 rounded-md object-contain" src={logoUrl} />
            <div><h1 className="font-headline-md text-2xl font-bold tracking-tight text-primary">Eagle Drone</h1><p className="font-body-sm text-sm text-on-surface-variant">SAR Command Unit</p></div>
          </div>
          <nav className="flex-1 space-y-2 px-4">
            {navigationItems.map(([icon, label, page]) => (
              <button key={label} onClick={() => page && onNavigate(page)} className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition ${page === 'history' ? 'border-r-2 border-primary bg-primary/5 font-bold text-primary' : 'font-medium text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'}`}>
                <Icon className={page === 'history' ? '[font-variation-settings:"FILL"_1]' : ''}>{icon}</Icon>
                <span className="font-label-caps text-xs tracking-[.08em]">{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-40 flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-surface px-4 md:px-6">
            <div className="flex items-center gap-4"><h2 className="font-headline-sm text-lg font-bold text-on-surface">Flight History</h2><div className="flex items-center gap-2 rounded-full border border-white/10 bg-surface-container-high px-3 py-1"><Icon className="text-[16px] text-secondary">emergency</Icon><span className="font-data-md text-sm text-secondary">SAR-2026-041</span><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" /><span className="font-label-caps text-xs text-error">Active</span></div></div>
            <div className="flex items-center gap-3"><button className="relative text-on-surface-variant hover:text-primary"><Icon>notifications</Icon><span className="absolute right-0 top-0 h-2 w-2 rounded-full border border-surface bg-error" /></button><div className="grid h-8 w-8 place-items-center rounded-full border border-primary/30 bg-surface-variant"><Icon className="text-on-surface-variant">person</Icon></div></div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 pb-6 md:p-6">
            <div className="grid min-h-[600px] grid-cols-12 gap-4">
              <section className="col-span-12 flex flex-col gap-4 lg:col-span-8">
                <div className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
                  <h2 className="font-headline-md text-2xl text-on-surface">Mission Archives</h2>
                  <div className="flex flex-wrap gap-2"><label className="relative"><Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">search</Icon><input className="w-64 rounded border border-white/10 bg-surface-container/50 py-2 pl-9 pr-3 font-body-sm text-sm text-on-surface outline-none transition-colors focus:border-primary" placeholder="Search Missions..." /></label><button className="flex items-center gap-2 rounded border border-white/10 px-3 py-2 font-body-sm text-sm text-on-surface-variant hover:bg-surface-variant"><Icon className="text-sm">filter_list</Icon>Filter</button></div>
                </div>

                <div className="glass-panel flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl">
                  <div className="grid grid-cols-[1.05fr_1.35fr_1.1fr_1.05fr_.85fr_1fr_1.25fr] gap-3 border-b border-white/10 bg-surface-container/50 px-5 py-4 font-label-caps text-[10px] text-on-surface-variant"><div>Mission ID</div><div>Date</div><div>Duration</div><div>Distance</div><div>Max Alt</div><div>Pilot</div><div className="text-right">Status</div></div>
                  <div className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden py-4">
                    {missions.map((mission, index) => <MissionRow key={mission[0]} mission={mission} selected={index === 0} />)}
                  </div>
                </div>
              </section>

              <aside className="col-span-12 flex flex-col gap-4 lg:col-span-4">
                <div className="glass-panel flex flex-1 flex-col overflow-hidden rounded-2xl">
                  <div className="flex items-center justify-between border-b border-white/10 bg-surface-container/50 p-4"><h3 className="flex items-center gap-2 font-headline-sm text-lg font-semibold"><Icon className="text-primary">route</Icon>Mission Details</h3><span className="data-font rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-sm text-primary">OP-4922</span></div>
                  <div className="relative h-48 shrink-0 border-b border-white/10 bg-cover bg-center" style={{ backgroundImage: `url('${mapUrl}')` }}><div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] to-transparent opacity-80" /><div className="absolute right-2 top-2 rounded border border-white/5 bg-surface/80 px-2 py-1 font-label-caps text-[10px] text-on-surface-variant backdrop-blur">TOPOGRAPHIC MAP DATA</div></div>
                  <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"><div className="grid grid-cols-2 gap-3"><Summary label="Area Searched" value="4.2" unit="km²" /><Summary label="Detections" value="3" unit="Confirmed" accent /></div><div className="rounded-2xl border border-white/5 bg-surface-container/30 p-4"><h4 className="mb-3 border-b border-white/10 pb-2 font-label-caps text-xs text-on-surface-variant">TELEMETRY SUMMARY</h4><Telemetry icon="speed" label="Top Speed" value="22 m/s" /><Telemetry icon="thermostat" label="Avg Temp" value="34°C" /></div><div className="mt-auto flex gap-3 pt-4"><ExportButton icon="picture_as_pdf" label="PDF Report" /><ExportButton icon="csv" label="Telemetry CSV" /></div></div>
                </div>
              </aside>
            </div>
          </div>

          <footer className="z-40 flex h-8 shrink-0 items-center justify-between border-t border-white/5 bg-surface-container-lowest px-4"><div className="flex gap-3 md:gap-6"><Status color="bg-secondary-fixed" label="Receiver: OK" /><Status color="bg-secondary-fixed" label="Telemetry: LNK" /><Status color="bg-primary" label="AI: RDY" /></div><span className="font-label-caps text-[10px] text-on-surface-variant opacity-50">v4.2.0-PRO</span></footer>
        </main>
      </div>
    </div>
  )
}

function MissionRow({ mission, selected }) {
  const [id, date, duration, distance, altitude, pilot, status] = mission
  const success = status === 'Success'
  return <div className={`grid grid-cols-[1.05fr_1.35fr_1.1fr_1.05fr_.85fr_1fr_1.25fr] items-center gap-3 rounded-lg border px-5 py-3 transition-colors hover:bg-surface-variant ${selected ? 'border-primary/30 bg-primary/5' : 'border-white/5 bg-surface-container-high'}`}><div className={`min-w-0 data-font text-[13px] ${selected ? 'text-primary' : 'text-on-surface'}`}>{id}</div><div className="min-w-0 text-xs">{date}</div><div className="min-w-0 data-font text-[13px]">{duration}</div><div className="min-w-0 data-font text-[13px]">{distance}</div><div className="min-w-0 data-font text-[13px]">{altitude}</div><div className="min-w-0 truncate text-xs text-on-surface-variant">{pilot}</div><div className="min-w-0 justify-self-end"><span className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-label-caps text-[10px] uppercase whitespace-nowrap ${success ? 'border-secondary/30 bg-secondary/10 text-secondary' : 'border-error/30 bg-error/10 text-error'}`}><Icon className="text-[14px]">{success ? 'check_circle' : 'warning'}</Icon>{status}</span></div></div>
}

function Summary({ label, value, unit, accent }) {
  return <div className={`flex flex-col items-center rounded-lg border p-3 text-center ${accent ? 'border-secondary/30 bg-secondary/5' : 'border-white/5 bg-surface-container/30'}`}><p className={`mb-1 font-label-caps text-[10px] ${accent ? 'text-secondary' : 'text-on-surface-variant'}`}>{label}</p><p className="data-font text-lg">{value} <span className="text-xs text-on-surface-variant">{unit}</span></p></div>
}
function Telemetry({ icon, label, value }) { return <div className="flex items-center justify-between rounded p-2 text-sm hover:bg-surface-variant"><span className="flex items-center gap-2 text-xs text-on-surface-variant"><Icon className="text-[16px]">{icon}</Icon>{label}</span><span className="data-font text-[13px]">{value}</span></div> }
function ExportButton({ icon, label }) { return <button className="flex flex-1 items-center justify-center gap-2 rounded-md border border-white/10 bg-surface-container py-2.5 font-label-caps text-[11px] hover:bg-surface-variant"><Icon className="text-[16px]">{icon}</Icon>{label}</button> }
function Status({ color, label }) { return <span className="data-font flex items-center gap-1 text-[11px] text-outline"><span className={`h-1.5 w-1.5 rounded-full ${color}`} />{label}</span> }

export default FlightHistory
