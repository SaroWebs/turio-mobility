import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../utils/api'

type Invitation = { id: number; name: string; phone: string; status: string }
type SharedTour = { title: string; status: string; travel_date: string; pickup: string; days: { day: number; title: string; details: string }[] }

export function TourSharingPage() {
  const { id } = useParams()
  const [shares, setShares] = useState<Invitation[]>([])
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true
    apiRequest<{ data: Invitation[] }>(`/tour-bookings/${id}/shares`).then(result => {
      if (!active) return
      if (result.error) setMessage(result.error)
      else setShares(result.data?.data ?? [])
    })
    return () => { active = false }
  }, [id, version])
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setLink('')
    const result = await apiRequest<{ data: { token: string } }>(`/tour-bookings/${id}/shares`, {
      method: 'POST', body: JSON.stringify({ name: form.get('name'), phone: form.get('phone') }),
    })
    setBusy(false)
    setMessage(result.error || 'Invitation ready. Share this link with the person you invited.')
    if (result.data) { setLink(`${window.location.origin}/shared-tour#${result.data.data.token}`); setVersion(value => value + 1) }
  }
  async function revoke(share: Invitation) {
    setBusy(true)
    const result = await apiRequest(`/tour-bookings/${id}/shares/${share.id}`, { method: 'DELETE' })
    setBusy(false)
    setMessage(result.error || `Sharing stopped for ${share.name}.`)
    if (!result.error) { setLink(''); setVersion(value => value + 1) }
  }
  return <section className="page-section mx-auto max-w-2xl px-5 py-12">
    <Link to="/bookings" className="text-[#115e59] underline">My Bookings</Link>
    <h1 className="mt-6">Share tour with family or friends</h1>
    <p className="my-4">Invite up to 5 people to view your tour plan and status. They must verify the mobile number you enter. They cannot change your booking or see your payment details.</p>
    <form onSubmit={invite} className="grid gap-4 rounded-2xl border border-[#ded8ca] bg-white p-5">
      <label>Name<input name="name" autoComplete="off" required maxLength={80} /></label>
      <label>Indian mobile number<input name="phone" type="tel" inputMode="tel" placeholder="9876543210" required maxLength={20} /></label>
      <button className="button button-primary" disabled={busy}>Create invitation</button>
    </form>
    <p role="status" className="my-4">{message}</p>
    {link ? <label>Invitation link<input readOnly value={link} onFocus={event => event.target.select()} /><small>Copy and send this link. It expires within 24 hours or when the tour starts.</small></label> : null}
    <h2 className="my-6">People you have invited</h2>
    <ul className="grid gap-3">{shares.map(share => <li className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#ded8ca] p-4" key={share.id}>
      <div><strong>{share.name}</strong><p>{share.phone} · {share.status}</p></div>
      {['Invited', 'Verified'].includes(share.status) ? <button className="button button-secondary" disabled={busy} onClick={() => revoke(share)}>Stop sharing</button> : null}
    </li>)}</ul>
  </section>
}

export function SharedTourPage() {
  const [token] = useState(() => window.location.hash.slice(1))
  const [session, setSession] = useState(() => window.sessionStorage.getItem(`tour-share:${window.location.hash.slice(1)}`) || '')
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [tour, setTour] = useState<SharedTour | null>(null)
  useEffect(() => {
    if (!session) return
    let active = true
    const refresh = async () => {
      const result = await apiRequest<{ data: SharedTour }>('/tour-shares/view', { headers: { 'X-Tour-Share-Session': session }, cache: 'no-store' })
      if (!active) return
      setTour(result.data?.data ?? null)
      setMessage(result.error || '')
      if (result.status === 404) { window.sessionStorage.removeItem(`tour-share:${token}`); setSession('') }
    }
    void refresh()
    const timer = window.setInterval(refresh, 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [session, token])
  async function send() {
    setBusy(true)
    const result = await apiRequest('/tour-shares/otp', { method: 'POST', body: JSON.stringify({ token, phone }) })
    setBusy(false)
    setMessage(result.error || 'OTP sent. Please check your messages.')
    if (!result.error) setSent(true)
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = new FormData(event.currentTarget).get('code')
    setBusy(true)
    const result = await apiRequest<{ data: { session: string } }>('/tour-shares/verify', { method: 'POST', body: JSON.stringify({ token, phone, code }) })
    setBusy(false)
    setMessage(result.error || '')
    if (result.data) { window.sessionStorage.setItem(`tour-share:${token}`, result.data.data.session); setSession(result.data.data.session) }
  }
  return <section className="page-section mx-auto max-w-2xl px-5 py-12">
    <h1>{tour?.title || 'A tour shared with you'}</h1>
    <p role="status" className="my-4">{message}</p>
    {!session ? <div className="rounded-2xl border border-[#ded8ca] bg-white p-5">
      <p className="mb-4">Verify the mobile number your family member or friend invited. You can view the tour plan and status.</p>
      <label>Invited mobile number<input type="tel" value={phone} maxLength={20} onChange={event => { setPhone(event.target.value); setSent(false) }} /></label>
      <button className="button button-secondary my-4" disabled={busy || !phone || token.length !== 64} onClick={send}>{sent ? 'Send a new OTP' : 'Send OTP'}</button>
      {sent ? <form className="grid gap-4" onSubmit={verify}><label>Enter the 6-digit OTP<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label><button className="button button-primary" disabled={busy}>Verify mobile number</button></form> : null}
    </div> : tour ? <div>
      <p className="my-4">{tour.travel_date} · {tour.status.replaceAll('_', ' ')}</p><p>Pickup point: {tour.pickup}</p>
      <h2 className="my-6">Day-by-day plan</h2><ol className="grid gap-4">{tour.days.map((day, index) => <li key={index} className="rounded-xl border border-[#ded8ca] bg-white p-5"><h3>Day {day.day}: {day.title}</h3><p>{day.details}</p></li>)}</ol>
      <p className="my-6 text-sm">View-only access. For changes, contact the person who booked this tour.</p>
    </div> : <p>Loading tour...</p>}
  </section>
}
