from fastapi import FastAPI
from pydantic import BaseModel
import hashlib, hmac, time, random, string

app = FastAPI()

# ── Input model ───────────────────────────────────────────
class AuthRequest(BaseModel):
    transaction_id: str
    auth_tier: str
    mode: str
    amount: float
    device_id: str
    biometric_hash: str | None = None   # SHA256 of biometric template
    otp: str | None = None
    pin: str | None = None

# ── Simulated biometric store ─────────────────────────────
# In production this would be an HSM-backed biometric server
BIOMETRIC_STORE = {
    "device_001": "a3f5c2e1b4d6f8a9c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6",
    "device_002": "b4e6d0f2a4c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0",
}

# ── OTP store (simulate send + verify) ────────────────────
OTP_STORE = {}

def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

def verify_biometric(device_id, biometric_hash):
    stored = BIOMETRIC_STORE.get(device_id)
    if not stored:
        return False, "Device not enrolled"
    if stored == biometric_hash:
        return True, "Biometric verified"
    return False, "Biometric mismatch"

# ── Auth tier handlers ────────────────────────────────────

def handle_trivial(req):
    return {"status": "approved", "method": "device_unlock", "message": "Device unlock sufficient"}

def handle_low(req):
    ok, msg = verify_biometric(req.device_id, req.biometric_hash)
    return {
        "status": "approved" if ok else "rejected",
        "method": "biometric",
        "message": msg
    }

def handle_medium(req):
    bio_ok, bio_msg = verify_biometric(req.device_id, req.biometric_hash)
    if not bio_ok:
        return {"status": "rejected", "method": "biometric_otp", "message": bio_msg}
    # Verify OTP
    expected = OTP_STORE.get(req.transaction_id)
    if not expected:
        return {"status": "rejected", "method": "biometric_otp", "message": "No OTP issued for this transaction"}
    otp_ok = req.otp == expected
    return {
        "status": "approved" if otp_ok else "rejected",
        "method": "biometric_otp",
        "message": "OTP verified" if otp_ok else "OTP mismatch"
    }

def handle_high(req):
    bio_ok, bio_msg = verify_biometric(req.device_id, req.biometric_hash)
    if not bio_ok:
        return {"status": "rejected", "method": "biometric_pin_review", "message": bio_msg}
    pin_ok = req.pin is not None and len(req.pin) >= 4
    return {
        "status": "approved" if pin_ok else "rejected",
        "method": "biometric_pin_review",
        "message": "Biometric + PIN verified — flagged for manual review" if pin_ok else "PIN required"
    }

def handle_extreme(req):
    return {
        "status": "blocked",
        "method": "none",
        "message": "Transaction blocked — risk score exceeds threshold. Contact your bank."
    }

# ── Main auth endpoint ────────────────────────────────────
TIER_HANDLERS = {
    "trivial": handle_trivial,
    "low":     handle_low,
    "medium":  handle_medium,
    "high":    handle_high,
    "extreme": handle_extreme,
}

@app.post("/auth")
def authenticate(req: AuthRequest):
    handler = TIER_HANDLERS.get(req.auth_tier)
    if not handler:
        return {"status": "error", "message": f"Unknown tier: {req.auth_tier}"}
    result = handler(req)
    result["transaction_id"] = req.transaction_id
    result["tier"] = req.auth_tier
    result["mode"] = req.mode
    return result

# ── OTP issue endpoint (called by orchestrator before medium/high auth) ──
@app.post("/issue-otp/{transaction_id}")
def issue_otp(transaction_id: str):
    otp = generate_otp()
    OTP_STORE[transaction_id] = otp
    # In production: send via SMS/email. Here we return it directly for testing.
    return {"transaction_id": transaction_id, "otp": otp, "message": "OTP issued (test mode — would be sent via SMS in production)"}