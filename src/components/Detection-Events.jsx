import logoUrl from '../assets/logo-eagle.png'

const eventImages = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB590MnQLzhs_4-Re_LZ4zqVSwNoDTd46uxi8W_6ahf9pRDw_FyNaBPKaGn9yeydnGC-BZ84KlzViPlSg_YPuHuDJYzokO0P7TjaRmnd6tVCzXxEr7J0E97UW41QA4yqG3_Lafxs_po5vi66_e4uw2WQTpgulT5HPkiBwc4aPvlYZl9wruJP2xbP_ZTcEdPecgI7YidphxXEdh1sw00I7XrOuGkIBkcK6IeinA78U15ehVXMGrCFE7_Xw',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDMhj7p5fSSbkbzA0l_aOoDNXHjWfoLUWZ1g80577zDYTzLrgbFxiLzZ7HO4ZO_tRRhUCQ_M7KgRCJJAhIEMPWTzvwk89tn5QtcYzP9FBrMQx689QZWUuIgijmO8SWUryrJ2bskJbOqH1uXJaxw022Z5MCGJxbZQgkAJhxpSHj9ngA3sIrsb0Pzz3N-NxC_75skoq6BldabT6AQGDU3MM_4W1A8copxChBCtDUH1xCqh842vtd5tMqgMw',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAqhUoSYu2IHqaxk0eVe_HrE1cUkcuuW6A1626xeo71ZBLhMS3y8ONbwxj1uVrB5MFKn5fP2eYorhn1CiScli5ORCqMYHDQ-q1bYR3fvp8QCPIlO_uyDHCfon4JNcokEewKNtrCNl0Wgeu2fvPgLx5tzkWuMZG54ql_2vjGSfYW271aZLKAci1bxujkxk0wcGlmG_ptjkvjGJ7u7aBer9DzhXa--Z9f1uYW0m8kEdY5oOSbIZOPOwqFhw',
]

const navigationItems = [
  ['dashboard', 'Mission Overview', 'mission'],
  ['map', 'Map & Search Area', 'map'],
  ['target', 'Detection Events', 'events'],
  ['history', 'Flight History', 'history'],
  ['settings', 'System Settings', 'settings'],
]

