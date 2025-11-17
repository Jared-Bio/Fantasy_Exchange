import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { Button } from '../components/ui/button.jsx'
import { Card } from '../components/ui/card.jsx'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'

export default function PlayerStatSheet() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sleeperPlayer, setSleeperPlayer] = useState(null)
  const [stats, setStats] = useState(null)
  const [gameLogs, setGameLogs] = useState([])
  // Default to 2024 season (most recent complete NFL season)
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const defaultSeason = currentMonth < 8 ? currentYear - 1 : Math.min(currentYear, 2024)
  const [season, setSeason] = useState(defaultSeason)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadPlayerData()
  }, [playerId, season])

  async function loadPlayerData() {
    if (!playerId) return
    setLoading(true)
    setError('')
    try {
      // Load stats and game logs
      const [statsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/player/stats/${playerId}?season=${season}`).then(r => {
          if (!r.ok) throw new Error('Failed to load stats')
          return r.json()
        }).catch(() => null),
        fetch(`${API_BASE}/player/gamelogs/${playerId}?season=${season}`).then(r => {
          if (!r.ok) return { gameLogs: [] }
          return r.json()
        }).catch(() => ({ gameLogs: [] }))
      ])

      if (statsRes) {
        setSleeperPlayer(statsRes.sleeperPlayer)
        setStats(statsRes.apiFootballStats)
        setSeason(statsRes.season || season)
      } else {
        // Fallback: try to get just Sleeper player data
        const allPlayersRes = await fetch(`${API_BASE}/players`).then(r => r.json())
        const player = allPlayersRes[playerId]
        if (player) {
          setSleeperPlayer(player)
        } else {
          setError('Player not found')
        }
      }

      if (logsRes?.gameLogs) {
        setGameLogs(logsRes.gameLogs)
      }
    } catch (e) {
      setError(e.message || 'Failed to load player data')
    } finally {
      setLoading(false)
    }
  }

  function playerImageUrl(playerId) {
    return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`
  }

  function getPlayerName() {
    if (sleeperPlayer) {
      return sleeperPlayer.full_name || 
             (sleeperPlayer.first_name && sleeperPlayer.last_name 
               ? `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}` 
               : playerId)
    }
    return playerId
  }

  function formatStat(value) {
    if (value == null || value === undefined) return '-'
    if (typeof value === 'number') {
      if (value % 1 === 0) return value.toString()
      return value.toFixed(2)
    }
    return value.toString()
  }

  function getSeasonStats() {
    if (!stats?.statistics || !Array.isArray(stats.statistics)) return null
    return stats.statistics[0]?.statistics || {}
  }

  const seasonStats = getSeasonStats()
  const playerInfo = stats?.player || {}
  const teamInfo = stats?.team || {}

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-10 border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-blue-600"></div>
            <h1 className="text-lg font-semibold">Player Stats</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <Card className="p-6">
            <div className="text-center text-slate-600">Loading player data...</div>
          </Card>
        ) : error ? (
          <Card className="p-6">
            <div className="text-center text-red-600">{error}</div>
          </Card>
        ) : !sleeperPlayer ? (
          <Card className="p-6">
            <div className="text-center text-slate-600">Player not found</div>
          </Card>
        ) : (
          <>
            {/* Player Header */}
            <Card className="p-6 mb-6">
              <div className="flex items-start gap-6">
                <img 
                  src={playerImageUrl(playerId)} 
                  onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/120x120?text=NO+IMG' }} 
                  alt="player" 
                  className="w-30 h-30 rounded-lg object-cover border"
                />
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{getPlayerName()}</h2>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    <div><strong>Position:</strong> {sleeperPlayer.position || '-'}</div>
                    {teamInfo.name && <div><strong>Team:</strong> {teamInfo.name}</div>}
                    {playerInfo.age && <div><strong>Age:</strong> {playerInfo.age}</div>}
                    {playerInfo.height && <div><strong>Height:</strong> {playerInfo.height}</div>}
                    {playerInfo.weight && <div><strong>Weight:</strong> {playerInfo.weight}</div>}
                  </div>
                  <div className="mt-4">
                    <label className="text-sm text-slate-600 mr-2">Season:</label>
                    <select 
                      value={season} 
                      onChange={(e) => setSeason(parseInt(e.target.value))}
                      className="px-3 py-1 border rounded"
                    >
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - i
                        return <option key={year} value={year}>{year}</option>
                      })}
                    </select>
                    <Button variant="outline" size="sm" className="ml-2" onClick={loadPlayerData}>
                      Load
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Stats Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview" activeValue={activeTab} onClick={() => setActiveTab('overview')}>
                  Overview
                </TabsTrigger>
                <TabsTrigger value="stats" activeValue={activeTab} onClick={() => setActiveTab('stats')}>
                  Season Stats
                </TabsTrigger>
                <TabsTrigger value="gamelog" activeValue={activeTab} onClick={() => setActiveTab('gamelog')}>
                  Game Log
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" activeValue={activeTab}>
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Player Overview</h3>
                  {stats ? (
                    <div className="space-y-4">
                      {seasonStats && Object.keys(seasonStats).length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Key Statistics ({season})</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(seasonStats).slice(0, 12).map(([key, value]) => (
                              <div key={key} className="border rounded p-3">
                                <div className="text-xs text-slate-600 mb-1">{key.replace(/_/g, ' ')}</div>
                                <div className="font-semibold">{formatStat(value)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {sleeperPlayer.rank_ecr && (
                        <div className="border-t pt-4">
                          <div className="text-sm">
                            <strong>Expert Consensus Rank:</strong> {sleeperPlayer.rank_ecr}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      Stats not available for this player. This may be because the player is not active or the data is not available from the API.
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="stats" activeValue={activeTab}>
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Season Statistics ({season})</h3>
                  {seasonStats ? (
                    <div className="overflow-x-auto">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Object.entries(seasonStats).map(([key, value]) => (
                          <div key={key} className="border rounded-lg p-4 bg-white">
                            <div className="text-xs text-slate-600 mb-2 font-medium">
                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                            <div className="text-xl font-bold">{formatStat(value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600">No statistics available for this season.</div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="gamelog" activeValue={activeTab}>
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Game Log ({season})</h3>
                  {gameLogs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b text-slate-600">
                            <th className="py-2 pr-4">Week</th>
                            <th className="py-2 pr-4">Date</th>
                            <th className="py-2 pr-4">Opponent</th>
                            <th className="py-2 pr-4">Home/Away</th>
                            <th className="py-2 pr-4">Result</th>
                            <th className="py-2 pr-4">Fantasy Pts</th>
                            <th className="py-2">Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gameLogs.map((game, idx) => {
                            const fixture = game.fixture || {}
                            const stats = game.statistics || []
                            const homeTeam = fixture.teams?.home || {}
                            const awayTeam = fixture.teams?.away || {}
                            const isHome = playerInfo.team?.id === homeTeam.id
                            const opponent = isHome ? awayTeam : homeTeam
                            const score = fixture.score?.fulltime || {}
                            
                            // Calculate fantasy points (simplified - would need league scoring settings)
                            let fantasyPoints = 0
                            const playerStats = stats[0]?.statistics || {}
                            
                            return (
                              <tr key={idx} className="border-b">
                                <td className="py-2 pr-4">{fixture.round?.split(' ')[1] || '-'}</td>
                                <td className="py-2 pr-4">{new Date(fixture.date).toLocaleDateString()}</td>
                                <td className="py-2 pr-4">{opponent.name || '-'}</td>
                                <td className="py-2 pr-4">{isHome ? 'Home' : 'Away'}</td>
                                <td className="py-2 pr-4">
                                  {score.home != null && score.away != null 
                                    ? `${score.home} - ${score.away}` 
                                    : '-'}
                                </td>
                                <td className="py-2 pr-4 font-medium">{fantasyPoints.toFixed(1)}</td>
                                <td className="py-2">
                                  <details className="text-xs">
                                    <summary className="cursor-pointer text-blue-600">View Stats</summary>
                                    <div className="mt-2 space-y-1 text-slate-600">
                                      {Object.entries(playerStats).slice(0, 5).map(([key, value]) => (
                                        <div key={key}>
                                          {key.replace(/_/g, ' ')}: {formatStat(value)}
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-slate-600">No game logs available for this season.</div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  )
}

