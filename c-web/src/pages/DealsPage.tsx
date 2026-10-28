import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPublicDeals } from '../utils/customerApi'
import { Icon } from '../components/Icon'

export function DealsPage() {
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [deals, setDeals] = useState<Array<{
    code: string
    name: string
    description?: string
    discount_type: string
    discount_value: number
    max_discount_amount?: number | null
    min_order_amount: number
    service_types: string[]
    deal_tag: string
    ends_at?: string
  }>>([])

  useEffect(() => {
    let mounted = true
    getPublicDeals().then((res) => {
      if (!mounted) return
      if (res.data?.data) {
        setDeals(res.data.data)
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <section className="page-section max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-2 mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-[#0f766e]">Exclusive Offers</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1f2d27]">Travel Deals & Promo Codes</h1>
        </div>
        <p className="text-sm text-[#5a6760]">
          Verified offers, seasonal markdowns, and promo codes applicable to tours, car rentals, and rides.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex flex-col justify-between rounded-2xl border border-[#ded8ca] bg-white p-6 shadow-sm animate-pulse space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-20 rounded-full bg-[#e8eae6]" />
                  <div className="h-4 w-24 rounded bg-[#e8eae6]" />
                </div>
                <div className="h-6 w-3/4 rounded bg-[#e8eae6]" />
                <div className="h-4 w-full rounded bg-[#e8eae6]" />
                <div className="flex gap-2 pt-2">
                  <div className="h-5 w-16 rounded bg-[#e8eae6]" />
                  <div className="h-5 w-20 rounded bg-[#e8eae6]" />
                </div>
              </div>
              <div className="h-11 w-full rounded-xl bg-[#e8eae6] mt-4" />
            </div>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="rounded-2xl border border-[#ded8ca] bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e4f3ef] text-[#0f766e] mb-3">
            <Icon name="tag" />
          </div>
          <h2 className="text-lg font-bold text-[#1f2d27]">All deals are currently claimed</h2>
          <p className="mt-1 text-xs text-[#65716a] max-w-sm mx-auto">
            Check back soon for festive flash sales, or check your Loyalty points balance for direct discounts.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/tours" className="rounded-full bg-[#102824] px-5 py-2 text-xs font-bold text-white hover:bg-[#1a3d37] transition">
              Explore Tours
            </Link>
            <Link to="/loyalty" className="rounded-full bg-[#e4f3ef] px-5 py-2 text-xs font-bold text-[#0f766e] hover:bg-[#d0ece5] transition">
              View Club Rewards
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {deals.map((deal) => (
            <div
              key={deal.code}
              className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#ded8ca] bg-white p-6 shadow-sm transition hover:border-[#0f766e]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="rounded-full bg-[#e4f3ef] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0f766e]">
                    {deal.deal_tag}
                  </span>
                  {deal.ends_at && (
                    <span className="text-[11px] font-medium text-[#65716a]">
                      Ends {new Date(deal.ends_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-[#1f2d27] mt-1">{deal.name}</h3>
                {deal.description && <p className="text-xs text-[#5a6760] mt-1 line-clamp-2">{deal.description}</p>}

                <div className="mt-4 flex flex-wrap gap-2">
                  {deal.service_types.map((type) => (
                    <span key={type} className="rounded-md bg-[#f4f2eb] px-2 py-0.5 text-[11px] font-semibold text-[#65716a] capitalize">
                      {type}
                    </span>
                  ))}
                  {deal.min_order_amount > 0 && (
                    <span className="text-[11px] text-[#65716a] self-center">
                      Min order ₹{deal.min_order_amount}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#f0ede6] pt-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-[#0f766e]">
                    {deal.discount_type === 'percentage' ? `${deal.discount_value}% OFF` : `₹${deal.discount_value} OFF`}
                  </span>
                  {deal.max_discount_amount && (
                    <span className="text-[11px] text-[#65716a]">(Up to ₹{deal.max_discount_amount})</span>
                  )}
                </div>

                <button
                  onClick={() => copyCode(deal.code)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#0f766e] bg-[#f7fbfa] px-3 py-1.5 text-xs font-mono font-bold text-[#0f766e] hover:bg-[#e4f3ef] transition"
                >
                  <span>{copiedCode === deal.code ? 'COPIED!' : deal.code}</span>
                  <Icon name="card" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
