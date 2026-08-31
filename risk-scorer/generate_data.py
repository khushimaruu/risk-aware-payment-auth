import pandas as pd
import random

from scorer import score


random.seed(42)

rows = []


for _ in range(2000):

    mode = random.choice([
        "nfc",
        "qr",
        "upi",
        "card"
    ])

    amount = random.choice([
        200,
        500,
        1000,
        5000,
        10000,
        25000,
        50000,
        75000
    ])

    merchant_known = random.random() > 0.3

    device_known = random.random() > 0.2

    location_match = random.random() > 0.25


    result = score(
        mode,
        amount,
        merchant_known,
        device_known,
        location_match
    )


    fraud_prob = {

        "trivial": 0.01,

        "low": 0.05,

        "medium": 0.15,

        "high": 0.40,

        "extreme": 0.80

    }


    is_fraud = (
        random.random()
        < fraud_prob[result["tier"]]
    )


    rows.append({

        "mode": mode,

        "amount": amount,

        "merchant_known": merchant_known,

        "device_known": device_known,

        "location_match": location_match,

        "risk_score": result["score"],

        "auth_tier": result["tier"],

        "is_fraud": is_fraud

    })


df = pd.DataFrame(rows)


df.to_csv(
    "transactions.csv",
    index=False
)


print(
    "Done — 2000 rows written to transactions.csv"
)