import { useState } from 'react'

export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED'

export interface ExchangeRates {
  [key: string]: number
}

// Approximate indicative rates relative to INR
const RATES: Record<Currency, { rate: number; symbol: string }> = {
  INR: { rate: 1, symbol: '₹' },
  USD: { rate: 0.012, symbol: '$' },
  EUR: { rate: 0.011, symbol: '€' },
  GBP: { rate: 0.0095, symbol: '£' },
  AED: { rate: 0.044, symbol: 'AED ' },
}

export function CurrencySelector() {
  const [currency, setCurrency] = useState<Currency>(() => {
    try {
      const stored = localStorage.getItem('hm_currency') as Currency
      return stored && RATES[stored] ? stored : 'INR'
    } catch {
      return 'INR'
    }
  })
  const [open, setOpen] = useState(false)

  const handleSelect = (c: Currency) => {
    setCurrency(c)
    try {
      localStorage.setItem('hm_currency', c)
    } catch {
      // ignore
    }
    setOpen(false)
    window.dispatchEvent(new CustomEvent('currency-changed', { detail: c }))
  }

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 rounded-full border border-[#ded8ca] bg-white px-2.5 py-1 text-xs font-bold text-[#4f5e58] hover:border-[#0f766e] transition"
        title="Select display currency"
        aria-label="Display currency"
      >
        <span>{RATES[currency].symbol}</span>
        <span>{currency}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 z-50 min-w-[120px] rounded-lg border border-[#ded8ca] bg-white p-1 shadow-lg">
          {(Object.keys(RATES) as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => handleSelect(c)}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                c === currency ? 'bg-[#e4f3ef] text-[#0f766e]' : 'text-[#4f5e58] hover:bg-[#f4f2eb]'
              }`}
            >
              <span>{c}</span>
              <span className="text-[#65716a]">{RATES[c].symbol}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
