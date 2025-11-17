import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY || '9b47a309904b7de3d1a4419e488c85d2';

console.log('[API-Football] API Key loaded:', API_KEY ? `${API_KEY.substring(0, 8)}...` : 'NOT SET');

const apiClient = axios.create({
  baseURL: API_FOOTBALL_BASE,
  headers: {
    'x-apisports-key': API_KEY,
  },
});

/**
 * Search for a player by name, team, and position
 * @param {string} name - Player name
 * @param {string} team - Team abbreviation (optional)
 * @param {number} season - Season year (e.g., 2024)
 */
export async function searchPlayer(name, team = null, season = 2024) {
  try {
    // Cap season at 2024 for now - free API may not have 2025 data
    const searchSeason = Math.min(season, 2024);
    
    const params = {
      search: name,
      season: searchSeason,
      league: 1, // NFL league ID
    };
    if (team) params.team = team;

    console.log(`[API-Football] Searching player: ${name}, season: ${searchSeason}`);
    const { data } = await apiClient.get('/players', { params });
    
    // Log response for debugging
    if (data?.errors && data.errors.length > 0) {
      console.error('[API-Football] API errors:', JSON.stringify(data.errors, null, 2));
    }
    
    if (data?.response && data.response.length > 0) {
      console.log(`[API-Football] Found ${data.response.length} player(s) matching "${name}"`);
    } else {
      console.log(`[API-Football] No players found matching "${name}"`);
    }
    
    return data?.response || [];
  } catch (err) {
    console.error('[API-Football] Error searching player:', err.message);
    if (err.response) {
      console.error('[API-Football] Response Status:', err.response.status);
      console.error('[API-Football] Response Data:', JSON.stringify(err.response.data, null, 2));
    } else if (err.request) {
      console.error('[API-Football] No response received. Request:', err.request);
    }
    return [];
  }
}

/**
 * Get player statistics for a specific season
 * @param {number} playerId - API-football player ID
 * @param {number} season - Season year (e.g., 2024)
 */
export async function getPlayerStats(playerId, season = 2024) {
  try {
    // Cap season at 2024 for now - free API may not have 2025 data
    const searchSeason = Math.min(season, 2024);
    
    console.log(`[API-Football] Fetching stats for player ID: ${playerId}, season: ${searchSeason}`);
    const { data } = await apiClient.get('/players', {
      params: {
        id: playerId,
        season: searchSeason,
        league: 1, // NFL league ID
      },
    });
    
    // Log response for debugging
    if (data?.errors && data.errors.length > 0) {
      console.error('[API-Football] API errors:', JSON.stringify(data.errors, null, 2));
    }
    
    if (data?.response?.[0]) {
      console.log(`[API-Football] Stats found for player ID ${playerId}`);
    } else {
      console.log(`[API-Football] No stats found for player ID ${playerId}`);
    }
    
    return data?.response?.[0] || null;
  } catch (err) {
    console.error('[API-Football] Error fetching player stats:', err.message);
    if (err.response) {
      console.error('[API-Football] Response Status:', err.response.status);
      console.error('[API-Football] Response Data:', JSON.stringify(err.response.data, null, 2));
    } else if (err.request) {
      console.error('[API-Football] No response received');
    }
    return null;
  }
}

/**
 * Get player statistics by searching name and matching team
 * This is useful when we have Sleeper player data but need API-football stats
 * @param {object} sleeperPlayer - Sleeper player object
 * @param {number} season - Season year (e.g., 2024)
 */
export async function getPlayerStatsBySleeperData(sleeperPlayer, season = 2024) {
  const playerName = sleeperPlayer?.full_name || 
                    (sleeperPlayer?.first_name && sleeperPlayer?.last_name 
                      ? `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}` 
                      : null);
  
  if (!playerName) return null;

  // Try to find player by name
  const players = await searchPlayer(playerName, null, season);
  
  if (players.length === 0) return null;
  
  // If we have team info from Sleeper, try to match by team
  // Sleeper uses team abbreviations like "KC", "SF", etc.
  if (sleeperPlayer?.team && players.length > 1) {
    const teamMatch = players.find(p => {
      const apiTeam = p?.team?.code || p?.team?.name?.toUpperCase();
      const sleeperTeam = sleeperPlayer.team?.toUpperCase();
      return apiTeam?.includes(sleeperTeam) || sleeperTeam?.includes(apiTeam);
    });
    if (teamMatch) {
      return await getPlayerStats(teamMatch.player.id, season);
    }
  }
  
  // Return first match or best guess
  if (players[0]?.player?.id) {
    const stats = await getPlayerStats(players[0].player.id, season);
    return stats;
  }
  
  return null;
}

/**
 * Get player game logs for a season
 * @param {number} playerId - API-football player ID
 * @param {number} season - Season year (e.g., 2024)
 */
export async function getPlayerGameLogs(playerId, season = 2024) {
  try {
    // Cap season at 2024 for now - free API may not have 2025 data
    const searchSeason = Math.min(season, 2024);
    
    console.log(`[API-Football] Fetching game logs for player ID: ${playerId}, season: ${searchSeason}`);
    const { data } = await apiClient.get('/fixtures/players', {
      params: {
        player: playerId,
        season: searchSeason,
        league: 1, // NFL league ID
      },
    });
    
    // Log response for debugging
    if (data?.errors && data.errors.length > 0) {
      console.error('[API-Football] API errors:', JSON.stringify(data.errors, null, 2));
    }
    
    if (data?.response) {
      console.log(`[API-Football] Found ${data.response.length} game logs`);
    } else {
      console.log(`[API-Football] No game logs found`);
    }
    
    return data?.response || [];
  } catch (err) {
    console.error('[API-Football] Error fetching game logs:', err.message);
    if (err.response) {
      console.error('[API-Football] Response Status:', err.response.status);
      console.error('[API-Football] Response Data:', JSON.stringify(err.response.data, null, 2));
    } else if (err.request) {
      console.error('[API-Football] No response received');
    }
    return [];
  }
}

/**
 * Get current season year
 */
export function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11, where 0 = January
  
  // NFL season starts in September, so if it's before September, use previous year
  // For 2025, if it's early in the year, use 2024 season
  if (month < 8) { // January (0) through August (7)
    const prevYear = year - 1;
    // Cap at 2024 since 2025 season data may not be available
    return Math.min(prevYear, 2024);
  }
  // If we're in the NFL season (Sept-Dec), use current year
  // But cap at 2024 for now since 2025 season hasn't started or data may be limited
  return Math.min(year, 2024);
}

/**
 * Get all available seasons for a player
 */
export async function getPlayerSeasons(playerId) {
  try {
    const { data } = await apiClient.get('/players/seasons', {
      params: {
        player: playerId,
      },
    });
    return data?.response || [];
  } catch (err) {
    console.error('Error fetching player seasons:', err.message);
    return [];
  }
}

