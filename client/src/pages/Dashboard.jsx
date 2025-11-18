import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { Button } from '../components/ui/button.jsx'
import { Card } from '../components/ui/card.jsx'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, logout, saveLeagueId, saveMyRosterId } = useAuth()
  const [editing, setEditing] = useState(false)
  const [leagueIdInput, setLeagueIdInput] = useState(user?.leagueId || '')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [league, setLeague] = useState(null)
  const [users, setUsers] = useState([])
  const [rosters, setRosters] = useState([])
  const [players, setPlayers] = useState(null)
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'standings' | 'schedule'
  const [nflState, setNflState] = useState(null)
  const [matchupsByWeek, setMatchupsByWeek] = useState(new Map())
  const [schedule, setSchedule] = useState([])

  const playerMap = useMemo(() => players || {}, [players])

  const rosterIdToUserInfo = useMemo(() => {
    const byUser = new Map(users.map(u => [u.user_id, {
      displayName: u.display_name || 'Unknown',
      username: u.username || '',
      teamName: u?.metadata?.team_name || u?.metadata?.team_name_update || null
    }]))
    const map = new Map()
    for (const r of rosters) {
      const info = byUser.get(r.owner_id)
      map.set(r.roster_id, info || { displayName: `Team ${r.roster_id}`, username: '', teamName: null })
    }
    return map
  }, [users, rosters])

  async function loadLeagueData() {
    if (!user?.leagueId) return
    setLoading(true)
    setErr('')
    try {
      const [lg, us, rs, ps] = await Promise.all([
        fetch(`${API_BASE}/league/${user.leagueId}`).then(r=>r.json()),
        fetch(`${API_BASE}/league/${user.leagueId}/users`).then(r=>r.json()),
        fetch(`${API_BASE}/league/${user.leagueId}/rosters`).then(r=>r.json()),
        fetch(`${API_BASE}/players`).then(r=>r.json())
      ])
      setLeague(lg)
      setUsers(us)
      setRosters(rs)
      setPlayers(ps)
    } catch (e) {
      setErr(e.message || 'Failed to load league data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user?.leagueId) loadLeagueData() }, [user?.leagueId])

  async function loadStateAndMatchups() {
    if (!user?.leagueId) return
    try {
      const state = await fetch(`${API_BASE}/state/nfl`).then(r=>r.json())
      setNflState(state)
      const maxWeek = Math.max(18, Number(state?.week || 18))
      const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1)
      const results = await Promise.all(weeks.map(w => fetch(`${API_BASE}/league/${user.leagueId}/matchups/${w}`).then(r=>r.json()).catch(()=>[])))
      const map = new Map()
      weeks.forEach((w, idx) => { map.set(w, results[idx] || []) })
      setMatchupsByWeek(map)
    } catch {
      setMatchupsByWeek(new Map())
    }
  }

  useEffect(() => { loadStateAndMatchups() }, [user?.leagueId])

  useEffect(() => {
    if (!user?.myRosterId || matchupsByWeek.size === 0) { setSchedule([]); return }
    const sched = []
    for (const [week, mus] of matchupsByWeek.entries()) {
      const mine = mus.find(m => m.roster_id === user.myRosterId)
      if (!mine) {
        sched.push({ week, opponentName: 'BYE', myPoints: null, oppPoints: null, result: null })
        continue
      }
      const opp = mus.find(x => x.matchup_id === mine.matchup_id && x.roster_id !== user.myRosterId)
      const oppName = opp ? (rosterIdToUserInfo.get(opp.roster_id)?.teamName || rosterIdToUserInfo.get(opp.roster_id)?.displayName || `Team ${opp.roster_id}`) : 'TBD'
      const myPoints = typeof mine.points === 'number' ? mine.points : (mine.points || null)
      const oppPoints = opp ? (typeof opp.points === 'number' ? opp.points : (opp.points || null)) : null
      let result = null
      if (myPoints != null && oppPoints != null) {
        if (myPoints > oppPoints) result = 'W'
        else if (myPoints < oppPoints) result = 'L'
        else result = 'T'
      }
      sched.push({ week, opponentName: oppName, myPoints, oppPoints, result })
    }
    sched.sort((a,b)=>a.week-b.week)
    setSchedule(sched)
  }, [user?.myRosterId, matchupsByWeek, rosterIdToUserInfo])

  const myRoster = useMemo(() => {
    if (!user?.myRosterId) return null
    return rosters.find(r => r.roster_id === user.myRosterId) || null
  }, [user?.myRosterId, rosters])

  function playerImageUrl(playerId) {
    return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`
  }

  function positionRank(p) {
    // Try available fields; fallback "-"
    return p?.rank_ecr || p?.depth_chart_order || '-'
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-10 border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-blue-600"></div>
            <h1 className="text-lg font-semibold">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/trade-calculator')}>
              Trade Calculator
            </Button>
            <span className="text-sm text-slate-600">{user?.username}</span>
            <Button variant="outline" onClick={logout}>Log out</Button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-3 p-4">
          <h2 className="font-semibold mb-2">Overview</h2>
          {!user?.leagueId ? (
            <p className="text-sm text-slate-700">Set a Sleeper League ID in Quick Actions to load league data.</p>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Button variant="outline" onClick={loadLeagueData} disabled={loading}>{loading ? 'Loading…' : 'Reload League'}</Button>
                {err && <span className="text-sm text-red-600">{err}</span>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="font-medium mb-2">League Teams</div>
                  <div className="border rounded-xl divide-y bg-white">
                    {rosters.map(r => {
                      const info = rosterIdToUserInfo.get(r.roster_id) || {}
                      const teamName = info.teamName || `${info.displayName}'s Team`
                      const handle = info.username ? `@${info.username}` : ''
                      return (
                        <div key={r.roster_id} className="px-3 py-2 flex items-center justify-between">
                          <div className="min-w-0 pr-2">
                            <div className="font-semibold text-base text-slate-900">{teamName}</div>
                            {handle && <div className="text-xs text-slate-500 truncate">{handle}</div>}
                          </div>
                          <button onClick={() => saveMyRosterId(r.roster_id)} className={`px-2 py-1.5 rounded-lg text-xs ${user?.myRosterId === r.roster_id ? 'bg-green-600 text-white' : 'border bg-white hover:bg-slate-50'}`}>{user?.myRosterId === r.roster_id ? 'My Team' : 'Select'}</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="md:col-span-2">
                  {!myRoster ? (
                    <div className="text-sm text-slate-700">Select your team from the left to view your roster.</div>
                  ) : (
                    <div className="md:col-span-2">
                    <div className="font-medium mb-2">My Roster</div>
                    {!myRoster ? (
                      <div className="text-sm text-slate-700">Select your team from the left to view your roster.</div>
                    ) : (
                      <div className="space-y-6">
                        {/* Starting Lineup */}
                        {(myRoster.starters && myRoster.starters.length > 0) && (
                          <div>
                            <h4 className="font-medium text-sm text-slate-700 mb-3 flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              Starting Lineup ({myRoster.starters.length})
                            </h4>
                            <div className="space-y-2">
                              {myRoster.starters.map(pid => {
                                const p = playerMap?.[pid]
                                return (
                                  <div key={pid} className="border rounded-xl p-3 bg-white flex items-center gap-3 shadow-sm">
                                    <img src={playerImageUrl(pid)} onError={(e)=>{e.currentTarget.src='https://via.placeholder.com/64x64?text=NO+IMG'}} alt="player" className="w-12 h-12 rounded-lg object-cover border" />
                                    <div className="min-w-0 flex-1">
                                      <Link to={`/player/${pid}`} className="text-sm font-medium truncate text-blue-600 hover:underline block">
                                        {p?.full_name || p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : pid}
                                      </Link>
                                      <div className="text-xs text-slate-600">{p?.position || 'POS'} · Rank {positionRank(p)}</div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                  
                        {/* Bench Players */}
                        {(() => {
                          const benchPlayers = (myRoster.players || []).filter(pid => 
                            !(myRoster.starters || []).includes(pid) && 
                            !(myRoster.reserve || []).includes(pid) && 
                            !(myRoster.taxi || []).includes(pid)
                          )
                          return benchPlayers.length > 0 && (
                            <div>
                              <h4 className="font-medium text-sm text-slate-700 mb-3 flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                Bench ({benchPlayers.length})
                              </h4>
                              <div className="space-y-2">
                                {benchPlayers.map(pid => {
                                  const p = playerMap?.[pid]
                                  return (
                                    <div key={pid} className="border rounded-xl p-3 bg-white flex items-center gap-3 shadow-sm opacity-75">
                                      <img src={playerImageUrl(pid)} onError={(e)=>{e.currentTarget.src='https://via.placeholder.com/64x64?text=NO+IMG'}} alt="player" className="w-12 h-12 rounded-lg object-cover border" />
                                      <div className="min-w-0 flex-1">
                                        <Link to={`/player/${pid}`} className="text-sm font-medium truncate text-blue-600 hover:underline block">
                                          {p?.full_name || p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : pid}
                                        </Link>
                                        <div className="text-xs text-slate-600">{p?.position || 'POS'} · Rank {positionRank(p)}</div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })()}
                  
                        {/* Injured Reserve */}
                        {(myRoster.reserve && myRoster.reserve.length > 0) && (
                          <div>
                            <h4 className="font-medium text-sm text-slate-700 mb-3 flex items-center gap-2">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              Injured Reserve ({myRoster.reserve.length})
                            </h4>
                            <div className="space-y-2">
                              {myRoster.reserve.map(pid => {
                                const p = playerMap?.[pid]
                                return (
                                  <div key={pid} className="border rounded-xl p-3 bg-white flex items-center gap-3 shadow-sm opacity-60">
                                    <img src={playerImageUrl(pid)} onError={(e)=>{e.currentTarget.src='https://via.placeholder.com/64x64?text=NO+IMG'}} alt="player" className="w-12 h-12 rounded-lg object-cover border" />
                                    <div className="min-w-0 flex-1">
                                      <Link to={`/player/${pid}`} className="text-sm font-medium truncate text-blue-600 hover:underline block">
                                        {p?.full_name || p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : pid}
                                      </Link>
                                      <div className="text-xs text-slate-600">{p?.position || 'POS'} · Rank {positionRank(p)}</div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                  
                        {/* Taxi Squad */}
                        {(myRoster.taxi && myRoster.taxi.length > 0) && (
                          <div>
                            <h4 className="font-medium text-sm text-slate-700 mb-3 flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              Taxi Squad ({myRoster.taxi.length})
                            </h4>
                            <div className="space-y-2">
                              {myRoster.taxi.map(pid => {
                                const p = playerMap?.[pid]
                                return (
                                  <div key={pid} className="border rounded-xl p-3 bg-white flex items-center gap-3 shadow-sm opacity-50">
                                    <img src={playerImageUrl(pid)} onError={(e)=>{e.currentTarget.src='https://via.placeholder.com/64x64?text=NO+IMG'}} alt="player" className="w-12 h-12 rounded-lg object-cover border" />
                                    <div className="min-w-0 flex-1">
                                      <Link to={`/player/${pid}`} className="text-sm font-medium truncate text-blue-600 hover:underline block">
                                        {p?.full_name || p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : pid}
                                      </Link>
                                      <div className="text-xs text-slate-600">{p?.position || 'POS'} · Rank {positionRank(p)}</div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
        <Card className="p-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="chat" activeValue={activeTab} onClick={setActiveTab}>League Chat</TabsTrigger>
              <TabsTrigger value="standings" activeValue={activeTab} onClick={setActiveTab}>Standings</TabsTrigger>
              <TabsTrigger value="schedule" activeValue={activeTab} onClick={setActiveTab}>My Schedule</TabsTrigger>
            </TabsList>
            <TabsContent value="chat" activeValue={activeTab}>
              <div className="text-slate-600">Live chat feed coming soon.</div>
            </TabsContent>
            <TabsContent value="standings" activeValue={activeTab}>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-600">
                      <th className="py-1 pr-2">Team</th>
                      <th className="py-1 pr-2">W</th>
                      <th className="py-1 pr-2">L</th>
                      <th className="py-1 pr-2">PF</th>
                      <th className="py-1 pr-2">PA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rosters].sort((a,b)=>{
                      const aw = a.settings?.wins||0, bw = b.settings?.wins||0
                      if (bw!==aw) return bw-aw
                      const apf = a.settings?.fpts||0, bpf = b.settings?.fpts||0
                      return (bpf - apf)
                    }).map(r=>{
                      const info = rosterIdToUserInfo.get(r.roster_id) || {}
                      const teamName = info.teamName || `${info.displayName}'s Team`
                      return (
                        <tr key={r.roster_id} className="border-t">
                          <td className="py-1 pr-2">
                            <div className="font-medium text-[13px]">{teamName}</div>
                            {info.username && <div className="text-[11px] text-slate-500">@{info.username}</div>}
                          </td>
                          <td className="py-1 pr-2">{r.settings?.wins ?? '-'}</td>
                          <td className="py-1 pr-2">{r.settings?.losses ?? '-'}</td>
                          <td className="py-1 pr-2">{r.settings?.fpts ?? '-'}</td>
                          <td className="py-1 pr-2">{r.settings?.fpts_against ?? '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent value="schedule" activeValue={activeTab}>
                {!user?.myRosterId ? (
                  <div className="text-slate-600">Select your team from the Overview to view schedule.</div>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-600">
                          <th className="py-1 pr-2">Week</th>
                          <th className="py-1 pr-2">Opponent</th>
                          <th className="py-1 pr-2">Result</th>
                          <th className="py-1 pr-2">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.map(row => (
                          <tr key={row.week} className="border-t">
                            <td className="py-1 pr-2">{row.week}</td>
                            <td className="py-1 pr-2">{row.opponentName}</td>
                            <td className="py-1 pr-2">
                              {row.result === 'W' && <span className="text-green-600 font-medium">W</span>}
                              {row.result === 'L' && <span className="text-red-600 font-medium">L</span>}
                              {row.result === 'T' && <span className="text-slate-700 font-medium">T</span>}
                              {row.result == null && <span className="text-slate-500">-</span>}
                            </td>
                            <td className="py-1 pr-2">
                              {(row.myPoints!=null && row.oppPoints!=null) ? `${row.myPoints} - ${row.oppPoints}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </TabsContent>
          </Tabs>
        </Card>
      </main>
    </div>
  )
}


