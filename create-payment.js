// api/create-payment.js
// Creates a NowPayments invoice and returns { invoice_id, payment_url, order_id }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const API_KEY = process.env.NOWPAYMENTS_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "NOWPAYMENTS_API_KEY missing in env" });

  try {
    const orderId = `ciphervault-${Date.now()}`;
    const payload = {
      price_amount: 14.99,
      price_currency: "usd",
      order_id: orderId,
      pay_currency: "any",
      ipn_callback_url: "https://ciphervault.vip/api/nowpayments-webhook", // optional - you can implement later
      success_url: "https://ciphervault.vip/thank-you"
    };

    const nowResp = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await nowResp.json();

    if (!nowResp.ok || !data) {
      return res.status(500).json({ error: "NowPayments error", details: data });
    }

    // NowPayments returns an id and invoice_url (may vary); handle common keys:
    const invoiceId = data.id || data.invoice_id || data.invoiceId;
    const invoiceUrl = data.invoice_url || data.invoiceUrl || data.url || data.checkout_url || data.payment_url;

    if (!invoiceId || !invoiceUrl) {
      return res.status(500).json({ error: "Unexpected NowPayments response", details: data });
    }

    return res.status(200).json({
      invoice_id: invoiceId,
      payment_url: invoiceUrl,
      order_id: orderId
    });
  } catch (err) {
    console.error("create-payment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
