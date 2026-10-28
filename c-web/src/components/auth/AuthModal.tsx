import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeCustomerRegistration, sendCustomerOtp, verifyCustomerOtp } from '../../utils/customerApi'
import { useCustomerAuth } from '../../contexts/customerAuth'
import { Icon } from '../Icon'

export function AuthModal() {
  const { authModalOpen } = useCustomerAuth()

  if (!authModalOpen) {
    return null
  }

  return <AuthModalContent />
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function AuthModalContent() {
  const navigate = useNavigate()
  const { authRedirectTo, closeAuthModal, login } = useCustomerAuth()
  const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone')
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState('')
  const [registrationToken, setRegistrationToken] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus trap + Escape handler
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    // Move focus into the modal on open
    const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE)
    firstFocusable?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeAuthModal()
        return
      }

      if (event.key !== 'Tab') return


      const focusable = Array.from((dialog as HTMLDivElement).querySelectorAll<HTMLElement>(FOCUSABLE))

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey) {
        // Shift+Tab: move backward
        if (document.activeElement === first) {
          event.preventDefault()
          last.focus()
        }
      } else {
        // Tab: move forward
        if (document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closeAuthModal, step])

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextPhone = String(form.get('phone') ?? '')
    setMessage('')
    setIsSubmitting(true)
    const result = await sendCustomerOtp(nextPhone, 'register')
    setIsSubmitting(false)

    if (result.error) {
      setMessage(result.error)
      return
    }

    setPhone(nextPhone)
    setStep('otp')
    setMessage(result.data?.customer_exists ? 'Account found. Enter the OTP to log in.' : 'New customer phone. Verify OTP, then complete your profile.')

    if (result.data?.dev_otp) {
      window.alert(`Development OTP for ${nextPhone}: ${result.data.dev_otp}`)
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setMessage('')
    setIsSubmitting(true)
    const result = await verifyCustomerOtp(String(form.get('phone') ?? phone), String(form.get('code') ?? ''), 'register')
    setIsSubmitting(false)

    if (result.error) {
      setMessage(result.error)
      return
    }

    if (result.data?.requires_registration && result.data.registration_token) {
      setRegistrationToken(result.data.registration_token)
      setStep('profile')
      setMessage('OTP verified. Add your details to finish registration.')
      return
    }

    if (result.data?.token) {
      login(result.data.token)
      navigate(authRedirectTo)
      return
    }

    setMessage('OTP verified, but Turiya Mobility did not return the next authentication step.')
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setMessage('')
    setIsSubmitting(true)
    const result = await completeCustomerRegistration({
      phone,
      registration_token: registrationToken,
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? '') || undefined,
    })
    setIsSubmitting(false)

    if (result.error || !result.data?.token) {
      setMessage(result.error ?? 'Registration completed without returning a session token.')
      return
    }

    login(result.data.token)
    navigate(authRedirectTo)
  }

  return (
    <section className="auth-page" aria-label="Customer authentication">
      <button aria-label="Close authentication" className="auth-scrim" onClick={closeAuthModal} type="button" />
      <div
        ref={dialogRef}
        aria-labelledby="auth-title"
        aria-modal="true"
        className="auth-modal auth-card"
        role="dialog"
      >
        <button aria-label="Close authentication" className="icon-button auth-close" onClick={closeAuthModal} type="button">
          <Icon name="arrow" />
        </button>
        <p className="eyebrow">Customer access</p>
        <h1 id="auth-title">Continue with mobile OTP</h1>
        <p>One flow handles login and registration for tours, cabs, wallet, booking history, and support.</p>
        
        {step === 'phone' ? (
          <form onSubmit={sendOtp}>
            <label>
              Mobile number
              <input autoComplete="tel" name="phone" onChange={(event) => setPhone(event.target.value)} required type="tel" value={phone} />
            </label>
            <p className="helper-text">In development, the OTP is shown in a browser alert after you request it.</p>
            {message ? <p className="helper-text" role="status">{message}</p> : null}
            <button className="button button-primary full-width" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : null}
        {step === 'otp' ? (
          <form onSubmit={verifyOtp}>
            <label>
              Mobile number
              <input autoComplete="tel" name="phone" onChange={(event) => setPhone(event.target.value)} required type="tel" value={phone} />
            </label>
            <label>
              OTP
              <input inputMode="numeric" maxLength={6} minLength={6} name="code" required type="text" />
            </label>
            <p className="helper-text" role={message.includes('failed') || message.includes('not') ? 'alert' : 'status'}>{message}</p>
            <button className="button button-primary full-width" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button className="text-link inline-button" onClick={() => setStep('phone')} type="button">
              Change mobile number
            </button>
          </form>
        ) : null}
        {step === 'profile' ? (
          <form onSubmit={submitProfile}>
            <label>
              Full name
              <input autoComplete="name" name="name" required type="text" />
            </label>
            <label>
              Email address
              <input autoComplete="email" name="email" type="email" />
            </label>
            <p className="helper-text" role={message.includes('expired') ? 'alert' : 'status'}>{message}</p>
            <button className="button button-primary full-width" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Creating account...' : 'Create account and continue'}
            </button>
          </form>
        ) : null}
      </div>
    </section>
  )
}
