import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export function RideSearchStatus({ deadline, serverTime }: { deadline: string; serverTime?: string }) {
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(() => {
    const end = Date.parse(deadline)
    const serverNow = serverTime ? Date.parse(serverTime) : Date.now()
    const received = performance.now()
    const update = () => setRemaining(Number.isFinite(end) && Number.isFinite(serverNow)
      ? Math.max(0, Math.ceil((end - serverNow - (performance.now() - received)) / 1000)) : null)
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [deadline, serverTime])

  if (remaining === null) return <p>Checking the search deadline…</p>
  if (remaining === 0) return <p role="status">The search deadline has passed. Checking for a final driver response. <Link to="/rides">Search again</Link></p>
  return <p>Looking for an available car. Time remaining: <strong role="timer">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong></p>
}
