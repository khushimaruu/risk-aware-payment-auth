const express = require("express");
const axios = require("axios");
require("dotenv").config();
const { Pool } = require("pg");

const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());



const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});


const RISK_SCORER_URL = "http://localhost:8001/score";
const AUTH_NODE_URL   = "http://localhost:8002/auth";
const OTP_URL         = "http://localhost:8002/issue-otp";


const AUTH_TIERS = {
    trivial: "device_unlock",
    low:     "biometric",
    medium:  "biometric_otp",
    high:    "biometric_pin_review",
    extreme: "blocked"
};



// ── POST /pay ─────────────────────────────────────────────
// Full pipeline: score → (otp if needed) → auth → decision
app.post("/pay", async (req, res) => {
    try {
        const {
            mode,
            amount,
            merchant_known,
            device_known,
            location_match,
            device_id        = "device_001",
            biometric_hash   = null,
            otp              = null,
            pin              = null,
            transaction_id   = `txn_${Date.now()}`
        } = req.body;

        // ── 1. Risk score ─────────────────────────────────
        const { data: risk } = await axios.post(RISK_SCORER_URL, {
            mode, amount, merchant_known, device_known, location_match
        });

        const auth_required = AUTH_TIERS[risk.tier];

        // ── 2. If extreme — block immediately, skip auth node
        if (risk.tier === "extreme") {
            
            return res.json({
                transaction_id,
                mode, amount,
                risk_score:   risk.score,
                auth_tier:    risk.tier,
                auth_required,
                auth_status:  "blocked",
                outcome:      "blocked",
                message:      "Transaction blocked — risk score exceeds threshold."
            });
        }

        // ── 3. Issue OTP if medium or high tier ──────────
        let issued_otp = null;
        if (risk.tier === "medium" || risk.tier === "high") {
            const { data: otpData } = await axios.post(
                `${OTP_URL}/${transaction_id}`
            );
            issued_otp = otpData.otp;
        }

        // ── 4. Call auth node ─────────────────────────────
        const { data: authResult } = await axios.post(AUTH_NODE_URL, {
            transaction_id,
            auth_tier:      risk.tier,
            mode,
            amount,
            device_id,
            biometric_hash,
            otp:  otp || issued_otp,   // use provided otp, or the one just issued
            pin
        });

        // ── 5. Return full decision ───────────────────────
        try {
            await pool.query(
                `INSERT INTO transactions
                (mode, amount, merchant_known, device_known, location_match,
                 risk_score, auth_tier, auth_outcome)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [mode, amount, merchant_known, device_known, location_match,
                 risk.score, risk.tier,
                 authResult ? authResult.status : "blocked"]
            );
            } catch (dbErr) {
                console.error("DB log failed:", dbErr.message);
            }
        res.json({
            transaction_id,
            mode,
            amount,
            risk_score:   risk.score,
            auth_tier:    risk.tier,
            auth_required,
            auth_status:  authResult.status,
            auth_method:  authResult.method,
            outcome:      authResult.status === "approved" ? "approved" : "rejected",
            message:      authResult.message,
            ...(issued_otp && { otp_issued: issued_otp })
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Pipeline failed", detail: error.message });
    }
});

// ── GET /health ───────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({ orchestrator: "up", scorer: RISK_SCORER_URL, auth: AUTH_NODE_URL });
});

app.get("/db-test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() as time, COUNT(*) as row_count FROM transactions");
        res.json({ db: "connected", time: result.rows[0].time, rows: result.rows[0].row_count });
    } catch (err) {
        res.status(500).json({ db: "failed", error: err.message });
    }
});

app.listen(3000, () => console.log("Orchestrator running on http://localhost:3000"));