import { useMemo, useState } from 'react'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function parseDistanceKm(distStr) {
  if (!distStr) return 0
  const num = parseFloat(distStr.toString().replace(/[^0-9.]/g, ''))
  return isNaN(num) ? 0 : num
}

function parseDurationSeconds(durStr) {
  if (!durStr) return 0
  const parts = durStr.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

function parseAltitudeMeters(altStr) {
  if (!altStr) return 0
  const num = parseFloat(altStr.toString().replace(/[^0-9.]/g, ''))
  return isNaN(num) ? 0 : num
}

function parseLogDate(dateStr) {
  if (!dateStr) return 0
  if (dateStr === 'LIVE' || dateStr.toLowerCase().includes('today')) return Date.now() + 1000000
  const timestamp = new Date(dateStr).getTime()
  return isNaN(timestamp) ? 0 : timestamp
}

export default function FlightHistory({ missionLogs = [], currentMission, onOpenMission, onNavigate, onClearLogs }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'grid'

  const allRawLogs = useMemo(() => {
    return currentMission ? [currentMission, ...missionLogs] : missionLogs
  }, [currentMission, missionLogs])

  // Extract unique mission types for filter dropdown
  const availableTypes = useMemo(() => {
    const types = new Set()
    allRawLogs.forEach((log) => {
      if (log.type) types.add(log.type)
    })
    return ['ALL', ...Array.from(types)]
  }, [allRawLogs])

  // Aggregate Metrics Summary
  const metrics = useMemo(() => {
    const totalMissions = allRawLogs.length
    let totalDistKm = 0
    let totalSecs = 0
    let successCount = 0

    allRawLogs.forEach((log) => {
      totalDistKm += parseDistanceKm(log.distance)
      totalSecs += parseDurationSeconds(log.duration)
      if (log.status === 'Success' || log.status === 'Simulation' || log.status === 'In Progress') successCount++
    })

    const totalHours = Math.floor(totalSecs / 3600)
    const remainingMins = Math.floor((totalSecs % 3600) / 60)
    const successRate = totalMissions > 0 ? Math.round((successCount / totalMissions) * 100) : 100

    return {
      totalMissions,
      totalDistance: `${totalDistKm.toFixed(1)} km`,
      totalFlightTime: `${totalHours}h ${remainingMins}m`,
      successRate: `${successRate}%`,
    }
  }, [allRawLogs])

  // Filtered and Sorted Logs
  const filteredLogs = useMemo(() => {
    let result = [...allRawLogs]

    // 1. Search Query Filter across multiple fields
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((log) => {
        return (
          (log.id && log.id.toLowerCase().includes(q)) ||
          (log.type && log.type.toLowerCase().includes(q)) ||
          (log.date && log.date.toLowerCase().includes(q)) ||
          (log.status && log.status.toLowerCase().includes(q)) ||
          (log.distance && log.distance.toLowerCase().includes(q)) ||
          (log.maxAltitude && log.maxAltitude.toLowerCase().includes(q))
        )
      })
    }

    // 2. Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter((log) => {
        if (statusFilter === 'Simulation') {
          return log.status === 'Simulation' || log.status === 'LIVE' || log.id === 'LIVE-MAVLINK'
        }
        return log.status === statusFilter
      })
    }

    // 3. Mission Type Filter
    if (typeFilter !== 'ALL') {
      result = result.filter((log) => log.type === typeFilter)
    }

    // 4. Sorting Logic
    result.sort((a, b) => {
      if (sortBy === 'duration-desc') {
        return parseDurationSeconds(b.duration) - parseDurationSeconds(a.duration)
      }
      if (sortBy === 'distance-desc') {
        return parseDistanceKm(b.distance) - parseDistanceKm(a.distance)
      }
      if (sortBy === 'altitude-desc') {
        return parseAltitudeMeters(b.maxAltitude) - parseAltitudeMeters(a.maxAltitude)
      }
      if (sortBy === 'oldest') {
        return parseLogDate(a.date) - parseLogDate(b.date)
      }
      // default: newest -> terlama
      return parseLogDate(b.date) - parseLogDate(a.date)
    })

    return result
  }, [allRawLogs, searchQuery, statusFilter, typeFilter, sortBy])

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'ALL' || typeFilter !== 'ALL' || sortBy !== 'newest'

  const handleResetFilters = () => {
    setSearchQuery('')
    setStatusFilter('ALL')
    setTypeFilter('ALL')
    setSortBy('newest')
  }

  return (
    <main className="ml-[72px] flex-1 flex flex-col min-h-screen bg-[#f5f7fa] text-[#0f172a]">
      {/* Top Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#eef2f6] bg-white px-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Flight History & Logs</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
            {allRawLogs.length} Real Logs
          </span>
        </div>

        <div className="flex items-center gap-3">
          {missionLogs.length > 0 && (
            <button
              type="button"
              onClick={onClearLogs}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition cursor-pointer shadow-xs"
              title="Clear all saved real mission logs"
            >
              <Icon className="text-[15px]">delete_sweep</Icon>
              <span>Clear Saved Logs</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Viewport Content */}
      <div className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto flex flex-col gap-5">
        {/* TOP SUMMARY METRICS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="bento-card p-4 flex items-center gap-3.5 bg-white border border-slate-200 shadow-xs rounded-xl">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-xs">
              <Icon className="text-[22px]">flight_takeoff</Icon>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Missions</span>
              <p className="text-lg font-extrabold text-slate-900 data-font truncate">{metrics.totalMissions}</p>
            </div>
          </div>

          <div className="bento-card p-4 flex items-center gap-3.5 bg-white border border-slate-200 shadow-xs rounded-xl">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Icon className="text-[22px]">schedule</Icon>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Flight Time</span>
              <p className="text-lg font-extrabold text-slate-900 data-font truncate">{metrics.totalFlightTime}</p>
            </div>
          </div>

          <div className="bento-card p-4 flex items-center gap-3.5 bg-white border border-slate-200 shadow-xs rounded-xl">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <Icon className="text-[22px]">route</Icon>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Distance</span>
              <p className="text-lg font-extrabold text-slate-900 data-font truncate">{metrics.totalDistance}</p>
            </div>
          </div>

          <div className="bento-card p-4 flex items-center gap-3.5 bg-white border border-slate-200 shadow-xs rounded-xl">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white shadow-xs">
              <Icon className="text-[22px]">verified</Icon>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Success Rate</span>
              <p className="text-lg font-extrabold text-slate-900 data-font truncate">{metrics.successRate}</p>
            </div>
          </div>
        </div>

        {/* LOGS TABLE CONTAINER */}
        <div className="bento-card overflow-hidden bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col min-h-[520px]">
          {/* SEARCH & MULTI-FILTER TOOLBAR */}
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Search Bar Input */}
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-500">search</Icon>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ID, Type, Date, Location..."
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 pl-9 pr-8 py-1.5 text-xs font-semibold text-slate-900 placeholder-slate-500 outline-none transition focus:border-slate-500 focus:bg-white focus:ring-2 focus:ring-slate-200"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    <Icon className="text-[15px]">close</Icon>
                  </button>
                )}
              </div>

              {/* Status Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5">
                <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value="Success">Success</option>
                  <option value="Aborted">Aborted</option>
                  <option value="Simulation">Simulation / Live</option>
                </select>
              </div>

              {/* Mission Type Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5">
                <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer"
                >
                  {availableTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === 'ALL' ? 'All Types' : type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By Selector Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5">
                <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer"
                >
                  <option value="newest">Terbaru → Terlama (Newest First)</option>
                  <option value="oldest">Terlama → Terbaru (Oldest First)</option>
                  <option value="duration-desc">Longest Duration</option>
                  <option value="distance-desc">Farthest Distance</option>
                  <option value="altitude-desc">Highest Altitude</option>
                </select>
              </div>

              {/* Reset Filters Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-300 transition cursor-pointer"
                  title="Reset all search and filter conditions"
                >
                  <Icon className="text-[14px]">restart_alt</Icon>
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Right Action Bar: Results Counter & View Mode Switcher */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-bold text-slate-600">
                Showing <strong className="text-slate-900">{filteredLogs.length}</strong> of {allRawLogs.length}
              </span>

              {/* View Mode Toggle Switcher */}
              <div className="flex items-center rounded-lg border border-slate-300 bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`flex h-7 w-7 items-center justify-center rounded-md transition cursor-pointer ${
                    viewMode === 'table' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Table View"
                >
                  <Icon className="text-[16px]">format_list_bulleted</Icon>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex h-7 w-7 items-center justify-center rounded-md transition cursor-pointer ${
                    viewMode === 'grid' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Grid Cards View"
                >
                  <Icon className="text-[16px]">grid_view</Icon>
                </button>
              </div>
            </div>
          </div>

          {/* RESULTS CONTENT VIEW */}
          {allRawLogs.length === 0 ? (
            /* REAL DATA EMPTY STATE FALLBACK */
            <div className="flex flex-1 flex-col items-center justify-center p-12 text-center bg-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-700 mb-3">
                <Icon className="text-[28px]">flight_land</Icon>
              </div>
              <h4 className="text-sm font-extrabold text-slate-900">No Real Flight Logs Recorded Yet</h4>
              <p className="mt-1 text-xs font-medium text-slate-600 max-w-md">
                All mock/dummy data has been removed. Real flight logs, telemetry coordinates, photo captures, and flight durations are automatically recorded when running MAVLink telemetry or simulation flights.
              </p>
              <button
                type="button"
                onClick={() => onNavigate?.('mission')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition cursor-pointer"
              >
                <Icon className="text-[15px]">sensors</Icon>
                <span>Go to Flight Viewfinder</span>
              </button>
            </div>
          ) : filteredLogs.length === 0 ? (
            /* FILTER EMPTY STATE FALLBACK */
            <div className="flex flex-1 flex-col items-center justify-center p-12 text-center bg-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-700 mb-3">
                <Icon className="text-[28px]">search_off</Icon>
              </div>
              <h4 className="text-sm font-extrabold text-slate-900">No Mission Logs Found</h4>
              <p className="mt-1 text-xs font-medium text-slate-600 max-w-sm">
                No flight logs matched your filter criteria. Try adjusting your search keyword or clearing the filters.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition cursor-pointer"
                >
                  <Icon className="text-[14px]">filter_alt_off</Icon>
                  <span>Clear All Filters</span>
                </button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            /* TABLE VIEW */
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-300 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3.5">Mission ID</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Mission Type</th>
                    <th className="px-5 py-3.5">Duration</th>
                    <th className="px-5 py-3.5">Distance</th>
                    <th className="px-5 py-3.5">Max Altitude</th>
                    <th className="px-5 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredLogs.map(
                    ({ id, type, date, duration, distance, maxAltitude, status, captures, markedLocations, trackPoints }) => {
                      const isSim = status === 'Simulation' || status === 'LIVE' || id === 'LIVE-MAVLINK'
                      const isSuccess = status === 'Success'
                      const isAborted = status === 'Aborted'

                      return (
                        <tr
                          key={id}
                          onClick={() =>
                            onOpenMission?.({
                              id,
                              type,
                              date,
                              duration,
                              distance,
                              maxAltitude,
                              status,
                              captures,
                              markedLocations,
                              trackPoints,
                            })
                          }
                          className="cursor-pointer transition hover:bg-slate-100 group border-b border-slate-200"
                        >
                          <td className="data-font font-bold px-5 py-4 text-slate-900 group-hover:text-sky-700 transition">
                            <div className="flex items-center gap-2">
                              <Icon className="text-[16px] text-slate-600 group-hover:text-sky-700 transition">flight</Icon>
                              <span>{id}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-800 font-semibold">{date}</td>
                          <td className="px-5 py-4 font-bold text-slate-900">{type}</td>
                          <td className="data-font px-5 py-4 text-slate-800 font-bold">{duration}</td>
                          <td className="data-font px-5 py-4 text-slate-800 font-bold">{distance}</td>
                          <td className="data-font px-5 py-4 text-slate-800 font-bold">{maxAltitude}</td>
                          <td className="px-5 py-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-extrabold text-white shadow-xs ${
                                isSuccess
                                  ? 'bg-emerald-600 border border-emerald-700'
                                  : isAborted
                                    ? 'bg-red-600 border border-red-700'
                                    : 'bg-sky-600 border border-sky-700 animate-pulse'
                              }`}
                            >
                              <Icon className="text-[14px]">
                                {isSuccess ? 'check_circle' : isAborted ? 'cancel' : 'sensors'}
                              </Icon>
                              {status}
                            </span>
                          </td>
                        </tr>
                      )
                    }
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* GRID CARDS VIEW */
            <div className="flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto bg-slate-50">
              {filteredLogs.map(
                ({ id, type, date, duration, distance, maxAltitude, status, captures, markedLocations, trackPoints }) => {
                  const isSim = status === 'Simulation' || status === 'LIVE' || id === 'LIVE-MAVLINK'
                  const isSuccess = status === 'Success'
                  const isAborted = status === 'Aborted'

                  return (
                    <div
                      key={id}
                      onClick={() =>
                        onOpenMission?.({
                          id,
                          type,
                          date,
                          duration,
                          distance,
                          maxAltitude,
                          status,
                          captures,
                          markedLocations,
                          trackPoints,
                        })
                      }
                      className="group cursor-pointer rounded-xl border border-slate-300 bg-white p-4 shadow-xs transition hover:border-sky-600 hover:shadow-md flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white transition">
                              <Icon className="text-[18px]">flight</Icon>
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-slate-900 group-hover:text-sky-700 transition data-font">
                                {id}
                              </h4>
                              <p className="text-[11px] text-slate-500 font-semibold">{date}</p>
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-extrabold text-white ${
                              isSuccess
                                ? 'bg-emerald-600'
                                : isAborted
                                  ? 'bg-red-600'
                                  : 'bg-sky-600'
                            }`}
                          >
                            <Icon className="text-[13px]">
                              {isSuccess ? 'check_circle' : isAborted ? 'cancel' : 'sensors'}
                            </Icon>
                            {status}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-900 mb-3">{type}</p>

                        <div className="grid grid-cols-3 gap-2 bg-slate-100 rounded-lg p-2.5 text-center border border-slate-200">
                          <div>
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600 block">Duration</span>
                            <span className="text-xs font-bold text-slate-900 data-font">{duration}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600 block">Distance</span>
                            <span className="text-xs font-bold text-slate-900 data-font">{distance}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600 block">Altitude</span>
                            <span className="text-xs font-bold text-slate-900 data-font">{maxAltitude}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-900 group-hover:text-sky-700">
                        <span>View Mission Details</span>
                        <Icon className="text-[16px] transform group-hover:translate-x-1 transition">chevron_right</Icon>
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
