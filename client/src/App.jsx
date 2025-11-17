import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import TradeCalculator from './pages/TradeCalculator.jsx'
import PlayerStatSheet from './pages/PlayerStatSheet.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/trade-calculator" element={<RequireAuth><TradeCalculator /></RequireAuth>} />
          <Route path="/player/:playerId" element={<RequireAuth><PlayerStatSheet /></RequireAuth>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}


