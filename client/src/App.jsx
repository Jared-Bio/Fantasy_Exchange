import { useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'

export default function App() {
  const [leagueId, setLeagueId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const canFetch = useMemo(() => leagueId.trim().length > 0 && !loading, [leagueId, loading])

  async function fetchSuggestions() {
    if (!canFetch) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`${API_BASE}/league/${encodeURIComponent(leagueId)}/suggestions`)
      if (!res.ok) throw new Error('Failed to fetch data')
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setError(e.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Fantasy Exchange</h1>
          <a className="text-sm text-slate-600" href="#" onClick={(e)=>e.preventDefault()}>MVP</a>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <section className="bg-white rounded-lg border p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Sleeper League ID</label>
              <input
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                placeholder="e.g. 123456789012345678"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
              />
            </div>
            <button
              onClick={fetchSuggestions}
              disabled={!canFetch}
              className={`px-4 py-2 rounded text-white ${canFetch ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'}`}
            >
              {loading ? 'Loading…' : 'Fetch League Data'}
            </button>
          </div>
          {error && (
            <div className="mt-3 text-sm text-red-600">{error}</div>
          )}
        </section>

        {result && (
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <h2 className="text-lg font-semibold mb-2">League</h2>
              <div className="bg-white border rounded p-3">
                <div className="text-sm">{result.league?.name || 'Unnamed League'}</div>
                <div className="text-xs text-slate-600">League ID: {leagueId}</div>
              </div>

              <h3 className="text-base font-semibold mt-6 mb-2">Teams</h3>
              <div className="bg-white border rounded divide-y">
                {(result.users || []).map(u => (
                  <div key={u.user_id} className="px-3 py-2 text-sm">
                    {u.display_name || 'Unknown'}
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <h2 className="text-lg font-semibold mb-2">Trade Suggestions</h2>
              <div className="bg-white border rounded divide-y">
                {(result.suggestions && result.suggestions.length > 0) ? (
                  result.suggestions.map((s, idx) => (
                    <div key={idx} className="px-4 py-3">
                      <div className="text-sm"><span className="font-semibold">{s.fromTeam}</span> → <span className="font-semibold">{s.toTeam}</span></div>
                      <div className="text-xs text-slate-600">Position: {s.position}</div>
                      <div className="text-xs text-slate-700 mt-1">{s.note}</div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-slate-600">No suggestions found yet. Try another league.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="max-w-5xl mx-auto px-4 py-8 text-xs text-slate-500">
        Data via Sleeper public API.
      </footer>
    </div>
  )
}


