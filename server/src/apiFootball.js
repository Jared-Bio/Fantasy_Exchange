import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'https://api.sportsdata.io/v2/json';
const API_KEY = process.env.SPORTSDATA_API_KEY || '2b98195b2a3e4cf68bc1608978a8b491';

console.log('[SportsData] API Key loaded:', API_KEY ? 'SET' : 'NOT SET');

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Ocp-Apim-Subscription-Key': API_KEY,
  },
});

/**
 * Search for players by name
 */
export async function searchPlayer(name, team = null, season = 2024) {
  try {
    console.log(`[SportsData] Getting all players to search for: ${name}`);
    
    const { data } = await apiClient.get('/Players');
    
    if (!data) return [];
    
    // Filter players by name
    const filteredPlayers = data.filter(player => {
      const fullName = `${player.FirstName} ${player.LastName}`.toLowerCase();
      const searchName = name.toLowerCase();
      return fullName.includes(searchName);
    });
    
    console.log(`[SportsData] Found ${filteredPlayers.length} player(s) matching "${name}"`);
    return filteredPlayers.slice(0, 10); // Limit results
    
  } catch (err) {
    console.error('[SportsData] Error searching players:', err.message);
    return [];
  }
}

/**
 * Get player details and stats
 */
export async function getPlayerStats(playerId, season = 2024) {
  try {
    console.log(`[SportsData] Fetching player details for ID: ${playerId}`);
    
    const { data } = await apiClient.get(`/Player/${playerId}`);
    
    if (data) {
      console.log(`[SportsData] Player details found for ID ${playerId}`);
    } else {
      console.log(`[SportsData] No details found for player ID ${playerId}`);
    }
    
    return data || null;
  } catch (err) {
    console.error('[SportsData] Error fetching player details:', err.message);
    return null;
  }
}

/**
 * Get player seasonal stats
 */
export async function getPlayerSeasonStats(playerId, season = 2024) {
  try {
    console.log(`[SportsData] Fetching season stats for player ${playerId}, season ${season}`);
    
    const { data } = await apiClient.get(`/PlayerSeasonStatsByPlayerID/${season}/${playerId}`);
    
    return data || null;
  } catch (err) {
    console.error('[SportsData] Error fetching season stats:', err.message);
    return null;
  }
}

/**
 * Get player stats by Sleeper data (matching by name/team)
 */
export async function getPlayerStatsBySleeperData(sleeperPlayer, season = 2024) {
  const playerName = sleeperPlayer?.full_name || 
                    (sleeperPlayer?.first_name && sleeperPlayer?.last_name 
                      ? `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}` 
                      : null);
  
  if (!playerName) return null;

  // Search for player by name
  const players = await searchPlayer(playerName, null, season);
  
  if (players.length === 0) return null;
  
  // If we have team info from Sleeper, try to match by team
  if (sleeperPlayer?.team && players.length > 1) {
    const teamMatch = players.find(p => {
      const apiTeam = p.Team?.toUpperCase();
      const sleeperTeam = sleeperPlayer.team?.toUpperCase();
      return apiTeam?.includes(sleeperTeam) || sleeperTeam?.includes(apiTeam);
    });
    if (teamMatch) {
      return await getPlayerSeasonStats(teamMatch.PlayerID, season);
    }
  }
  
  // Return first match
  if (players[0]?.PlayerID) {
    const stats = await getPlayerSeasonStats(players[0].PlayerID, season);
    return stats;
  }
  
  return null;
}

/**
 * Get player game logs
 */
export async function getPlayerGameLogs(playerId, season = 2024) {
  try {
    console.log(`[SportsData] Fetching game logs for player ID: ${playerId}`);
    
    const { data } = await apiClient.get(`/PlayerGameStatsByPlayerID/${season}/${playerId}`);
    
    console.log(`[SportsData] Found ${data?.length || 0} game logs`);
    return data || [];
    
  } catch (err) {
    console.error('[SportsData] Error fetching game logs:', err.message);
    return [];
  }
}

export function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // NFL season starts in September
  if (month < 8) { // January-August
    return year - 1;
  }
  return year;
}