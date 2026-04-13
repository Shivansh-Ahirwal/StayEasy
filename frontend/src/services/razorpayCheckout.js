/**
 * Load Razorpay Checkout.js and open the payment modal.
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration
 */

/**
 * @returns {Promise<typeof window.Razorpay>}
 */
export function loadRazorpayScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window'));
  }
  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay));
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Razorpay')),
      );
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(s);
  });
}

/**
 * @param {{
 *   Razorpay: typeof window.Razorpay,
 *   keyId: string,
 *   orderId: string,
 *   amountPaise: number,
 *   currency: string,
 *   name: string,
 *   description: string,
 *   prefillEmail?: string,
 *   onSuccess: (response: { razorpay_payment_id: string, razorpay_order_id: string, razorpay_signature: string }) => void,
 *   onDismiss?: () => void,
 * }} opts
 */
export function openRazorpayModal(opts) {
  const {
    Razorpay,
    keyId,
    orderId,
    amountPaise,
    currency,
    name,
    description,
    prefillEmail,
    onSuccess,
    onDismiss,
  } = opts;

  // amount/currency must match the Razorpay order (use values from create-order API).
  const options = {
    key: keyId,
    amount: String(amountPaise),
    currency,
    name: name || 'Yoyo Stays',
    description,
    ...(orderId ? { order_id: orderId } : {}),
    handler(response) {
      onSuccess({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature,
      });
    },
    modal: {
      ondismiss() {
        if (onDismiss) onDismiss();
      },
    },
    theme: { color: '#2e7d32' },
  };

  if (prefillEmail) {
    options.prefill = { email: prefillEmail };
  }

  const rz = new Razorpay(options);
  rz.open();
}
