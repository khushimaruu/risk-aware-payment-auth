import { useState } from "react";
import axios from "axios";

const API = "http://localhost:3000";

type Mode = "nfc" | "qr" | "upi" | "card";

interface PaymentResult {
  transaction_id: string;
  mode: string;
  amount: number;
  risk_score: number;
  auth_tier: string;
  auth_required: string;
  auth_status: string;
  auth_method: string;
  outcome: string;
  message: string;
  otp_issued?: string;
}

const TIER_COLORS: Record<string, string> = {
  trivial: "#22c55e",
  low: "#84cc16",
  medium: "#f59e0b",
  high: "#ef4444",
  extreme: "#7f1d1d",
};

const TIER_LABELS: Record<string, string> = {
  trivial: "✅ Trivial — Device unlock",
  low: "🔵 Low — Biometric",
  medium: "🟡 Medium — Biometric + OTP",
  high: "🔴 High — Biometric + PIN + Review",
  extreme: "⛔ Extreme — Blocked",
};

const MODE_ICONS: Record<Mode, string> = {
  nfc: "📡",
  qr: "📷",
  upi: "💸",
  card: "💳",
};

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 20 },
  card: { background: "#1e293b", borderRadius: 16, padding: 32, width: "100%", maxWidth: 480, boxShadow: "0 25px 50px rgba(0,0,0,0.5)" },
  header: { textAlign: "center", marginBottom: 28 },
  title: { color: "#f1f5f9", fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { color: "#64748b", fontSize: 13, marginTop: 6 },
  section: { marginBottom: 20 },
  label: { display: "block", color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 },
  modeRow: { display: "flex", gap: 10 },
  modeBtn: { flex: 1, padding: "12px 8px", borderRadius: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  modeBtnLabel: { color: "#e2e8f0", fontSize: 11, fontWeight: 600 },
  input: { width: "100%", background: "#0f172a", border: "1.5px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 15, outline: "none", boxSizing: "border-box" },
  toggleGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  toggle: { padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, textAlign: "left" },
  payBtn: { width: "100%", padding: "14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  error: { color: "#f87171", fontSize: 13, marginTop: 12, textAlign: "center" },
  resultBanner: { borderRadius: 12, border: "1.5px solid", padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 20 },
  resultOutcome: { fontSize: 28, fontWeight: 800, color: "#f1f5f9" },
  resultGrid: { marginBottom: 20 },
  resultRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #0f172a" },
  resultKey: { color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0, marginRight: 12 },
  resultVal: { fontSize: 13, fontWeight: 500, textAlign: "right", wordBreak: "break-all" },
  barTrack: { height: 10, background: "#0f172a", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999, transition: "width 0.6s ease" },
  resetBtn: { width: "100%", padding: "12px", background: "#1e293b", color: "#94a3b8", border: "1.5px solid #334155", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 8 },
};

const DEVICE_HASH = "a3f5c2e1b4d6f8a9c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6";

export default function App() {
  const [mode, setMode] = useState<Mode>("nfc");
  const [amount, setAmount] = useState("");
  const [merchantKnown, setMerchantKnown] = useState(true);
  const [deviceKnown, setDeviceKnown] = useState(true);
  const [locationMatch, setLocationMatch] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");

  async function handlePay() {
    setError("");
    setResult(null);
    if (!amount || isNaN(Number(amount))) { setError("Enter a valid amount."); return; }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/pay`, {
        mode,
        amount: Number(amount),
        merchant_known: merchantKnown,
        device_known: deviceKnown,
        location_match: locationMatch,
        device_id: "device_001",
        biometric_hash: biometric ? DEVICE_HASH : null,
        pin: pin || null,
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Pipeline error — is the orchestrator running?");
    } finally {
      setLoading(false);
    }
  }

  function reset() { setResult(null); setError(""); setAmount(""); setPin(""); setBiometric(false); }

  if (result) {
    const approved = result.outcome === "approved";
    const rows: [string, string][] = [
      ["Transaction ID", result.transaction_id],
      ["Mode", result.mode.toUpperCase()],
      ["Amount", `₹${result.amount.toLocaleString("en-IN")}`],
      ["Risk Score", result.risk_score.toFixed(3)],
      ["Auth Tier", TIER_LABELS[result.auth_tier] ?? result.auth_tier],
      ["Auth Method", result.auth_method],
      ["Message", result.message],
    ];
    if (result.otp_issued) rows.push(["OTP Issued", result.otp_issued]);

    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.header}>
            <h1 style={s.title}>🏥 Hospital Payment</h1>
            <p style={s.subtitle}>Mode-Aware Adaptive Authentication</p>
          </div>
          <div style={{ ...s.resultBanner, background: approved ? "#14532d" : "#7f1d1d", borderColor: approved ? "#22c55e" : "#ef4444" }}>
            <span style={{ fontSize: 36 }}>{approved ? "✅" : "⛔"}</span>
            <span style={s.resultOutcome}>{result.outcome.toUpperCase()}</span>
          </div>
          <div style={s.resultGrid}>
            {rows.map(([k, v]) => (
              <div key={k} style={s.resultRow}>
                <span style={s.resultKey}>{k}</span>
                <span style={{ ...s.resultVal, color: k === "Risk Score" ? TIER_COLORS[result.auth_tier] : "#e2e8f0" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={s.section}>
            <label style={s.label}>Risk Score</label>
            <div style={s.barTrack}>
              <div style={{ ...s.barFill, width: `${result.risk_score * 100}%`, background: TIER_COLORS[result.auth_tier] }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ color: "#64748b", fontSize: 11 }}>0 — Safe</span>
              <span style={{ color: "#64748b", fontSize: 11 }}>1 — Fraud</span>
            </div>
          </div>
          <button onClick={reset} style={s.resetBtn}>← New Transaction</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <h1 style={s.title}>🏥 Hospital Payment</h1>
          <p style={s.subtitle}>Mode-Aware Adaptive Authentication</p>
        </div>
        <div style={s.section}>
          <label style={s.label}>Payment Mode</label>
          <div style={s.modeRow}>
            {(["nfc", "qr", "upi", "card"] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{ ...s.modeBtn, background: mode === m ? "#1d4ed8" : "#0f172a", border: mode === m ? "2px solid #60a5fa" : "2px solid #334155" }}>
                <span style={{ fontSize: 22 }}>{MODE_ICONS[m]}</span>
                <span style={s.modeBtnLabel}>{m.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={s.section}>
          <label style={s.label}>Amount (₹)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50000" style={s.input} />
        </div>
        <div style={s.section}>
          <label style={s.label}>Transaction Context</label>
          <div style={s.toggleGrid}>
            {[
              { label: "Known Merchant", value: merchantKnown, set: setMerchantKnown },
              { label: "Known Device", value: deviceKnown, set: setDeviceKnown },
              { label: "Location Match", value: locationMatch, set: setLocationMatch },
              { label: "Biometric Ready", value: biometric, set: setBiometric },
            ].map(({ label, value, set }) => (
              <button key={label} onClick={() => set(!value)} style={{ ...s.toggle, background: value ? "#14532d" : "#0f172a", border: value ? "1.5px solid #22c55e" : "1.5px solid #334155", color: value ? "#86efac" : "#94a3b8" }}>
                {value ? "✓" : "✗"} {label}
              </button>
            ))}
          </div>
        </div>
        <div style={s.section}>
          <label style={s.label}>PIN <span style={{ color: "#64748b", fontWeight: 400 }}>(required for High tier)</span></label>
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter PIN" style={{ ...s.input, width: 140 }} maxLength={6} />
        </div>
        <button onClick={handlePay} disabled={loading} style={{ ...s.payBtn, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Processing..." : `Pay via ${mode.toUpperCase()}`}
        </button>
        {error && <p style={s.error}>{error}</p>}
      </div>
    </div>
  );
}