from fastapi import FastAPI
from pydantic import BaseModel

from scorer import score


app = FastAPI()


class TxnInput(BaseModel):
    mode: str
    amount: float
    merchant_known: bool
    device_known: bool
    location_match: bool


@app.post("/score")
def get_score(txn: TxnInput):

    return score(
        txn.mode,
        txn.amount,
        txn.merchant_known,
        txn.device_known,
        txn.location_match
    )