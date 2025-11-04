function computeTeamPositionCounts(roster) {
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, BN: 0, DST: 0, K: 0, IDP: 0, UNKNOWN: 0 };
  const players = roster.players || [];
  for (const pid of players) {
    // Without full players map, we can infer using simple id prefixes as a placeholder
    // This is dummy logic; real logic would map pid -> position
    if (typeof pid === 'string') {
      if (pid.startsWith('QB')) counts.QB++;
      else if (pid.startsWith('RB')) counts.RB++;
      else if (pid.startsWith('WR')) counts.WR++;
      else if (pid.startsWith('TE')) counts.TE++;
      else counts.UNKNOWN++;
    } else {
      counts.UNKNOWN++;
    }
  }
  return counts;
}

function deriveNeeds(counts) {
  // Heuristic thresholds for deficits and surpluses
  const target = { QB: 2, RB: 4, WR: 5, TE: 2 };
  const needs = { surplus: [], deficit: [] };
  for (const pos of Object.keys(target)) {
    const have = counts[pos] || 0;
    if (have - target[pos] >= 2) needs.surplus.push(pos);
    if (target[pos] - have >= 1) needs.deficit.push(pos);
  }
  return needs;
}

export function buildSuggestions({ league, users, rosters, players }) {
  // Map roster_id -> user/team display name
  const rosterIdToUser = new Map();
  const userIdToName = new Map();
  for (const u of users || []) {
    userIdToName.set(u.user_id, u.display_name || 'Unknown');
  }
  for (const r of rosters || []) {
    const name = userIdToName.get(r.owner_id) || `Team ${r.roster_id}`;
    rosterIdToUser.set(r.roster_id, name);
  }

  // Build positional profiles
  const profiles = rosters.map(r => {
    const counts = computeTeamPositionCounts(r);
    const needs = deriveNeeds(counts);
    return { roster: r, counts, needs, name: rosterIdToUser.get(r.roster_id) };
  });

  // Naive suggestion: pair teams where one's surplus matches other's deficit
  const suggestions = [];
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const A = profiles[i];
      const B = profiles[j];
      for (const posA of A.needs.deficit) {
        if (B.needs.surplus.includes(posA)) {
          // Suggest B trades position posA to A
          suggestions.push({
            fromTeam: B.name,
            toTeam: A.name,
            position: posA,
            note: `${A.name} needs ${posA}; ${B.name} has surplus ${posA}.`
          });
        }
      }
      for (const posB of B.needs.deficit) {
        if (A.needs.surplus.includes(posB)) {
          suggestions.push({
            fromTeam: A.name,
            toTeam: B.name,
            position: posB,
            note: `${B.name} needs ${posB}; ${A.name} has surplus ${posB}.`
          });
        }
      }
    }
  }

  // Limit output for MVP
  return suggestions.slice(0, 25);
}


