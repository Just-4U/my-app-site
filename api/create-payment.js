export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { NOWPAYMENTS_API_KEY } = process.env;

    const response = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        price_amount: 14.99,
        price_currency: "usd",

        // 🔥 FIX: do not use ANY or USDT
        pay_currency: "usdt_trc20",

        order_description: "CipherVault Lifetime Purchase",
        success_url: "https://www.ciphervault.vip/thank-you.html",
        cancel_url: "https://www.ciphervault.vip/"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("NOWPayments error:", data);
      return res.status(500).json({ error: "Payment creation failed", details: data });
    }

    res.status(200).json({ invoice_url: data.invoice_url });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
