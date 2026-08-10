function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

const missions = [
  ['OP-4922', 'Oct 24, 2026', '02:14:33', '18.4 km', '120m', 'Success'],
  ['OP-4921', 'Oct 22, 2026', '01:45:10', '12.1 km', '115m', 'Success'],
  ['OP-4920', 'Oct 19, 2026', '00:54:12', '6.8 km', '90m', 'Aborted'],
  ['OP-4919', 'Oct 15, 2026', '03:10:05', '24.2 km', '140m', 'Success'],
]

export default function FlightHistory() {
  return (
    <main className="ml-[72px] flex-1 flex flex-col min-h-screen bg-[#f5f7fa] text-[#0f172a]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#eef2f6] bg-white px-6">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Flight History & Logs</h2>
      </header>

      <div className="flex-1 p-6 max-w-[1400px] flex flex-col gap-6">
          <div className="bento-card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Mission Logs</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search mission ID..."
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fafc] text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Mission ID</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3">Distance</th>
                    <th className="px-5 py-3">Max Altitude</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {missions.map(([id, date, duration, dist, alt, status]) => (
                    <tr key={id} className="hover:bg-slate-50 transition">
                      <td className="data-font font-bold px-5 py-3.5 text-slate-900">{id}</td>
                      <td className="px-5 py-3.5 text-slate-600">{date}</td>
                      <td className="data-font px-5 py-3.5 text-slate-600">{duration}</td>
                      <td className="data-font px-5 py-3.5 text-slate-600">{dist}</td>
                      <td className="data-font px-5 py-3.5 text-slate-600">{alt}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          status === 'Success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                          <Icon className="text-[14px]">
                            {status === 'Success' ? 'check_circle' : 'cancel'}
                          </Icon>
                          {status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    )
}
