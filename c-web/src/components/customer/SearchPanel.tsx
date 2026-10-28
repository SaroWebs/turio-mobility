import { type FormEvent, useState } from 'react'
import { Icon } from '../Icon'
import { Button } from './Button'

export interface SearchPanelProps {
  initialQuery?: string
  initialDate?: string
  initialGuests?: number | string
  initialDifficulty?: string
  showDifficulty?: boolean
  onSearch?: (data: { q: string; date: string; guests: string; difficulty?: string }) => void
  className?: string
  compact?: boolean
}

export function SearchPanel({
  initialQuery = '',
  initialDate = '',
  initialGuests = 2,
  initialDifficulty = '',
  showDifficulty = true,
  onSearch,
  className = '',
  compact = false,
}: SearchPanelProps) {
  const [showMore, setShowMore] = useState(Boolean(initialDifficulty))

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (onSearch) {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      onSearch({
        q: String(data.get('q') || '').trim(),
        date: String(data.get('date') || '').trim(),
        guests: String(data.get('guests') || '2').trim(),
        difficulty: String(data.get('difficulty') || '').trim(),
      })
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-2xl border border-[#dbe1dc] bg-white p-5 shadow-sm transition-all sm:p-6 ${className}`}
    >
      <div
        className={`grid gap-4 ${
          compact
            ? 'sm:grid-cols-2 lg:grid-cols-4'
            : 'sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_0.8fr_auto]'
        }`}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="search-q" className="text-sm font-semibold text-[#13231f]">
            Where would you like to go?
          </label>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3.5 text-[#5b6964]">
              <Icon name="search" />
            </span>
            <input
              id="search-q"
              name="q"
              type="search"
              defaultValue={initialQuery}
              placeholder="Try Tawang, Shillong, or Kaziranga"
              maxLength={120}
              className="min-h-[48px] w-full rounded-lg border border-[#dbe1dc] bg-white pl-10 pr-3.5 py-2.5 text-base text-[#13231f] placeholder:text-[#8a9893] transition-colors focus:border-[#0d7769] focus:outline-3 focus:outline-[#0d7769]/20"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="search-date" className="text-sm font-semibold text-[#13231f]">
              Travel date
            </label>
            <span className="text-xs text-[#5b6964]">Optional</span>
          </div>
          <input
            id="search-date"
            name="date"
            type="date"
            defaultValue={initialDate}
            className="min-h-[48px] w-full rounded-lg border border-[#dbe1dc] bg-white px-3.5 py-2.5 text-base text-[#13231f] transition-colors focus:border-[#0d7769] focus:outline-3 focus:outline-[#0d7769]/20"
          />
          <small className="text-xs text-[#5b6964]">Leave blank if you are flexible.</small>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="search-guests" className="text-sm font-semibold text-[#13231f]">
            Travellers
          </label>
          <input
            id="search-guests"
            name="guests"
            type="number"
            min="1"
            max="200"
            defaultValue={initialGuests}
            required
            className="min-h-[48px] w-full rounded-lg border border-[#dbe1dc] bg-white px-3.5 py-2.5 text-base text-[#13231f] transition-colors focus:border-[#0d7769] focus:outline-3 focus:outline-[#0d7769]/20"
          />
        </div>

        <div className="flex items-end pt-1">
          <Button
            type="submit"
            size="lg"
            fullWidth
            icon={<Icon name="search" />}
            className="min-h-[48px]"
          >
            Find tours
          </Button>
        </div>
      </div>

      {showDifficulty && (
        <div className="mt-4 border-t border-[#f0f3f1] pt-3">
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5b6964] hover:text-[#0d7769] transition-colors"
          >
            <span>More choices</span>
            <span
              className={`transform transition-transform duration-200 ${
                showMore ? 'rotate-180' : ''
              }`}
            >
              ▼
            </span>
          </button>

          {showMore && (
            <div className="mt-3 grid max-w-sm gap-1.5 animate-fadeIn">
              <label htmlFor="search-difficulty" className="text-xs font-medium text-[#5b6964]">
                Tour difficulty
              </label>
              <select
                id="search-difficulty"
                name="difficulty"
                defaultValue={initialDifficulty}
                className="min-h-[44px] rounded-lg border border-[#dbe1dc] bg-white px-3 py-2 text-sm text-[#13231f] focus:border-[#0d7769] focus:outline-3 focus:outline-[#0d7769]/20"
              >
                <option value="">All difficulty levels</option>
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="challenging">Challenging</option>
                <option value="extreme">Extreme</option>
              </select>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
