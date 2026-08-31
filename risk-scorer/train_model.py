import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from xgboost import XGBClassifier


df = pd.read_csv("transactions.csv")


# Convert categorical payment modes into numbers

df["mode"] = df["mode"].map({
    "nfc": 0,
    "qr": 1,
    "upi": 2,
    "card": 3
})


features = [
    "mode",
    "amount",
    "merchant_known",
    "device_known",
    "location_match"
]


X = df[features]

y = df["is_fraud"]


X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)


model = XGBClassifier(
    n_estimators=200,
    max_depth=5,
    learning_rate=0.05,
    random_state=42,
    eval_metric="logloss"
)


model.fit(X_train, y_train)


predictions = model.predict(X_test)


accuracy = accuracy_score(
    y_test,
    predictions
)


print("Accuracy:", accuracy)

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        predictions
    )
)


model.save_model("fraud_model.json")

print("\nModel saved as fraud_model.json")