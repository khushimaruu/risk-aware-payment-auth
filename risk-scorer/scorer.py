import pickle
import numpy as np

# Load once at import time — not on every request
with open("model.pkl", "rb") as f:
    model = pickle.load(f)

with open("encoder.pkl", "rb") as f:
    le = pickle.load(f)

def score(mode, amount, merchant_known, device_known, location_match):

    # Encode mode
    mode_encoded = int(le.transform([mode])[0])

    # Build interaction terms — must match train_model.py exactly
    mode_x_amount    = mode_encoded * amount
    mode_x_merchant  = mode_encoded * int(merchant_known)
    mode_x_location  = mode_encoded * int(location_match)
    amount_x_merchant = amount * int(merchant_known)
    amount_x_device   = amount * int(device_known)

    features = [[
        mode_encoded,
        amount,
        int(merchant_known),
        int(device_known),
        int(location_match),
        mode_x_amount,
        mode_x_merchant,
        mode_x_location,
        amount_x_merchant,
        amount_x_device
    ]]

    # Get fraud probability (column 1 = P(fraud))
    risk_score = float(model.predict_proba(features)[0][1])

    # Map to auth tier
    if risk_score < 0.15:
        tier = "trivial"
    elif risk_score < 0.40:
        tier = "low"
    elif risk_score < 0.65:
        tier = "medium"
    elif risk_score < 0.85:
        tier = "high"
    else:
        tier = "extreme"

    return {
        "score": round(risk_score, 3),
        "tier": tier
    }