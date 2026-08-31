const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

app.use(express.json());


// ===============================
// DATABASE CONNECTION
// ===============================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


// ===============================
// AUTHENTICATION TIERS
// ===============================

const AUTH_TIERS = {

    trivial: "device_unlock",

    low: "biometric",

    medium: "biometric_otp",

    high: "biometric_pin_review",

    extreme: "blocked"

};


// ===============================
// PAYMENT ENDPOINT
// ===============================

app.post("/pay", async (req, res) => {

    try {

        // Get transaction details

        const {
            mode,
            amount,
            merchant_known,
            device_known,
            location_match
        } = req.body;


        // ===============================
        // 1. RISK SCORING
        // ===============================

        const riskResponse = await axios.post(
            "http://localhost:8001/score",
            {
                mode,
                amount,
                merchant_known,
                device_known,
                location_match
            }
        );

        const riskData = riskResponse.data;


        // ===============================
        // 2. DETERMINE AUTHENTICATION
        // ===============================

        const auth_required =
            AUTH_TIERS[riskData.tier];


        // ===============================
        // 3. DETERMINE OUTCOME
        // ===============================

        let outcome;

        if (riskData.tier === "extreme") {

            outcome = "blocked";

        } else {

            outcome = "proceed_to_auth";

        }


        // ===============================
        // 4. CALL AUTH NODE
        // ===============================

        let authResult = null;

        if (outcome === "proceed_to_auth") {

            const authResponse = await axios.post(
                "http://localhost:8002/authenticate",
                {
                    auth_type: auth_required
                }
            );

            authResult = authResponse.data;

        }


        // ===============================
        // 5. SAVE TRANSACTION
        // ===============================

        await pool.query(
            `
            INSERT INTO transactions
            (
                mode,
                amount,
                merchant_known,
                device_known,
                location_match,
                risk_score,
                auth_tier,
                auth_outcome
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
                mode,
                amount,
                merchant_known,
                device_known,
                location_match,
                riskData.score,
                riskData.tier,
                outcome
            ]
        );


        // ===============================
        // 6. SEND FINAL RESPONSE
        // ===============================

        res.json({

            mode: mode,

            amount: amount,

            risk_score: riskData.score,

            auth_tier: riskData.tier,

            auth_required: auth_required,

            outcome: outcome,

            authentication: authResult

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            error: "Payment processing failed",

            details: error.message

        });

    }

});


// ===============================
// START SERVER
// ===============================

app.listen(3000, () => {

    console.log(
        "Orchestrator running on http://localhost:3000"
    );

});