"""
Config — zero API keys required.
All tools are free and work without sign-ups.
"""
REQUEST_TIMEOUT      = 20
DEFAULT_PHONE_REGION = "IN"    # 2-letter country hint for phone parsing: "US", "GB", etc.

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0 Safari/537.36"
    )
}
