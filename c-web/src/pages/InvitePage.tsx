import { useEffect, useState } from 'react'
import { getReferralDetails } from '../utils/customerApi'
import { Icon } from '../components/Icon'

export function InvitePage() {
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [referral, setReferral] = useState<{
    referral_code: string
    referral_url: string
    total_referrals: number
    total_earned_points: number
    history: Array<{
      id: number
      status: string
      reward_points: number
      completed_at?: string
      created_at?: string
    }>
  }>({
    referral_code: '',
    referral_url: '',
    total_referrals: 0,
    total_earned_points: 0,
    history: [],
  })

  useEffect(() => {
    let mounted = true
    getReferralDetails().then((res) => {
      if (!mounted) return
      if (res.data?.data) {
        setReferral(res.data.data)
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  const handleCopy = () => {
    if (!referral.referral_code) return
    navigator.clipboard.writeText(referral.referral_url || referral.referral_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="page-section max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-2 mb-8 text-center max-w-xl mx-auto">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e4f3ef] text-[#0f766e]">
          <Icon name="gift" />
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1f2d27]">Invite Friends, Earn ₹50</h1>
        <p className="text-sm text-[#5a6760]">
          Share your referral invite link. When a friend signs up and takes their first trip, you both receive 500 Turiya Mobility loyalty points (worth ₹50)!
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-[#ded8ca] bg-white p-6 sm:p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-[#65716a] mb-2">Your Unique Invite Code</p>
        <div className="inline-flex items-center gap-3 rounded-xl border border-[#102824]/20 bg-[#f9f8f5] px-6 py-3">
          <span className="text-xl sm:text-2xl font-mono font-bold tracking-wider text-[#102824]">
            {loading ? 'LOADING…' : referral.referral_code}
          </span>
          <button
            onClick={handleCopy}
            disabled={loading}
            className="rounded-lg bg-[#0f766e] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#115e59] transition"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <div className="rounded-xl border border-[#ded8ca] bg-white p-5">
          <span className="text-xs font-bold uppercase text-[#65716a]">Total Invited</span>
          <div className="mt-1 text-2xl font-extrabold text-[#102824]">{referral.total_referrals}</div>
        </div>
        <div className="rounded-xl border border-[#ded8ca] bg-white p-5">
          <span className="text-xs font-bold uppercase text-[#65716a]">Points Earned</span>
          <div className="mt-1 text-2xl font-extrabold text-[#0f766e]">{referral.total_earned_points} pts</div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#ded8ca] bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#1f2d27] mb-4">Referral Activity</h2>
        {loading ? (
          <p className="py-6 text-center text-xs text-[#65716a]">Loading referral history…</p>
        ) : referral.history.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-semibold text-[#1f2d27]">No referral signups yet</p>
            <p className="mt-1 text-xs text-[#65716a]">Share your link with friends to get started!</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f0ede6]">
            {referral.history.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs font-bold text-[#1f2d27]">Referred Traveler</p>
                  <p className="text-[11px] text-[#65716a]">{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${item.status === 'rewarded' ? 'bg-[#d6f2ec] text-[#115e59]' : 'bg-[#f4f2eb] text-[#65716a]'}`}>
                    {item.status.toUpperCase()}
                  </span>
                  <p className="text-xs font-bold text-[#0f766e]">+{item.reward_points} pts</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
