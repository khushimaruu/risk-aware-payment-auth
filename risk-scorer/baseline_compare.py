import pandas as pd
from sklearn.metrics import classification_report
import pickle

# ── Load test data ────────────────────────────────────────
df = pd.read_csv("transactions.csv")

# ── Baseline 1: Flat MFA ──────────────────────────────────
# Simulates current hospital systems — everyone gets biometric,
# flag everything above ₹10,000 as high risk regardless of mode
def flat_mfa_predict(row):
    return 1 if row["amount"] > 10000 else 0

# ── Baseline 2: Amount-only RBA ───────────────────────────
# Risk-based auth but no modality signal
def amount_only_predict(row):
    if row["amount"] > 40000: return 1
    if row["amount"] > 10000 and not row["merchant_known"]: return 1
    return 0

# ── Your model ────────────────────────────────────────────
with open("model.pkl", "rb") as f:
    model = pickle.load(f)
with open("encoder.pkl", "rb") as f:
    le = pickle.load(f)

def model_predict(row):
    me = int(le.transform([row["mode"]])[0])
    features = [[
        me, row["amount"],
        int(row["merchant_known"]), int(row["device_known"]), int(row["location_match"]),
        me * row["amount"],
        me * int(row["merchant_known"]),
        me * int(row["location_match"]),
        row["amount"] * int(row["merchant_known"]),
        row["amount"] * int(row["device_known"])
    ]]
    return int(model.predict(features)[0])

# ── Run all three ─────────────────────────────────────────
y_true         = df["is_fraud"].astype(int)
y_flat         = df.apply(flat_mfa_predict, axis=1)
y_amount       = df.apply(amount_only_predict, axis=1)
y_model        = df.apply(model_predict, axis=1)

# ── Friction metric ───────────────────────────────────────
# avg auth steps: trivial=1, low=2, medium=3, high=4, extreme=0 (blocked)
AUTH_STEPS = {"trivial": 1, "low": 2, "medium": 3, "high": 4, "extreme": 0}

def friction(predictions):
    # flat MFA: everyone gets biometric (2 steps) unless blocked
    return predictions.mean() * 3 + (1 - predictions.mean()) * 1

flat_friction  = 2.0  # flat MFA: everyone gets biometric, fixed
amount_friction = y_amount.mean() * 3 + (1 - y_amount.mean()) * 1
model_friction  = y_model.mean() * 3 + (1 - y_model.mean()) * 1

print("=" * 55)
print("BASELINE 1 — Flat MFA (amount threshold only)")
print("=" * 55)
print(classification_report(y_true, y_flat, target_names=["Legit", "Fraud"]))
print(f"Avg auth friction score: {flat_friction:.2f} steps/session\n")

print("=" * 55)
print("BASELINE 2 — Amount-only RBA (no modality)")
print("=" * 55)
print(classification_report(y_true, y_amount, target_names=["Legit", "Fraud"]))
print(f"Avg auth friction score: {amount_friction:.2f} steps/session\n")

print("=" * 55)
print("PROPOSED — Mode-aware XGBoost")
print("=" * 55)
print(classification_report(y_true, y_model, target_names=["Legit", "Fraud"]))
print(f"Avg auth friction score: {model_friction:.2f} steps/session\n")

print("=" * 55)
print("SUMMARY TABLE (for paper)")
print("=" * 55)
from sklearn.metrics import f1_score, recall_score, precision_score
for name, preds in [("Flat MFA", y_flat), ("Amount-only RBA", y_amount), ("Mode-aware XGBoost", y_model)]:
    p = precision_score(y_true, preds, zero_division=0)
    r = recall_score(y_true, preds, zero_division=0)
    f = f1_score(y_true, preds, zero_division=0)
    print(f"{name:<22} Precision: {p:.3f}  Recall: {r:.3f}  F1: {f:.3f}")
    