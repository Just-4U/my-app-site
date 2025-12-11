// api/exchange.js
// Usage: GET /api/exchange?invoice_id=INVOICE_ID
// If invoice is paid -> returns { ok:true, download_url: "/api/download?token=..." }

import crypto from "crypto";

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const API_KEY = process.env.NOWPAYMENTS_API_KEY;
  const TOKEN_SECRET = process.env.NOWPAYMENTS_TOKEN_SECRET;
  if (!API_KEY || !TOKEN_SECRET) return res.status(500).json({ error: "Missing environment variables" });

  const invoiceId = (req.method === "GET") ? req.query.invoice_id : (req.body && req.body.invoice_id);
  if (!invoiceId) return res.status(400).json({ error: "invoice_id required" });

  try {
    // Fetch invoice from NowPayments
    const resp = await fetch(`https://api.nowpayments.io/v1/invoice/${invoiceId}`, {
      headers: { "x-api-key": API_KEY }
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(500).json({ error: "NowPayments API error", details: data });
    }

    // NowPayments statuses: "waiting", "confirmed", "finished", "canceled", etc.
    const status = (data.status || "").toLowerCase();

    // Consider confirmed/finished/paid as success — adapt if needed
    const successStates = ["confirmed", "finished", "paid"];

    if (!successStates.includes(status)) {
      return res.status(200).json({ ok: false, status, details: data });
    }

    // Invoice is paid — create signed short-lived token (10 minutes)
    const expiresInSeconds = 10 * 60; // 10 minutes
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payload = { invoice_id: invoiceId, exp, iat: Math.floor(Date.now()/1000) };
    const payloadJson = JSON.stringify(payload);
    const payloadB64 = base64url(payloadJson);
    const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(payloadB64).digest("hex");
    const token = `${payloadB64}.${sig}`;

    // The download URL the client will use
    const downloadUrl = `/api/download?token=${encodeURIComponent(token)}`;

    // Return the download URL (client will call it and start the download)
    return res.status(200).json({ ok: true, download_url: downloadUrl, expiry_seconds: expiresInSeconds });

  } catch (err) {
    console.error("exchange error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
