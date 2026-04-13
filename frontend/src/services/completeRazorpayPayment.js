import { loadRazorpayScript, openRazorpayModal } from './razorpayCheckout';

/**
 * Create a Razorpay order for an existing pending booking and open Checkout.
 * Resolves after verify succeeds; rejects if modal dismissed or verify fails.
 *
 * @param {import('axios').AxiosInstance} api
 * @param {{ bookingId: number, userEmail?: string, hotelName?: string }} ctx
 */
export function payPendingBooking(api, ctx) {
  const { bookingId, userEmail, hotelName } = ctx;

  return (async () => {
    const { data: order, status } = await api.post(
      '/payments/razorpay/create-order/',
      { booking_id: bookingId },
    );
    if (status !== 201) {
      throw new Error('Could not start payment');
    }

    const Razorpay = await loadRazorpayScript();

    return new Promise((resolve, reject) => {
      openRazorpayModal({
        Razorpay,
        keyId: order.key_id,
        orderId: order.order_id,
        amountPaise: order.amount,
        currency: order.currency || 'INR',
        name: 'Yoyo Stays',
        description: hotelName
          ? `${hotelName} — Booking #${bookingId}`
          : `Booking #${bookingId}`,
        prefillEmail: userEmail,
        onSuccess(response) {
          // Razorpay’s handler does not await async callbacks — use .then/.catch
          // so verify errors reject this promise and reach the UI.
          api
            .post('/payments/razorpay/verify/', {
              booking_id: bookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            .then(() => resolve())
            .catch((e) => {
              const msg =
                e.response?.data?.detail ||
                e.response?.data ||
                e.message ||
                'Verification failed';
              reject(
                new Error(
                  typeof msg === 'string' ? msg : JSON.stringify(msg),
                ),
              );
            });
        },
        onDismiss() {
          const err = new Error('Payment window closed');
          err.code = 'dismissed';
          reject(err);
        },
      });
    });
  })();
}
