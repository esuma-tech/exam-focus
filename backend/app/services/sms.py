from ..config import get_settings

settings = get_settings()


def send_sms(phone: str, message: str) -> bool:
    provider = settings.SMS_PROVIDER.lower()
    if provider == "console" or provider == "":
        print(f"[sms] to={phone}: {message}")
        return True
    # Integration point for Africa's Talking / Twilio / local aggregator.
    # e.g. requests.post("https://api.africastalking.com/...", ...)
    print(f"[sms:unknown-provider:{provider}] to={phone}: {message}")
    return False