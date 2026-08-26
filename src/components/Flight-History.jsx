import { useEffect, useMemo, useState } from 'react'
import { deleteMissionLogs } from '../services/missionService'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

export default function FlightHistory({ missionLogs = [], onOpenMission }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [deleteTargets, setDeleteTargets] = useState([])
  const [liveNoticeMission, setLiveNoticeMission] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const logs = useMemo(() => {
    return [...missionLogs]
      .filter((mission) => mission.id.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        if (a.status === 'Live' && b.status !== 'Live') return -1
        if (a.status !== 'Live' && b.status === 'Live') return 1
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      })
  }, [missionLogs, query])
  const pageSize = 10
  const successLogs = logs.filter((mission) => mission.status === 'Success')
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const allSelected = successLogs.length > 0 && successLogs.every((mission) => selectedIds.includes(mission.databaseId))
  const rangeStart = logs.length ? (currentPage - 1) * pageSize + 1 : 0
  const rangeEnd = Math.min(currentPage * pageSize, logs.length)
  useEffect(() => {
    setPage(1)
  }, [query])
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  useEffect(() => {
    if (!liveNoticeMission) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setLiveNoticeMission(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [liveNoticeMission])
  const confirmDelete = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteMissionLogs(deleteTargets.map((mission) => mission.databaseId))
      setSelectedIds((ids) => ids.filter((id) => !deleteTargets.some((mission) => mission.databaseId === id)))
      setDeleteTargets([])
      setDeleteMode(false)
    } catch (error) {
      setDeleteError(error.message || 'Failed to delete mission logs.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="ml-[72px] flex-1 flex flex-col min-h-screen bg-[#f5f7fa] text-[#0f172a]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#eef2f6] bg-white px-6">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Flight History & Logs</h2>
      </header>

      <div className="flex-1 p-6 max-w-[1400px] flex flex-col gap-6">
          <div className="bento-card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Mission Logs</h3>
              <div className="flex items-center gap-2">
                {deleteMode ? (
                  <>
                    <button type="button" onClick={() => { setDeleteMode(false); setSelectedIds([]) }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                    {selectedIds.length > 0 && <button type="button" onClick={() => setDeleteTargets(successLogs.filter((mission) => selectedIds.includes(mission.databaseId)))} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 shadow-xs">Delete selected ({selectedIds.length})</button>}
                  </>
                ) : (
                  <button type="button" onClick={() => setDeleteMode(true)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition cursor-pointer shadow-xs">Delete mission</button>
                )}
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search mission ID..."
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-[#f8fafc] text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="w-[4%] px-3 py-3">{deleteMode && <input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : successLogs.map((mission) => mission.databaseId))} disabled={!successLogs.length} aria-label="Select all completed missions" />}</th>
                    <th className="w-[15%] px-3 py-3">Mission ID</th>
                    <th className="w-[14%] px-3 py-3">Date</th>
                    <th className="w-[15%] px-3 py-3">Mission Type</th>
                    <th className="w-[12%] px-3 py-3">Duration</th>
                    <th className="w-[12%] px-3 py-3">Distance</th>
                    <th className="w-[14%] px-3 py-3">Altitude</th>
                    <th className="w-[14%] px-3 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLogs.map((mission) => (
                    <tr key={mission.databaseId} onClick={() => {
                      if (mission.status === 'Live') {
                        setLiveNoticeMission(mission)
                        return
                      }
                      onOpenMission?.(mission)
                    }} className="cursor-pointer transition hover:bg-slate-50">
                      <td className="px-3 py-3.5" onClick={(event) => event.stopPropagation()}>{deleteMode && mission.status === 'Success' && <input type="checkbox" checked={selectedIds.includes(mission.databaseId)} onChange={() => setSelectedIds((ids) => ids.includes(mission.databaseId) ? ids.filter((id) => id !== mission.databaseId) : [...ids, mission.databaseId])} aria-label={`Select ${mission.id}`} />}</td>
                      <td className="data-font font-bold px-3 py-3.5 text-slate-900">{mission.id}</td>
                      <td className="px-3 py-3.5 text-slate-600">{mission.date}</td>
                      <td className="px-3 py-3.5 font-medium text-slate-700">{mission.type}</td>
                      <td className="data-font px-3 py-3.5 text-slate-600">{mission.duration}</td>
                      <td className="data-font px-3 py-3.5 text-slate-600">{mission.distance}</td>
                      <td className="data-font px-3 py-3.5 text-slate-600">{mission.maxAltitude}</td>
                      <td className="px-3 py-3.5 text-right">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          mission.status === 'Success'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}>
                          <Icon className="text-[14px]">
                            {mission.status === 'Success' ? 'check_circle' : 'radio_button_checked'}
                          </Icon>
                          {mission.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <span className="text-xs text-slate-500">Showing {rangeStart}–{rangeEnd} of {logs.length} missions</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} className={`rounded-md px-2.5 py-1 text-xs font-bold ${pageNumber === currentPage ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{pageNumber}</button>)}
                <button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        </div>
        {liveNoticeMission && (
          <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-900/60 p-6" onClick={() => setLiveNoticeMission(null)}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="live-mission-title">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 border border-red-200 text-red-600"><Icon className="text-[27px]">radio_button_checked</Icon></div>
              <h3 id="live-mission-title" className="mt-4 text-center text-base font-bold text-slate-900">Mission Still Live</h3>
              <p className="mt-2 text-center text-xs leading-5 text-slate-500">Harap menunggu status Success untuk melihat detail lebih lanjut.</p>
              <p className="mt-3 text-center font-mono text-xs font-bold text-slate-700">{liveNoticeMission.id}</p>
              <button type="button" onClick={() => setLiveNoticeMission(null)} className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800">Mengerti</button>
            </div>
          </div>
        )}
        {deleteTargets.length > 0 && (
          <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-900/60 p-6">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <h3 className="text-sm font-bold text-slate-900">Delete mission logs?</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">Hapus {deleteTargets.length} log beserta rute, foto, dan marker? Aksi ini tidak dapat dibatalkan.</p>
              {deleteError && <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">{deleteError}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={deleting} onClick={() => { setDeleteTargets([]); setDeleteError('') }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="button" disabled={deleting} onClick={confirmDelete} className="rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    )
}
