import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button.jsx'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <header className="py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-blue-600"></div>
            <span className="text-lg font-semibold text-slate-900">Fantasy Exchange</span>
          </div>
          <Link to="/login"><Button size="sm">Sign in</Button></Link>
        </header>
        <main className="py-16 sm:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Smarter fantasy trades for your Sleeper league</h1>
            <p className="mt-4 text-slate-600 text-base sm:text-lg">Connect your league, see strengths and gaps, and get clean, actionable trade ideas.</p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link to="/login"><Button size="lg">Get started</Button></Link>
              <Button variant="outline" size="lg" onClick={(e)=>e.preventDefault()}>Learn more</Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}


