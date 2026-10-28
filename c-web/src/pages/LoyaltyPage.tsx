import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLoyaltyPoints } from '../utils/customerApi'
import { Icon } from '../components/Icon'

export function LoyaltyPage() {
  const [loading, setLoading] = useState(true)
  const [loyalty, setLoyalty] = useState<{
    total_points: number
    rupee_value: number
    tier: string
    history: Array<{
      id: number
      points: number
      action: string
      reference_type?: string
      reference_id?: number
      description?: string
      created_at?: string
    }>
  }>({
    total_points: 0,
    rupee_value: 0,
    tier: 'Silver',
    history: [],
  })

  useEffect(() => {
    let mounted = true
    getLoyaltyPoints().then((res) => {
      if (!mounted) return
      if (res.data?.data) {
        setLoyalty(res.data.data)
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <section className="page-section max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-2 mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-[#0f766e]">Turiya Mobility Rewards</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1f2d27]">Loyalty & Club</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e4f3ef] px-3.5 py-1 text-xs font-bold text-[#0f766e]">
            <Icon name="star" /> {loyalty.tier} Member
          </span>
        </div>
        <p className="text-sm text-[#5a6760]">
          Earn 10 points for every ₹100 spent across rides, tours, and rentals. 10 points = ₹1 off future trips.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 mb-8">
        <div className="rounded-2xl border border-[#ded8ca] bg-white p-6 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-[#65716a]">Available Points</span>
          <div className="mt-2 text-3xl font-extrabold text-[#102824]">
            {loading ? <span className="inline-block h-8 w-20 rounded bg-[#e8eae6] animate-pulse" /> : loyalty.total_points.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-[#52796f]">No expiration on active accounts</p>
        </div>

        <div className="rounded-2xl border border-[#ded8ca] bg-white p-6 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-[#65716a]">Redemption Value</span>
          <div className="mt-2 text-3xl font-extrabold text-[#0f766e]">
            {loading ? <span className="inline-block h-8 w-24 rounded bg-[#e8eae6] animate-pulse" /> : `₹${loyalty.rupee_value.toLocaleString()}`}
          </div>
          <p className="mt-1 text-xs text-[#65716a]">Auto-applied at checkout</p>
        </div>

        <div className="rounded-2xl border border-[#ded8ca] bg-[#102824] p-6 text-white shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#9cddcf]">Next Tier</span>
            <div className="mt-2 text-lg font-bold text-white">
              {loading ? (
                <span className="inline-block h-6 w-32 rounded bg-[#204038] animate-pulse" />
              ) : loyalty.tier === 'Platinum' ? (
                'Top Tier Achieved'
              ) : loyalty.tier === 'Gold' ? (
                'Platinum Tier (5,000 pts)'
              ) : (
                'Gold Tier (2,000 pts)'
              )}
            </div>
          </div>
          <Link
            to="/invite"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#9cddcf] px-4 py-2 text-xs font-bold text-[#102824] hover:bg-[#b5e7dc] transition"
          >
            <Icon name="gift" /> Refer friends for +500 pts
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-[#ded8ca] bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#1f2d27] mb-4">Points History</h2>
        {loading ? (
          <div className="space-y-3 py-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3.5 border-b border-[#f0ede6]">
                <div className="space-y-1.5">
                  <div className="h-4 w-40 rounded bg-[#e8eae6]" />
                  <div className="h-3 w-24 rounded bg-[#e8eae6]" />
                </div>
                <div className="h-5 w-16 rounded bg-[#e8eae6]" />
              </div>
            ))}
          </div>
        ) : loyalty.history.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-[#1f2d27]">No rewards activity yet</p>
            <p className="mt-1 text-xs text-[#65716a]">Complete your first ride or tour to start earning loyalty points!</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f0ede6]">
            {loyalty.history.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3.5">
                <div>
                  <p className="text-sm font-bold text-[#1f2d27]">{item.description || item.action.replace('_', ' ')}</p>
                  <p className="text-xs text-[#65716a]">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                  </p>
                </div>
                <span
                  className={`text-sm font-extrabold ${
                    item.points >= 0 ? 'text-[#0f766e]' : 'text-[#b91c1c]'
                  }`}
                >
                  {item.points >= 0 ? `+${item.points}` : item.points} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
