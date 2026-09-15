import { useEffect, useState } from 'react'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

export default function Settings({ telemetryState }) {
  const [laptopBattery, setLaptopBattery] = useState(null)
  const {
    connectionStatus = 'disconnected',
    connectionType = 'none',
    deviceInfo,
    serialDevices = [],
    telemetry = {},
  } = telemetryState || {}
  const isLive = connectionStatus === 'connected'
  const deviceName = connectionType === 'betaflight'
    ? `${deviceInfo?.name || 'Betaflight FC'}${deviceInfo?.version ? ` ${deviceInfo.version}` : ''}`
    : connectionType === 'serial'
      ? `MAVLink FC · SYS ${telemetry.sysId || '-'} / COMP ${telemetry.compId || '-'}`
    : connectionType === 'crsf'
      ? `ELRS / CRSF Serial${deviceInfo?.baudRate ? ` · ${deviceInfo.baudRate}` : ''}`
      : connectionType === 'websocket'
        ? 'MAVLink WebSocket'
        : connectionType === 'simulation'
          ? 'Simulation'
           : 'No device connected'

  useEffect(() => {
    if (!navigator.getBattery) return undefined

    let battery
    const updateBattery = () => setLaptopBattery({ level: Math.round(battery.level * 100), charging: battery.charging })
    navigator.getBattery().then((result) => {
      battery = result
      updateBattery()
      battery.addEventListener('levelchange', updateBattery)
      battery.addEventListener('chargingchange', updateBattery)
    })

    return () => {
      battery?.removeEventListener('levelchange', updateBattery)
      battery?.removeEventListener('chargingchange', updateBattery)
    }
  }, [])

  return (
    <main className="ml-[72px] flex min-h-screen flex-1 flex-col bg-[#f5f7fa] text-[#0f172a]">
      <header className="flex h-16 shrink-0 items-center border-b border-[#eef2f6] bg-white px-6">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">System Settings</h2>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-4 lg:grid-rows-2">
        <section className="bento-card p-5 lg:col-span-3">
          <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-bold text-slate-900">
            <Icon className="text-slate-500">tune</Icon>
            Flight & Interface Preferences
          </h3>
          <div>
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-500">Theme Mode</label>
              <div className="flex gap-2">
                <button className="w-1/2 rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white shadow-sm"><Icon className="mr-1 align-middle text-[16px]">light_mode</Icon>Light White</button>
              </div>
            </div>
          </div>
        </section>

        <section className="bento-card p-5 lg:col-span-1 lg:row-span-2">
          <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-bold text-slate-900">
            <Icon className="text-slate-500">memory</Icon>
            Hardware Health
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bento-subcard col-span-2 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-400">Live Connection</span>
                  <span className={`block text-sm font-bold ${isLive ? 'text-emerald-600' : 'text-slate-500'}`}>{deviceName}</span>
                  <span className="data-font mt-1 block truncate text-[11px] text-slate-500">
                    {isLive
                      ? `${connectionType.toUpperCase()} • ${telemetry.packetCount || 0} packets • ${telemetry.gpsFix || 'Waiting telemetry'}`
                      : 'Waiting for flight controller connection'}
                  </span>
                </div>
                <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${isLive ? 'bg-emerald-600 text-white' : 'bg-slate-500 text-white'}`}>
                  {isLive ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
            </div>
            <div className="bento-subcard col-span-2 p-3">
              <span className="mb-2 block text-[11px] font-semibold text-slate-400">Detected Serial Devices</span>
              {serialDevices.length ? serialDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="data-font truncate font-bold text-slate-700">
                    USB {device.usbVendorId?.toString(16).padStart(4, '0').toUpperCase() || '----'}:{device.usbProductId?.toString(16).padStart(4, '0').toUpperCase() || '----'}
                  </span>
                  <span className={`shrink-0 font-bold ${device.connected ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {device.connected ? 'CONNECTED' : 'AVAILABLE'}
                  </span>
                </div>
              )) : <span className="text-xs text-slate-500">No permitted serial device detected</span>}
            </div>
          </div>
        </section>

        <section className="bento-card p-5 lg:col-span-3">
          <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-bold text-slate-900">
            <Icon className="text-slate-500">shield</Icon>
            Battery & Telemetry
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bento-subcard flex items-center justify-between p-4 text-xs">
               <span className="font-medium text-slate-600">Laptop Battery</span>
               <span className={`data-font font-bold ${laptopBattery?.level <= 20 ? 'text-red-600' : 'text-slate-900'}`}>
                 {laptopBattery ? `${laptopBattery.level}%${laptopBattery.charging ? ' · Charging' : ''}` : '--'}
               </span>
            </div>
            <div className="bento-subcard flex items-center justify-between p-4 text-xs">
              <span className="font-medium text-slate-600">Telemetry Encryption</span>
              <span className="data-font font-bold text-emerald-600">AES-256 GCM</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
