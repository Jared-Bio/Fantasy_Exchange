import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { Button } from '../components/ui/button.jsx'
import { Card } from '../components/ui/card.jsx'
import { Input } from '../components/ui/input.jsx'
import { Label } from '../components/ui/label.jsx'
import { cn } from '../lib/utils.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'

export default function TradeCalculator() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [league, setLeague] = useState(null)
  const [rosters, setRosters] = useState([])
  const [players, setPlayers] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [playerStats, setPlayerStats] = useState(new Map()) // Map of playerId -> stats
  
  // Trade selections
  const [myPlayerIds, setMyPlayerIds] = useState([]) // Players giving away
  const [targetPlayerIds, setTargetPlayerIds] = useState([]) // Players receiving (1-2)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const playerMap = useMemo(() => players || {}, [players])
  
  const myRoster = useMemo(() => {
    if (!user?.myRosterId) return null
    return rosters.find(r => r.roster_id === user.myRosterId) || null
  }, [user?.myRosterId, rosters])

  // Get all players from all rosters for search
  const allRosterPlayers = useMemo(() => {
    if (!rosters || !playerMap) return []
    const allIds = new Set()
    rosters.forEach(r => {
      (r.players || []).forEach(pid => allIds.add(pid))
    })
    return Array.from(allIds)
      .map(pid => ({ id: pid, player: playerMap[pid] }))
      .filter(p => p.player)
  }, [rosters, playerMap])

  // Filter players based on search
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return allRosterPlayers.filter(({ player }) => {
      const name = player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim()
      return name.toLowerCase().includes(query) || 
             player?.position?.toLowerCase().includes(query) ||
             (player?.team && player.team.toLowerCase().includes(query))
    }).slice(0, 10) // Limit to 10 results
  }, [searchQuery, allRosterPlayers])

  async function loadLeagueData() {
    if (!user?.leagueId) return
    setLoading(true)
    setErr('')
    try {
      const [lg, rs, ps] = await Promise.all([
        fetch(`${API_BASE}/league/${user.leagueId}`).then(r=>r.json()),
        fetch(`${API_BASE}/league/${user.leagueId}/rosters`).then(r=>r.json()),
        fetch(`${API_BASE}/players`).then(r=>r.json())
      ])
      setLeague(lg)
      setRosters(rs)
      setPlayers(ps)
    } catch (e) {
      setErr(e.message || 'Failed to load league data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    if (user?.leagueId) loadLeagueData() 
  }, [user?.leagueId])

  // Fetch stats for selected players
  useEffect(() => {
    const fetchStats = async () => {
      const allPlayerIds = [...myPlayerIds, ...targetPlayerIds]
      for (const pid of allPlayerIds) {
        if (!playerStats.has(pid)) {
          await fetchPlayerStats(pid)
        }
      }
    }
    
    if (myPlayerIds.length > 0 || targetPlayerIds.length > 0) {
      fetchStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPlayerIds, targetPlayerIds])

  function playerImageUrl(playerId) {
    return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`
  }

  function getPlayerName(playerId) {
    const p = playerMap?.[playerId]
    return p?.full_name || (p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : playerId)
  }

  // Fetch stats for a player
  async function fetchPlayerStats(playerId) {
    if (playerStats.has(playerId)) return playerStats.get(playerId)
    
    try {
      const response = await fetch(`${API_BASE}/player/stats/${playerId}`)
      if (response.ok) {
        const data = await response.json()
        const stats = data.apiFootballStats
        if (stats) {
          setPlayerStats(prev => new Map(prev).set(playerId, stats))
          return stats
        }
      }
    } catch (e) {
      console.error('Error fetching player stats:', e)
    }
    return null
  }

  // Calculate player value using stats and rankings
  function getPlayerValue(playerId) {
    const p = playerMap?.[playerId]
    const stats = playerStats.get(playerId)
    
    let value = 0
    
    // Base value from Expert Consensus Ranking (if available)
    const rank = p?.rank_ecr || p?.depth_chart_order || 999
    if (rank > 0 && rank < 999) {
      value += (1000 - rank) * 0.6 // 60% weight on ranking
    }
    
    // Add value from actual stats (if available)
    if (stats?.statistics && stats.statistics.length > 0) {
      const seasonStats = stats.statistics[0]?.statistics || {}
      const position = p?.position?.toUpperCase()
      
      // Position-specific stat calculations
      if (position === 'QB') {
        const yards = (seasonStats.passes?.yards || 0) + (seasonStats.rushing?.yards || 0)
        const tds = (seasonStats.passes?.scored || 0) + (seasonStats.rushing?.scored || 0)
        const ints = seasonStats.passes?.interceptions || 0
        const completions = seasonStats.passes?.success || 0
        const attempts = seasonStats.passes?.total || 0
        
        // Fantasy QB scoring approximation: 1pt per 25 passing yards, 1pt per 10 rush yards, 4pts per TD, -2 per INT
        const passingYards = (seasonStats.passes?.yards || 0) * 0.04
        const rushingYards = (seasonStats.rushing?.yards || 0) * 0.1
        const touchdowns = tds * 4
        const interceptions = ints * -2
        const completionBonus = attempts > 0 ? (completions / attempts) * 2 : 0
        
        value += (passingYards + rushingYards + touchdowns + interceptions + completionBonus) * 0.4
      } else if (position === 'RB') {
        const yards = (seasonStats.rushing?.yards || 0) + (seasonStats.passes?.yards || 0)
        const tds = (seasonStats.rushing?.scored || 0) + (seasonStats.passes?.scored || 0)
        const receptions = seasonStats.passes?.success || 0
        const fumbles = seasonStats.rushing?.lost || 0
        
        // Fantasy RB scoring: 1pt per 10 rush yards, 1pt per 10 rec yards, 0.5-1pt per rec, 6pts per TD, -2 per fumble
        const rushingYards = (seasonStats.rushing?.yards || 0) * 0.1
        const receivingYards = (seasonStats.passes?.yards || 0) * 0.1
        const receptionsPoints = receptions * 1 // PPR scoring
        const touchdowns = tds * 6
        const fumblesPoints = fumbles * -2
        
        value += (rushingYards + receivingYards + receptionsPoints + touchdowns + fumblesPoints) * 0.4
      } else if (position === 'WR' || position === 'TE') {
        const receptions = seasonStats.passes?.success || 0
        const yards = seasonStats.passes?.yards || 0
        const tds = seasonStats.passes?.scored || 0
        const targets = seasonStats.passes?.total || 0
        const fumbles = seasonStats.passes?.lost || 0
        
        // Fantasy WR/TE scoring: 1pt per rec, 1pt per 10 yards, 6pts per TD, -2 per fumble
        const receptionsPoints = receptions * 1 // PPR scoring
        const yardsPoints = yards * 0.1
        const touchdowns = tds * 6
        const fumblesPoints = fumbles * -2
        const targetShare = targets > 0 ? (receptions / targets) * 3 : 0 // Catch rate bonus
        
        value += (receptionsPoints + yardsPoints + touchdowns + fumblesPoints + targetShare) * 0.4
      } else {
        // For other positions, use general stats if available
        const totalYards = (seasonStats.rushing?.yards || 0) + (seasonStats.passes?.yards || 0)
        const totalTds = (seasonStats.rushing?.scored || 0) + (seasonStats.passes?.scored || 0)
        value += (totalYards * 0.05 + totalTds * 5) * 0.4
      }
    }
    
    return Math.max(0, value)
  }

  function calculateTrade() {
    if (myPlayerIds.length === 0 || targetPlayerIds.length === 0) {
      return null
    }

    // Calculate total values
    const myValue = myPlayerIds.reduce((sum, pid) => sum + getPlayerValue(pid), 0)
    const targetValue = targetPlayerIds.reduce((sum, pid) => sum + getPlayerValue(pid), 0)
    const netValue = targetValue - myValue

    // Calculate position impact
    const myPositions = myPlayerIds.map(pid => playerMap?.[pid]?.position || 'UNKNOWN')
    const targetPositions = targetPlayerIds.map(pid => playerMap?.[pid]?.position || 'UNKNOWN')
    
    // Count current positions after trade
    const positionCounts = {}
    const myCurrentRoster = (myRoster?.players || []).filter(pid => !myPlayerIds.includes(pid))
    myCurrentRoster.forEach(pid => {
      const pos = playerMap?.[pid]?.position || 'UNKNOWN'
      positionCounts[pos] = (positionCounts[pos] || 0) + 1
    })
    targetPositions.forEach(pos => {
      positionCounts[pos] = (positionCounts[pos] || 0) + 1
    })

    // Determine if trade helps or hurts
    let verdict = 'neutral'
    let verdictText = 'Neutral Trade'
    
    if (netValue > 50) {
      verdict = 'beneficial'
      verdictText = 'Good Trade ✓'
    } else if (netValue < -50) {
      verdict = 'hurts'
      verdictText = 'Bad Trade ✗'
    }

    // Position balance check
    const needs = { surplus: [], deficit: [] }
    const targets = { QB: 2, RB: 4, WR: 5, TE: 2 }
    for (const [pos, target] of Object.entries(targets)) {
      const have = positionCounts[pos] || 0
      if (have >= target + 2) needs.surplus.push(pos)
      if (have < target) needs.deficit.push(pos)
    }

    return {
      myValue,
      targetValue,
      netValue,
      verdict,
      verdictText,
      positionCounts,
      needs,
      myPositions,
      targetPositions
    }
  }

  const tradeAnalysis = useMemo(() => calculateTrade(), [myPlayerIds, targetPlayerIds, playerMap, myRoster])

  function addMyPlayer(playerId) {
    if (!myPlayerIds.includes(playerId)) {
      setMyPlayerIds([...myPlayerIds, playerId])
    }
  }

  function removeMyPlayer(playerId) {
    setMyPlayerIds(myPlayerIds.filter(id => id !== playerId))
  }

  function addTargetPlayer(playerId) {
    if (targetPlayerIds.length < 2 && !targetPlayerIds.includes(playerId)) {
      setTargetPlayerIds([...targetPlayerIds, playerId])
      setShowSearch(false)
      setSearchQuery('')
    }
  }

  function removeTargetPlayer(playerId) {
    setTargetPlayerIds(targetPlayerIds.filter(id => id !== playerId))
  }

  const myRosterPlayers = useMemo(() => {
    if (!myRoster || !playerMap) return []
    return (myRoster.players || [])
      .map(pid => ({ id: pid, player: playerMap[pid] }))
      .filter(p => p.player)
      .sort((a, b) => {
        const rankA = a.player?.rank_ecr || 999
        const rankB = b.player?.rank_ecr || 999
        return rankA - rankB
      })
  }, [myRoster, playerMap])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-10 border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-blue-600"></div>
            <h1 className="text-lg font-semibold">Trade Calculator</h1>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {!user?.leagueId ? (
          <Card className="p-6">
            <p className="text-slate-700">Please set your League ID in the Dashboard to use the Trade Calculator.</p>
          </Card>
        ) : !user?.myRosterId ? (
          <Card className="p-6">
            <p className="text-slate-700">Please select your team in the Dashboard to use the Trade Calculator.</p>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <Button variant="outline" onClick={loadLeagueData} disabled={loading}>
                {loading ? 'Loading…' : 'Reload Data'}
              </Button>
              {err && <span className="ml-3 text-sm text-red-600">{err}</span>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* My Players (Giving Away) */}
              <Card className="p-4">
                <h2 className="font-semibold mb-3 text-lg">Giving Away</h2>
                {myPlayerIds.length === 0 ? (
                  <p className="text-sm text-slate-600 mb-3">Select 1 player from your roster</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {myPlayerIds.map(pid => {
                      const p = playerMap?.[pid]
                      return (
                        <div key={pid} className="border rounded-lg p-3 bg-white flex items-center gap-3">
                          <img 
                            src={playerImageUrl(pid)} 
                            onError={(e)=>{e.currentTarget.src='https://via.placeholder.com/48x48?text=NO+IMG'}} 
                            alt="player" 
                            className="w-12 h-12 rounded-lg object-cover border" 
                          />
                          <div className="flex-1 min-w-0">
                            <Link to={`/player/${pid}`} className="text-sm font-medium truncate text-blue-600 hover:underline block">
                              {getPlayerName(pid)}
                            </Link>
                            <div className="text-xs text-slate-600">{p?.position || 'POS'} · Rank {p?.rank_ecr || '-'}</div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => removeMyPlayer(pid)}
                            className="text-xs"
                          >
                            Remove
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
                
                {myPlayerIds.length === 0 && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {myRosterPlayers.map(({ id: pid, player: p }) => (
                      <button
                        key={pid}
                        onClick={() => addMyPlayer(pid)}
                        className="w-full border rounded-lg p-3 bg-white hover:bg-slate-50 flex items-center gap-3 text-left transition-colors"
                      >
                        <img 
                          src={playerImageUrl(pid)} 
                          onError={(e)=>{e.currentTarget.src='https://via.placeholder.com/48x48?text=NO+IMG'}} 
                          alt="player" 
                          className="w-12 h-12 rounded-lg object-cover border" 
                        />
                        <div className="flex-1 min-w-0">
                          <Link to={`/player/${pid}`} className="text-sm font-medium truncate text-blue-600 hover:underline block">
                            {getPlayerName(pid)}
                          </Link>
                          <div className="text-xs text-slate-600">{p?.position || 'POS'} · Rank {p?.rank_ecr || '-'}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {/* Target Players (Receiving) */}
              <Card className="p-4">
                <h2 className="font-semibold mb-3 text-lg">Receiving</h2>
                
                {targetPlayerIds.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {targetPlayerIds.map(pid => {
                      const p = playerMap?.[pid]
                      return (
                        <div key={pid} className="border rounded-lg p-3 bg-white flex items-center gap-3">
                          <img 
                            src={playerImageUrl(pid)} 
                            onError={(e)=>{e.currentTarget.src='https://via.placeholder.com/48x48?text=NO+IMG'}} 
                            alt="player" 
                            className="w-12 h-12 rounded-lg object-cover border" 
                          />
                          <div className="flex-1 min-w-0">
                            <Link to={`/player/${pid}`} className="text-sm font-medium truncate text-blue-600 hover:underline block">
                              {getPlayerName(pid)}
                            </Link>
                            <div className="text-xs text-slate-600">{p?.position || 'POS'} · Rank {p?.rank_ecr || '-'}</div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => removeTargetPlayer(pid)}
                            className="text-xs"
                          >
                            Remove
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {targetPlayerIds.length < 2 && (
                  <>
                    {!showSearch ? (
                      <Button 
                        variant="outline" 
                        className="w-full mb-3"
                        onClick={() => setShowSearch(true)}
                      >
                        {targetPlayerIds.length === 0 ? 'Add Player (1-2)' : 'Add Second Player'}
                      </Button>
                    ) : (
                      <div className="mb-3">
                        <Label>Search Players</Label>
                        <Input
                          type="text"
                          placeholder="Search by name, position, or team..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="mt-1"
                          autoFocus
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => {
                            setShowSearch(false)
                            setSearchQuery('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}

                    {showSearch && filteredPlayers.length > 0 && (
                      <div className="space-y-2 max-h-96 overflow-y-auto border-t pt-2">
                        {filteredPlayers.map(({ id: pid, player: p }) => (
                          <button
                            key={pid}
                            onClick={() => addTargetPlayer(pid)}
                            disabled={targetPlayerIds.includes(pid)}
                            className="w-full border rounded-lg p-3 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 text-left transition-colors"
                          >
                            <img 
                              src={playerImageUrl(pid)} 
                              onError={(e)=>{e.currentTarget.src='https://via.placeholder.com/48x48?text=NO+IMG'}} 
                              alt="player" 
                              className="w-12 h-12 rounded-lg object-cover border" 
                            />
                            <div className="flex-1 min-w-0">
                              <Link to={`/player/${pid}`} className="text-sm font-medium truncate text-blue-600 hover:underline block">
                                {getPlayerName(pid)}
                              </Link>
                              <div className="text-xs text-slate-600">{p?.position || 'POS'} · {p?.team || 'N/A'} · Rank {p?.rank_ecr || '-'}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {showSearch && searchQuery && filteredPlayers.length === 0 && (
                      <p className="text-sm text-slate-600 mt-2">No players found</p>
                    )}
                  </>
                )}
              </Card>

              {/* Trade Analysis */}
              <Card className="p-4">
                <h2 className="font-semibold mb-3 text-lg">Trade Analysis</h2>
                
                {!tradeAnalysis ? (
                  <div className="text-sm text-slate-600">
                    <p>Select players to analyze the trade.</p>
                    <p className="mt-2">• Choose 1 player you're giving away</p>
                    <p>• Choose 1-2 players you're receiving</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Verdict */}
                    <div className={cn(
                      "p-4 rounded-lg border",
                      tradeAnalysis.verdict === 'beneficial' && "bg-green-50 border-green-200",
                      tradeAnalysis.verdict === 'hurts' && "bg-red-50 border-red-200",
                      tradeAnalysis.verdict === 'neutral' && "bg-slate-50 border-slate-200"
                    )}>
                      <div className={cn(
                        "text-lg font-bold",
                        tradeAnalysis.verdict === 'beneficial' && "text-green-700",
                        tradeAnalysis.verdict === 'hurts' && "text-red-700",
                        tradeAnalysis.verdict === 'neutral' && "text-slate-700"
                      )}>
                        {tradeAnalysis.verdictText}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        Net Value: {tradeAnalysis.netValue > 0 ? '+' : ''}{tradeAnalysis.netValue.toFixed(0)}
                      </div>
                    </div>

                    {/* Value Breakdown */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Your Players Value:</span>
                        <span className="font-medium">{tradeAnalysis.myValue.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Receiving Players Value:</span>
                        <span className="font-medium">{tradeAnalysis.targetValue.toFixed(0)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                        <span>Net Change:</span>
                        <span className={tradeAnalysis.netValue > 0 ? 'text-green-600' : tradeAnalysis.netValue < 0 ? 'text-red-600' : ''}>
                          {tradeAnalysis.netValue > 0 ? '+' : ''}{tradeAnalysis.netValue.toFixed(0)}
                        </span>
                      </div>
                    </div>

                    {/* Position Impact */}
                    {tradeAnalysis.needs.deficit.length > 0 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="text-sm font-medium text-yellow-800">Position Concerns:</div>
                        <div className="text-xs text-yellow-700 mt-1">
                          After trade, you may be short on: {tradeAnalysis.needs.deficit.join(', ')}
                        </div>
                      </div>
                    )}

                    {tradeAnalysis.needs.surplus.length > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-sm font-medium text-blue-800">Position Surplus:</div>
                        <div className="text-xs text-blue-700 mt-1">
                          After trade, you'll have extra: {tradeAnalysis.needs.surplus.join(', ')}
                        </div>
                      </div>
                    )}

                    {/* Trade Summary */}
                    <div className="pt-3 border-t">
                      <div className="text-xs text-slate-600 space-y-1">
                        <div><strong>Giving:</strong> {myPlayerIds.map(pid => getPlayerName(pid)).join(', ')}</div>
                        <div><strong>Receiving:</strong> {targetPlayerIds.map(pid => getPlayerName(pid)).join(', ')}</div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

