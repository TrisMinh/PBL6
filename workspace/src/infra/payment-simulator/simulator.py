from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import hmac
from urllib.parse import parse_qs, quote_plus, urlencode, urlparse
import json
import os
import urllib.error
import urllib.request

WEBHOOK_URL = os.environ.get(
    "WEBHOOK_URL",
    "http://host.docker.internal:5080/integrations/payments/vnpay-sandbox/webhooks",
)
HASH_SECRET = os.environ.get("HASH_SECRET", "local-dev-only-vnpay-hash-secret-32b")
TMN_CODE = os.environ.get("TMN_CODE", "LOCALDEV")


def sign(fields: dict[str, str]) -> str:
    items = sorted(
        (key, value)
        for key, value in fields.items()
        if key.startswith("vnp_") and key not in ("vnp_SecureHash", "vnp_SecureHashType") and value
    )
    data = "&".join(f"{quote_plus(key, safe='')}={quote_plus(value, safe='')}" for key, value in items)
    return hmac.new(HASH_SECRET.encode("utf-8"), data.encode("utf-8"), hashlib.sha512).hexdigest().upper()


def first(values: list[str] | None, default: str = "") -> str:
    return values[0] if values else default


def html_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def _json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, code, body):
        encoded = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/live", "/ready", "/health"):
            self._json(200, {"status": "live", "provider": "vnpay-sandbox"})
            return
        if parsed.path == "/checkout":
            query = parse_qs(parsed.query, keep_blank_values=True)
            txn = first(query.get("vnp_TxnRef"), "unknown")
            amount = int(first(query.get("vnp_Amount"), "0") or "0") // 100
            info = first(query.get("vnp_OrderInfo"), "BusTicket")
            ret = first(query.get("vnp_ReturnUrl"))
            self._html(
                200,
                f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>VNPay sandbox</title>
<style>
body {{ font-family: sans-serif; max-width: 32rem; margin: 3rem auto; }}
button {{ padding: .6rem 1rem; margin-right: .5rem; }}
.muted {{ color: #555; }}
</style></head>
<body>
<h1>VNPay sandbox (local)</h1>
<p>{html_escape(info)}</p>
<p><strong>{amount:,} VND</strong></p>
<p class="muted">Mã giao dịch {html_escape(txn)}</p>
<form method="post" action="/pay">
  <input type="hidden" name="vnp_TxnRef" value="{html_escape(txn)}">
  <input type="hidden" name="vnp_Amount" value="{html_escape(first(query.get("vnp_Amount"), "0"))}">
  <input type="hidden" name="vnp_ReturnUrl" value="{html_escape(ret)}">
  <input type="hidden" name="vnp_OrderInfo" value="{html_escape(info)}">
  <button name="outcome" value="00" type="submit">Thanh toán thành công</button>
  <button name="outcome" value="24" type="submit">Hủy / thất bại</button>
</form>
</body></html>""",
            )
            return
        self._json(404, {"error": {"code": "RESOURCE_NOT_FOUND", "message": "unknown route"}})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        parsed = urlparse(self.path)
        if parsed.path == "/pay":
            form = parse_qs(raw.decode("utf-8"), keep_blank_values=True)
            txn = first(form.get("vnp_TxnRef"))
            amount = first(form.get("vnp_Amount"), "0")
            ret = first(form.get("vnp_ReturnUrl"))
            outcome = first(form.get("outcome"), "00")
            payload = {
                "vnp_TmnCode": TMN_CODE,
                "vnp_TxnRef": txn,
                "vnp_Amount": amount,
                "vnp_ResponseCode": outcome,
                "vnp_TransactionStatus": "00" if outcome == "00" else "02",
                "vnp_OrderInfo": first(form.get("vnp_OrderInfo")),
                "logicalReference": txn,
                "success": outcome == "00",
                "externalEventId": f"{txn}-{outcome}",
            }
            payload["vnp_SecureHash"] = sign({key: str(value) for key, value in payload.items() if key != "success"})
            request = urllib.request.Request(
                WEBHOOK_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                method="POST",
            )
            try:
                urllib.request.urlopen(request, timeout=5).read()
            except urllib.error.URLError:
                pass
            if ret:
                query = {"vnp_TxnRef": txn, "vnp_ResponseCode": outcome, "vnp_Amount": amount}
                joiner = "&" if urlparse(ret).query else "?"
                self._redirect(ret + joiner + urlencode(query))
                return
            self._json(200, {"status": "SUCCEEDED" if outcome == "00" else "FAILED", "txnRef": txn})
            return
        if parsed.path.startswith("/payments"):
            self._json(201, {"status": "PROCESSING", "provider": "vnpay-sandbox"})
            return
        if parsed.path.startswith("/webhooks"):
            self._json(200, {"received": True})
            return
        self._json(404, {"error": {"code": "RESOURCE_NOT_FOUND", "message": "unknown route"}})


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8099), Handler).serve_forever()
