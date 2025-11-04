import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { getLeague, getLeagueUsers, getLeagueRosters, getAllPlayers, getNFLState, getLeagueMatchups } from './sleeper.js';
import { buildSuggestions } from './tradeSuggestions.js';

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

app.listen(PORT, () => {
  console.log(`Fantasy Exchange server running on http://localhost:${PORT}`);
});


