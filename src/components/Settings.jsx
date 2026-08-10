function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

export default function Settings() {
  return (
    <main className="ml-[72px] flex-1 flex flex-col min-h-screen bg-[#f5f7fa] text-[#0f172a]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#eef2f6] bg-white px-6">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">System Settings</h2>
      </header>

      <div className="flex-1 p-6 max-w-[1000px] flex flex-col gap-6">
          {/* General Preferences */}
          <div className="bento-card p-6">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Icon className="text-slate-500">tune</Icon>
              Flight & Interface Preferences
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Measurement Unit</label>
                <div className="flex gap-2">
                  <button className="flex-1 rounded-lg bg-slate-900 text-white py-2 text-xs font-semibold shadow-sm">
                    Metric (m/s, m)
                  </button>
                  <button className="flex-1 rounded-lg border border-slate-200 bg-white text-slate-700 py-2 text-xs font-semibold hover:bg-slate-50">
                    Imperial (ft/s, ft)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Theme Mode</label>
                <div className="flex gap-2">
                  <button className="flex-1 rounded-lg bg-slate-900 text-white py-2 text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5">
                    <Icon className="text-[16px]">light_mode</Icon>
                    Light White
                  </button>
                  <button className="flex-1 rounded-lg border border-slate-200 bg-white text-slate-700 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5">
                    <Icon className="text-[16px]">dark_mode</Icon>
                    Dark (HUD)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Drone Hardware Status */}
          <div className="bento-card p-6">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Icon className="text-slate-500">memory</Icon>
              Hardware & Motor Health
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {['M1 (Front L): 99%', 'M2 (Front R): 98%', 'M3 (Rear L): 99%', 'M4 (Rear R): 97%'].map((motor) => (
                <div key={motor} className="bento-subcard p-3 text-center">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Motor Status</span>
                  <span className="data-font text-xs font-bold text-emerald-600">{motor}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between py-2.5 border-t border-slate-100 text-xs">
              <span className="font-medium text-slate-600">Battery Cycles</span>
              <span className="data-font font-bold text-slate-900">42 / 500</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-t border-slate-100 text-xs">
              <span className="font-medium text-slate-600">Telemetry Encryption</span>
              <span className="data-font font-bold text-emerald-600">AES-256 GCM</span>
            </div>
          </div>
        </div>
      </main>
    )
}
