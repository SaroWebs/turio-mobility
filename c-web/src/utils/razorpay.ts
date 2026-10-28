// Lazy-load Razorpay Checkout exactly once, on demand. We deliberately keep this out of a global
// <script> tag in index.html so the payments SDK is only fetched when a top-up actually starts.

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

export type RazorpayPrefill = {
  name?: string
  email?: string
  contact?: string
}

export type RazorpaySuccessResponse = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export type RazorpayFailureResponse = {
  error?: {
    code?: string
    description?: string
    reason?: string
    source?: string
    step?: string
  }
}

export type RazorpayCheckoutOptions = {
  key: string
  amount: number // integer minor units (paise)
  currency: string
  name?: string
  description?: string
  image?: string
  order_id: string
  prefill?: RazorpayPrefill
  theme?: { color?: string }
  handler?: (response: RazorpaySuccessResponse) => void
  modal?: { ondismiss?: () => void }
}

export type RazorpayInstance = {
  open: () => void
  on: (event: 'payment.failed', handler: (response: RazorpayFailureResponse) => void) => void
}

type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayInstance

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor
  }
}

let checkoutPromise: Promise<void> | null = null

export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve()
  if (checkoutPromise) return checkoutPromise

  checkoutPromise = new Promise<void>((resolve, reject) => {
    const fail = () => {
      checkoutPromise = null // allow a later retry after a transient network failure
      reject(new Error('Failed to load the payment gateway.'))
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`)
    if (existing) {
      if (window.Razorpay) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', fail)
      return
    }

    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = fail
    document.body.appendChild(script)
  })

  return checkoutPromise
}
