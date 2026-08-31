def score(mode, amount, merchant_known, device_known, location_match):

    base = 0.0

    if mode == "qr":
        base += 0.15
    elif mode == "upi":
        base += 0.10
    elif mode == "nfc":
        base += 0.05
    elif mode == "card":
        base += 0.10

    if amount > 10000:
        base += 0.20

    if amount > 40000:
        base += 0.20

    if not merchant_known:
        base += 0.20

    if not device_known:
        base += 0.15

    if not location_match:
        base += 0.15

    risk_score = min(base, 1.0)

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