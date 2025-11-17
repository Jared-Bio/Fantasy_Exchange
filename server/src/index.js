import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { getLeague, getLeagueUsers, getLeagueRosters, getAllPlayers, getNFLState, getLeagueMatchups } from './sleeper.js';
import { buildSuggestions } from './tradeSuggestions.js';
import { getPlayerStatsBySleeperData, getPlayerStats, getPlayerGameLogs, getCurrentSeason, searchPlayer } from './apiFootball.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/league/:leagueId', async (req, res) => {
  try {
    const league = await getLeague(req.params.leagueId);
    res.json(league);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch league', details: err.message });
  }
});

app.get('/api/league/:leagueId/users', async (req, res) => {
  try {
    const users = await getLeagueUsers(req.params.leagueId);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

app.get('/api/league/:leagueId/rosters', async (req, res) => {
  try {
    const rosters = await getLeagueRosters(req.params.leagueId);
    res.json(rosters);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rosters', details: err.message });
  }
});

app.get('/api/players', async (req, res) => {
  try {
    const players = await getAllPlayers();
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch players', details: err.message });
  }
});

app.get('/api/state/nfl', async (req, res) => {
  try {
    const state = await getNFLState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch NFL state', details: err.message });
  }
});

app.get('/api/league/:leagueId/matchups/:week', async (req, res) => {
  try {
    const data = await getLeagueMatchups(req.params.leagueId, req.params.week);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch matchups', details: err.message });
  }
});

app.get('/api/league/:leagueId/suggestions', async (req, res) => {
  try {
    const leagueId = req.params.leagueId;
    const [league, users, rosters] = await Promise.all([
      getLeague(leagueId),
      getLeagueUsers(leagueId),
      getLeagueRosters(leagueId)
    ]);

    // Optional heavy endpoint, guard with query flag if needed
    let players = null;
    if (req.query.includePlayers === '1') {
      players = await getAllPlayers();
    }

    const suggestions = buildSuggestions({ league, users, rosters, players });
    res.json({ league, users, rosters, suggestions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build suggestions', details: err.message });
  }
});

// API-football endpoints
app.get('/api/player/stats/:sleeperPlayerId', async (req, res) => {
  try {
    const sleeperPlayerId = req.params.sleeperPlayerId;
    const season = req.query.season ? parseInt(req.query.season) : getCurrentSeason();
    
    console.log(`[API] Fetching stats for player ${sleeperPlayerId}, season ${season}`);
    
    // First, get Sleeper player data
    const allPlayers = await getAllPlayers();
    const sleeperPlayer = allPlayers[sleeperPlayerId];
    
    if (!sleeperPlayer) {
      console.log(`[API] Player ${sleeperPlayerId} not found in Sleeper data`);
      return res.status(404).json({ error: 'Player not found in Sleeper data' });
    }
    
    console.log(`[API] Sleeper player found: ${sleeperPlayer.full_name || sleeperPlayer.first_name + ' ' + sleeperPlayer.last_name}`);
    
    // Get stats from API-football
    const stats = await getPlayerStatsBySleeperData(sleeperPlayer, season);
    
    if (!stats) {
      console.log(`[API] Stats not found in API-football for ${sleeperPlayer.full_name || sleeperPlayer.first_name + ' ' + sleeperPlayer.last_name}`);
      return res.status(404).json({ error: 'Player stats not found in API-football' });
    }
    
    console.log(`[API] Stats found successfully`);
    res.json({ sleeperPlayer, apiFootballStats: stats, season });
  } catch (err) {
    console.error('[API] Error fetching player stats:', err);
    res.status(500).json({ error: 'Failed to fetch player stats', details: err.message });
  }
});

app.get('/api/player/gamelogs/:sleeperPlayerId', async (req, res) => {
  try {
    const sleeperPlayerId = req.params.sleeperPlayerId;
    const season = req.query.season ? parseInt(req.query.season) : getCurrentSeason();
    
    console.log(`[API] Fetching game logs for player ${sleeperPlayerId}, season ${season}`);
    
    // First, get Sleeper player data to find API-football ID
    const allPlayers = await getAllPlayers();
    const sleeperPlayer = allPlayers[sleeperPlayerId];
    
    if (!sleeperPlayer) {
      console.log(`[API] Player ${sleeperPlayerId} not found in Sleeper data`);
      return res.status(404).json({ error: 'Player not found in Sleeper data' });
    }
    
    console.log(`[API] Sleeper player found: ${sleeperPlayer.full_name || sleeperPlayer.first_name + ' ' + sleeperPlayer.last_name}`);
    
    // Get API-football player data
    const apiFootballData = await getPlayerStatsBySleeperData(sleeperPlayer, season);
    
    if (!apiFootballData || !apiFootballData.player?.id) {
      console.log(`[API] Player not found in API-football for game logs`);
      // Return empty array instead of 404 so the page can still load
      return res.json({ gameLogs: [], season, error: 'Player stats not found in API-football' });
    }
    
    console.log(`[API] API-football player ID: ${apiFootballData.player.id}`);
    
    // Get game logs
    const gameLogs = await getPlayerGameLogs(apiFootballData.player.id, season);
    
    console.log(`[API] Found ${gameLogs.length} game logs`);
    res.json({ gameLogs, season });
  } catch (err) {
    console.error('[API] Error fetching game logs:', err);
    res.status(500).json({ error: 'Failed to fetch game logs', details: err.message, gameLogs: [] });
  }
});

app.get('/api/player/search', async (req, res) => {
  try {
    const { name, team, season } = req.query;
    const searchSeason = season ? parseInt(season) : getCurrentSeason();
    
    const results = await searchPlayer(name, team, searchSeason);
    res.json({ results, season: searchSeason });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search players', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Fantasy Exchange server running on http://localhost:${PORT}`);
});


