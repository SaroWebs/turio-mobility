// Razorpay TypeScript declarations and utilities

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  notes?: Record<string, string>;
  theme: {
    color: string;
  };
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayConfig {
  key: string;
  currency: string;
  name: string;
  image?: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
}

/**
 * Load Razorpay SDK script dynamically
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Open Razorpay checkout
 */
export const openRazorpayCheckout = (
  options: Omit<RazorpayOptions, 'handler' | 'modal'>,
  onDismiss?: () => void
): Promise<RazorpayResponse> => {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Razorpay SDK not loaded'));
      return;
    }

    const rzpOptions: RazorpayOptions = {
      ...options,
      handler: (response: RazorpayResponse) => {
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          if (onDismiss) {
            onDismiss();
          }
          reject(new Error('Payment cancelled by user'));
        },
      },
    };

    const rzp = new window.Razorpay(rzpOptions);
    rzp.open();
  });
};

/**
 * Format amount for display (convert paise to rupees)
 */
export const formatAmount = (paise: number): string => {
  return (paise / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
  });
};

/**
 * Convert rupees to paise
 */
export const toPaise = (rupees: number): number => {
  return Math.round(rupees * 100);
};

/**
 * Convert paise to rupees
 */
export const toRupees = (paise: number): number => {
  return paise / 100;
};
