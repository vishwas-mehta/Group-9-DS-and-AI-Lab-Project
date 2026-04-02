"""
TOOL: Phone number validation, formatting, carrier and region lookup.
100% free — Google's phonenumbers library, no API key.
"""
import sys, json
import phonenumbers
from phonenumbers import PhoneNumberFormat, carrier, geocoder
from phonenumbers import timezone as phone_tz
sys.path.insert(0, "..")
try:
    from .. import config
except ImportError:
    import config

def check_phone_number(phone: str, region: str = None) -> dict:
    """
    Parse and validate a phone number.

    INPUT : phone string, optional region hint ("IN", "US", "GB")
    OUTPUT: {ok, data: {e164, international, is_valid, country_code,
                        region_code, carrier, location, timezones}}

    Test: python tool_phone_check.py
    """
    if not phone:
        return {"ok": False, "error": "phone is required"}

    region = region or config.DEFAULT_PHONE_REGION
    try:
        parsed = phonenumbers.parse(phone, region)
        return {
            "ok": True,
            "data": {
                "input":         phone,
                "e164":          phonenumbers.format_number(parsed, PhoneNumberFormat.E164),
                "international": phonenumbers.format_number(parsed, PhoneNumberFormat.INTERNATIONAL),
                "national":      phonenumbers.format_number(parsed, PhoneNumberFormat.NATIONAL),
                "is_possible":   phonenumbers.is_possible_number(parsed),
                "is_valid":      phonenumbers.is_valid_number(parsed),
                "country_code":  parsed.country_code,
                "region_code":   phonenumbers.region_code_for_number(parsed),
                "number_type":   str(phonenumbers.number_type(parsed)),
                "carrier":       carrier.name_for_number(parsed, "en"),
                "location":      geocoder.description_for_number(parsed, "en"),
                "timezones":     list(phone_tz.time_zones_for_number(parsed)),
            }
        }
    except phonenumbers.NumberParseException as e:
        return {"ok": False, "error": f"Parse error: {e}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    print(json.dumps(check_phone_number("+91 80 2852 0261"), indent=2))