const events = [
  {
    id: 'EVT-9428-A',
    confidence: '94% CONF',
    sector: 'SEC-4 Alpha',
    eta: '00:02:14',
    status: 'CRITICAL',
    statusIcon: 'warning',
    statusClass: 'border-error/50 bg-error/90 text-on-error-container',
    accentText: 'text-primary',
    confidenceText: 'text-secondary',
    imageClass: 'opacity-80',
    tags: [
      'text-tertiary border-tertiary/30 bg-tertiary/10|THERMAL',
      'text-secondary border-secondary/30 bg-secondary/10|STATIONARY',
    ],
  },
  {
    id: 'EVT-9427-B',
    confidence: '78% CONF',
    sector: 'SEC-4 Bravo',
    eta: '00:15:42',
    status: 'REVIEW',
    statusIcon: 'visibility',
    statusClass: 'border-tertiary/50 bg-tertiary/90 text-on-tertiary-container',
    accentText: 'text-on-surface',
    confidenceText: 'text-tertiary',
    imageClass: 'grayscale opacity-70',
    tags: [
      'text-outline border-outline/30 bg-outline/10|IR/NIR',
      'text-tertiary border-tertiary/30 bg-tertiary/10|MOVEMENT: LOW',
    ],
  },
  {
    id: 'EVT-9426-C',
    confidence: '42% CONF',
    sector: 'SEC-3 Delta',
    eta: '00:42:10',
    accentText: 'text-on-surface-variant',
    confidenceText: 'text-on-surface-variant',
    imageClass: 'grayscale opacity-50',
    cardClass: 'opacity-60',
    tags: [
      'text-outline border-outline/30 bg-outline/10|OPTICAL',
      'text-outline border-outline/30 bg-outline/10|PATTERN MATCH',
    ],
  },
]

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function DetectionEvents({ onNavigate }) {
  return (
    <div className="flex h-screen justify-center overflow-hidden bg-[#0b0e14] text-[#e1e2eb]">
      <div className="relative flex h-full w-full overflow-hidden bg-surface-container-lowest">
        <aside className="z-50 hidden h-full w-64 shrink-0 flex-col border-r border-white/10 bg-surface-container py-5 md:flex">
          <div className="mb-8 flex items-center gap-3 px-6">
            <img alt="Eagle Drone Logo" className="h-10 w-24 rounded-md object-contain" src={logoUrl} />
            <div>
              <h1 className="font-headline-md text-2xl font-bold tracking-tight text-primary">Eagle Drone</h1>
              <p className="font-body-sm text-sm text-on-surface-variant">SAR Command Unit</p>
            </div>
          </div>

          <nav className="flex-1 space-y-2 px-4">
            {navigationItems.map(([icon, label, page]) => (
              <button
                key={label}
                onClick={() => page && onNavigate(page)}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition ${page === 'events' ? 'border-r-2 border-primary bg-primary/5 font-bold text-primary' : 'font-medium text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'}`}
              >
                <Icon className={page === 'events' ? '[font-variation-settings:"FILL"_1]' : ''}>{icon}</Icon>
                <span className="font-label-caps text-xs tracking-[.08em]">{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-40 flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-surface px-4 md:px-6">
            <div className="flex items-center gap-4">
              <h2 className="font-headline-sm text-lg font-bold text-on-surface">Detection Events</h2>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-surface-container-high px-3 py-1">
                <Icon className="text-[16px] text-secondary">emergency</Icon>
                <span className="font-data-md text-sm text-secondary">SAR-2026-041</span>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" />
                <span className="font-label-caps text-xs text-error">Active</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="relative text-on-surface-variant hover:text-primary">
                <Icon>notifications</Icon>
                <span className="absolute right-0 top-0 h-2 w-2 rounded-full border border-surface bg-error" />
              </button>
              <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-primary/30 bg-surface-variant">
                <Icon className="text-on-surface-variant">person</Icon>
              </div>
            </div>
          </header>

          <div className="grid-bg flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-container-lowest lg:flex-row">
            <section className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-headline-sm text-lg text-on-surface">Detection Alerts</h2>
                  <p className="font-body-sm text-sm text-on-surface-variant">Showing active high-confidence anomalies in Sector 4.</p>
                </div>

                <div className="flex gap-2">
                  <button className="flex items-center gap-2 rounded border border-white/10 bg-surface-container px-4 py-2 font-label-caps text-xs hover:bg-surface-variant">
                    <Icon className="text-[16px]">filter_list</Icon>
                    Filter
                  </button>
                  <button className="flex items-center gap-2 rounded border border-white/10 bg-surface-container px-4 py-2 font-label-caps text-xs hover:bg-surface-variant">
                    <Icon className="text-[16px]">sort</Icon>
                    Time (Desc)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {events.map((event, index) => (
                  <EventCard key={event.id} event={event} image={eventImages[index]} selected={index === 0} />
                ))}
              </div>
            </section>

            <DetailPanel image={eventImages[0]} />
          </div>

          <Footer />
        </main>
      </div>
    </div>
  )
}

function EventCard({ event, image, selected }) {
  return (
    <article className={`event-card relative cursor-pointer overflow-hidden rounded-xl border bg-surface-container transition-all ${selected ? 'border-2 border-primary' : 'border-white/10'} ${event.cardClass || ''}`}>
      <div className="relative h-32 bg-surface-variant">
        <img alt={event.id} className={`h-full w-full object-cover ${event.imageClass}`} src={image} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-secondary">
            <span className="h-1 w-1 rounded-full bg-secondary" />
          </div>
        </div>

        {event.status && (
          <span className={`absolute left-2 top-2 z-10 flex items-center gap-1 rounded border px-2 py-1 font-label-caps text-xs backdrop-blur-sm ${event.statusClass}`}>
            <Icon className="text-[14px]">{event.statusIcon}</Icon>
            {event.status}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <span className={`font-data-md font-bold ${event.accentText}`}>{event.id}</span>
          <span className={`font-data-md ${event.confidenceText}`}>{event.confidence}</span>
        </div>

        <div className="mb-3 flex items-center justify-between text-on-surface-variant">
          <span className="font-body-sm text-sm">T-Minus: {event.eta}</span>
          <span className="rounded border border-white/5 bg-surface px-2 py-0.5 font-data-md text-xs">{event.sector}</span>
        </div>

        <div className="flex gap-2">
          {event.tags.map((tag) => {
            const [classes, label] = tag.split('|')
            return <span key={label} className={`rounded px-2 py-1 font-label-caps text-[10px] ${classes}`}>{label}</span>
          })}
        </div>
      </div>
    </article>
  )
}

function DetailPanel({ image }) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-l border-white/10 bg-surface-container lg:w-96">
      <div className="flex items-center justify-between border-b border-white/10 p-5">
        <div>
          <div className="mb-1 font-label-caps text-xs text-secondary">EVENT DETAILS</div>
          <h3 className="font-headline-sm text-lg font-bold text-primary">EVT-9428-A</h3>
        </div>
        <button className="text-on-surface-variant hover:text-white"><Icon>close</Icon></button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <div className="relative overflow-hidden rounded-lg border border-white/10">
          <img alt="Detail Thermal view" className="h-48 w-full object-cover" src={image} />
          <div className="absolute bottom-2 right-2 rounded border border-white/10 bg-surface/80 px-2 py-1 font-data-md text-[10px] text-secondary backdrop-blur">REC 4K IR</div>
        </div>

        <InfoSection title="TARGET TELEMETRY">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['ALTITUDE (MSL)', '1,420m'],
              ['SPEED', '0.0 m/s'],
              ['BEARING', '042° NE'],
              ['COORDINATES', '34.0522°N, 118.2437°W'],
            ].map(([label, value]) => <DataBox key={label} label={label} value={value} />)}
          </div>
        </InfoSection>

      </div>

    </aside>
  )
}

function InfoSection({ title, children }) {
  return (
    <section>
      <h4 className="mb-3 border-b border-white/5 pb-1 font-label-caps text-xs text-on-surface-variant">{title}</h4>
      {children}
    </section>
  )
}

function DataBox({ label, value }) {
  return (
    <div className="rounded border border-secondary/20 bg-surface p-2">
      <div className="mb-1 font-label-caps text-[10px] text-secondary/70">{label}</div>
      <div className="truncate font-data-md text-sm text-on-surface">{value}</div>
    </div>
  )
}

function Footer() {
  return (
    <footer className="z-40 flex h-8 shrink-0 items-center justify-between border-t border-white/5 bg-surface-container-lowest px-4">
      <div className="flex gap-3 md:gap-6">
        <Status color="bg-secondary-fixed" label="Receiver: OK" />
        <Status color="bg-secondary-fixed" label="Telemetry: LNK" />
        <Status color="bg-primary" label="AI: RDY" />
      </div>
      <span className="font-label-caps text-[10px] text-on-surface-variant opacity-50">v4.2.0-PRO</span>
    </footer>
  )
}

function Status({ color, label }) {
  return <span className="data-font flex items-center gap-1 text-[11px] text-outline"><span className={`h-1.5 w-1.5 rounded-full ${color}`} />{label}</span>
}

export default DetectionEvents
