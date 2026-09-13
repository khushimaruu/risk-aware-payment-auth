import pandas as pd
import numpy as np
import pickle
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix

# ── 1. Load data ──────────────────────────────────────────
df = pd.read_csv("transactions.csv")
print(f"Dataset: {len(df)} rows, fraud rate: {df['is_fraud'].mean():.2%}")

# ── 2. Encode mode (categorical → numeric) ────────────────
le = LabelEncoder()
df["mode_encoded"] = le.fit_transform(df["mode"])
print(f"Mode encoding: {dict(zip(le.classes_, le.transform(le.classes_)))}")

# ── 3. Add interaction terms (the novel part) ─────────────
df["mode_x_amount"]           = df["mode_encoded"] * df["amount"]
df["mode_x_merchant"]         = df["mode_encoded"] * df["merchant_known"].astype(int)
df["mode_x_location"]         = df["mode_encoded"] * df["location_match"].astype(int)
df["amount_x_merchant"]       = df["amount"] * df["merchant_known"].astype(int)
df["amount_x_device"]         = df["amount"] * df["device_known"].astype(int)

# ── 4. Define features and target ────────────────────────
features = [
    "mode_encoded",
    "amount",
    "merchant_known",
    "device_known",
    "location_match",
    "mode_x_amount",
    "mode_x_merchant",
    "mode_x_location",
    "amount_x_merchant",
    "amount_x_device"
]

X = df[features].astype(float)
y = df["is_fraud"].astype(int)

# ── 5. Train/test split ───────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"Train: {len(X_train)}, Test: {len(X_test)}")

# ── 6. Train XGBoost ──────────────────────────────────────
model = XGBClassifier(
    n_estimators=100,
    max_depth=4,
    learning_rate=0.1,
    scale_pos_weight=(y_train == 0).sum() / (y_train == 1).sum(),
    random_state=42,
    eval_metric="logloss"
)
model.fit(X_train, y_train)

# ── 7. Evaluate ───────────────────────────────────────────
y_pred = model.predict(X_test)
print("\n── Classification Report ──")
print(classification_report(y_test, y_pred, target_names=["Legit", "Fraud"]))
print("── Confusion Matrix ──")
print(confusion_matrix(y_test, y_pred))

# ── 8. Feature importance ─────────────────────────────────
print("\n── Feature Importance ──")
importances = dict(zip(features, model.feature_importances_))
for feat, score in sorted(importances.items(), key=lambda x: -x[1]):
    bar = "█" * int(score * 40)
    print(f"  {feat:<25} {bar} {score:.4f}")

# ── 9. Save model + encoder ──────────────────────────────
with open("model.pkl", "wb") as f:
    pickle.dump(model, f)
with open("encoder.pkl", "wb") as f:
    pickle.dump(le, f)

print("\nSaved: model.pkl, encoder.pkl")