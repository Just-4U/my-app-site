// api/download.js
// Streams the protected APK when token is valid: GET /api/download?token=...
import crypto from "crypto";
import fs from "fs";
import path from "path";

function base64urlDecode(input) {
  // add padding back for base64 decode
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  while (input.length % 4) input += "=";
  return Buffer.from(input, "base64").toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("Method not allowed");

  const TOKEN_SECRET = process.env.NOWPAYMENTS_TOKEN_SECRET;
  if (!TOKEN_SECRET) return res.status(500).json({ error: "Missing token secret" });

  const token = req.query.token;
  if (!token) return res.status(400).json({ error: "Missing token" });

  try {
    const parts = String(token).split(".");
    if (parts.length !== 2) return res.status(400).json({ error: "Invalid token format" });

    const payloadB64 = parts[0];
    const sig = parts[1];

    const expectedSig = crypto.createHmac("sha256", TOKEN_SECRET).update(payloadB64).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sig))) {
      return res.status(403).json({ error: "Invalid token signature" });
    }

    const payloadJson = base64urlDecode(payloadB64);
    const payload = JSON.parse(payloadJson);

    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || nowSec > payload.exp) {
      return res.status(403).json({ error: "Token expired" });
    }

    // OK — token valid. Stream the APK from /public/CipherVault.apk
    const apkPath = path.join(process.cwd(), "public", "CipherVault.apk"); // recommended location
    if (!fs.existsSync(apkPath)) {
      return res.status(500).json({ error: "APK not found on server" });
    }

    // Set headers for download and stream file
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", 'attachment; filename="CipherVault.apk"');

    const stream = fs.createReadStream(apkPath);
    stream.on("error", (err) => {
      console.error("stream error:", err);
      if (!res.headersSent) res.status(500).end("File stream error");
      else res.end();
    });
    stream.pipe(res);

    // NOTE: This token is stateless — we cannot reliably mark it used across all serverless instances here.
    // To enforce absolute single-use, add a persistent store (Supabase/Redis) and mark tokens used.
  } catch (err) {
    console.error("download error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
