import { useEffect, useState } from 'react'
import { estimateRide, type RideEstimatePayload } from '../../utils/customerApi'
import { LiveRideGoogleMap } from './LiveRideGoogleMap'

export function AvailableRideMap({ payload, deadline, serverTime }: { payload: RideEstimatePayload; deadline?: string; serverTime?: string }) {
  const [cars, setCars] = useState<Array<{ lat: number; lng: number }>>([])
  const [message, setMessage] = useState('Checking available cars…')
  const signature = JSON.stringify(payload)
  useEffect(() => {
    let stopped = false
    let busy = false
    let timer: number | undefined
    let expiryTimer: number | undefined
    let expired = false
    if (deadline) {
      const remaining = Date.parse(deadline) - (serverTime ? Date.parse(serverTime) : Date.now())
      const expire = () => { expired = true; setCars([]); setMessage('Search deadline reached. Checking final status…'); window.clearTimeout(timer) }
      if (remaining <= 0) expire()
      else if (Number.isFinite(remaining)) expiryTimer = window.setTimeout(expire, remaining)
    }
    async function refresh() {
      if (busy || stopped || expired || document.hidden) return
      window.clearTimeout(timer)
      busy = true
      const result = await estimateRide({ ...JSON.parse(signature), scheduled_at: new Date(Date.now() + 60000).toISOString() })
      busy = false
      if (stopped || expired) return
      const locations = result.error ? [] : result.data?.nearby_driver_locations ?? []
      setCars(locations)
      setMessage(result.error ? 'Available cars could not be refreshed. Retrying…' : locations.length ? 'Available cars near pickup' : 'No available cars nearby right now')
      timer = window.setTimeout(refresh, 15000)
    }
    function onVisibility() {
      if (document.hidden) { setCars([]); window.clearTimeout(timer) }
      else void refresh()
    }
    void refresh()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stopped = true; window.clearTimeout(timer); window.clearTimeout(expiryTimer); document.removeEventListener('visibilitychange', onVisibility) }
  }, [signature, deadline, serverTime])
  return <LiveRideGoogleMap nearbyDrivers={cars} status={message}
    pickup={{ latitude: payload.pickup_lat, longitude: payload.pickup_lng }}
    dropoff={{ latitude: payload.dropoff_lat, longitude: payload.dropoff_lng }} />
}
