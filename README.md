# Fantasy Exchange (MVP)

A Fantasy Football Trade Helper web app. Enter a Sleeper League ID to fetch league data and get basic trade suggestions.

## Stack
- Backend: Node + Express
- Frontend: React + Vite + TailwindCSS

## Getting Started

### Prerequisites
- Node.js 18+

### Install

From the project root:

```bash
cd server && npm install
cd ../client && npm install
```

### Run (Dev)

In two terminals:

```bash
# Terminal 1
cd server
npm run dev
# server runs on http://localhost:4000

# Terminal 2
cd client
npm run dev
# frontend runs on http://localhost:5173
```

### Environment

Backend supports `PORT` (optional). Frontend can set `VITE_API_BASE` (default `http://localhost:4000/api`).

Create `client/.env` if you want to override API base:
```env
VITE_API_BASE=http://localhost:4000/api
```

## API Endpoints (Backend)
- `GET /api/health`
- `GET /api/league/:leagueId`
- `GET /api/league/:leagueId/users`
- `GET /api/league/:leagueId/rosters`
- `GET /api/league/:leagueId/suggestions` (returns league/users/rosters and naive suggestions)

## Notes
- Player position inference is dummy for MVP; improve by mapping `players/nfl` to positions.
- Add caching later to reduce Sleeper API calls.
# Fantasy_Exchange
Fantasy Football trade helper utilizing Sleeper API.
