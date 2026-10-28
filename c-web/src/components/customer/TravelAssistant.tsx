import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../Icon'

interface AssistantProps {
  isOpen: boolean
  onClose: () => void
}

export function TravelAssistant({ isOpen, onClose }: AssistantProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [answers, setAnswers] = useState<{
    difficulty: string
    duration: string
    interest: string
  }>({
    difficulty: '',
    duration: '',
    interest: '',
  })

  if (!isOpen) return null

  const handleFinish = () => {
    const params = new URLSearchParams()
    if (answers.difficulty) params.set('difficulty', answers.difficulty)
    if (answers.duration) params.set('duration', answers.duration)
    if (answers.interest) params.set('q', answers.interest)
    navigate(`/tours?${params.toString()}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#ded8ca] bg-white p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[#65716a] hover:bg-[#f4f2eb] transition"
          aria-label="Close assistant"
        >
          <Icon name="x" />
        </button>

        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0f766e] mb-1">
          <Icon name="compass" /> Travel Matcher
        </div>

        <h2 className="text-xl font-bold text-[#1f2d27] mb-1">
          {step === 1
            ? 'What tour difficulty suits you?'
            : step === 2
            ? 'How long is your ideal getaway?'
            : 'What kind of experience excites you most?'}
        </h2>
        <p className="text-xs text-[#65716a] mb-6">
          Step {step} of 3 · We’ll match you with tours using their listed difficulty and duration.
        </p>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'easy', title: 'Easy', desc: 'Relaxed routes with lighter activity' },
              { id: 'moderate', title: 'Moderate', desc: 'A balanced level of activity' },
              { id: 'challenging', title: 'Challenging', desc: 'More demanding routes and activity' },
              { id: 'extreme', title: 'Extreme', desc: 'The most demanding available tours' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setAnswers((prev) => ({ ...prev, difficulty: opt.id }))
                  setStep(2)
                }}
                className={`rounded-xl border p-4 text-left transition hover:border-[#0f766e] ${
                  answers.difficulty === opt.id ? 'border-[#0f766e] bg-[#e4f3ef]' : 'border-[#ded8ca] bg-white'
                }`}
              >
                <div className="font-bold text-sm text-[#1f2d27]">{opt.title}</div>
                <div className="text-[11px] text-[#65716a] mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'day_trip', title: 'Day Trip', desc: 'One day' },
              { id: '2_3_days', title: 'Weekend Escape', desc: '2 to 3 days' },
              { id: '4_plus_days', title: 'Full Journey', desc: '4 or more days' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setAnswers((prev) => ({ ...prev, duration: opt.id }))
                  setStep(3)
                }}
                className={`rounded-xl border p-4 text-left transition hover:border-[#0f766e] ${
                  answers.duration === opt.id ? 'border-[#0f766e] bg-[#e4f3ef]' : 'border-[#ded8ca] bg-white'
                }`}
              >
                <div className="font-bold text-sm text-[#1f2d27]">{opt.title}</div>
                <div className="text-[11px] text-[#65716a] mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'heritage', title: 'Heritage & Culture', desc: 'Temples, architecture, history' },
              { id: 'nature', title: 'Nature & Wildlife', desc: 'Hills, plantations, scenic viewpoints' },
              { id: 'food', title: 'Culinary & Local Life', desc: 'Spice trails, tastings, markets' },
              { id: 'coastal', title: 'Coast & Relaxation', desc: 'Beaches, ports, sunset points' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setAnswers((prev) => ({ ...prev, interest: opt.id }))
                }}
                className={`rounded-xl border p-4 text-left transition hover:border-[#0f766e] ${
                  answers.interest === opt.id ? 'border-[#0f766e] bg-[#e4f3ef]' : 'border-[#ded8ca] bg-white'
                }`}
              >
                <div className="font-bold text-sm text-[#1f2d27]">{opt.title}</div>
                <div className="text-[11px] text-[#65716a] mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-[#ded8ca] pt-4">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as 1 | 2)}
              className="text-xs font-bold text-[#65716a] hover:text-[#1f2d27]"
            >
              ← Back
            </button>
          ) : <span />}

          {step === 3 ? (
            <button
              onClick={handleFinish}
              className="rounded-full bg-[#0f766e] px-5 py-2 text-xs font-bold text-white hover:bg-[#115e59] transition"
            >
              See Matching Tours
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              className="rounded-full bg-[#102824] px-4 py-2 text-xs font-bold text-white hover:bg-[#1f2d27] transition"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
