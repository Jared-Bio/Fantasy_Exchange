import axios from 'axios';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

export async function getLeague(leagueId) {
  const { data } = await axios.get(`${SLEEPER_BASE}/league/${leagueId}`);
  return data;
}

export async function getLeagueUsers(leagueId) {
  const { data } = await axios.get(`${SLEEPER_BASE}/league/${leagueId}/users`);
  return data;
}

export async function getLeagueRosters(leagueId) {
  const { data } = await axios.get(`${SLEEPER_BASE}/league/${leagueId}/rosters`);
  return data;
}

export async function getAllPlayers() {
  const { data } = await axios.get(`${SLEEPER_BASE}/players/nfl`);
  return data;
}


