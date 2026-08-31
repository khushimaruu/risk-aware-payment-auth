from fastapi import FastAPI
from pydantic import BaseModel


app = FastAPI()


class AuthRequest(BaseModel):

    auth_type: str

    transaction_id: int | None = None


@app.post("/authenticate")
def authenticate(request: AuthRequest):

    if request.auth_type == "device_unlock":

        return {
            "status": "approved",
            "method": "device_unlock"
        }


    elif request.auth_type == "biometric":

        return {
            "status": "approved",
            "method": "biometric"
        }


    elif request.auth_type == "biometric_otp":

        return {
            "status": "approved",
            "method": "biometric_otp"
        }


    elif request.auth_type == "biometric_pin_review":

        return {
            "status": "pending",
            "method": "biometric_pin_review"
        }


    elif request.auth_type == "blocked":

        return {
            "status": "blocked",
            "method": "risk_engine"
        }


    return {
        "status": "unknown",
        "method": request.auth_type
    }