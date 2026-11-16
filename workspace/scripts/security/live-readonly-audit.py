"""Read-only local security probes. No credentials, payment confirmations or production writes.

Usage: python workspace/scripts/security/live-readonly-audit.py
Artifacts intentionally contain status codes/schema only, never application records or secrets.
"""
import json
import pathlib
import urllib.request
import urllib.error
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = ROOT / "docs/security/owasp-api-2026-11-16"
OUT.mkdir(parents=True, exist_ok=True)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

opener = urllib.request.build_opener(NoRedirect)
results = []

def probe(name, url, expected, method="GET", headers=None, body=None):
    req = urllib.request.Request(url, data=body, headers=headers or {}, method=method)
    try:
        response = opener.open(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    except urllib.error.URLError as error:
        results.append(dict(name=name, url=url, error=str(error.reason), passed=False))
        return None
    raw = response.read()
    results.append(dict(name=name, url=url, status=response.code, expected=expected,
                        passed=response.code in expected,
                        location=response.headers.get("Location"),
                        headers={k: response.headers.get(k) for k in [
                            "Content-Security-Policy", "X-Frame-Options", "Referrer-Policy",
                            "X-Content-Type-Options", "Access-Control-Allow-Origin"]}))
    return raw

inventory = {}
for service, port in [("identity",5081),("transport",5082),("booking",5083),
                      ("payment",5084),("notification",5085),("reporting",5086)]:
    data = probe(service+" openapi", f"http://127.0.0.1:{port}/openapi/v1.json", [200])
    if data:
        try:
            doc=json.loads(data)
            inventory[service] = {p: [m.upper() for m in methods if m in ["get","post","patch","put","delete"]]
                                  for p,methods in doc.get("paths",{}).items()}
        except ValueError:
            pass

for port,path in [(5081,"/api/v1/users/me"),(5082,"/api/v1/admin/organizations"),
                  (5083,"/api/v1/bookings"),(5083,"/api/v1/tickets"),
                  (5084,"/api/v1/admin/payments"),(5085,"/api/v1/notifications"),
                  (5086,"/api/v1/reports/revenue?from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z&timezone=UTC")]:
    probe("anonymous protected endpoint", f"http://127.0.0.1:{port}"+path, [401])
probe("invalid bearer", "http://127.0.0.1:5083/api/v1/bookings", [401], headers={"Authorization":"Bearer invalid"})
probe("SePay invalid browser state", "http://127.0.0.1:5084/integrations/payments/sepay/browser-return?state=tampered", [400])
probe("SePay unauthenticated IPN", "http://127.0.0.1:5084/integrations/payments/sepay/ipn", [401],
      method="POST", headers={"Content-Type":"application/json"}, body=b"{}")
# A disabled legacy provider must not bypass result validation and redirect to attacker input.
for base in ["http://127.0.0.1:5084", "http://127.0.0.1:5080"]:
    probe("legacy return rejects arbitrary redirect",base+"/integrations/payments/vnpay/return?vnp_ReturnUrl=https%3A%2F%2Fexample.invalid%2Fphishing",[400,404,422,503])
# This front image can be older than the checked-out nginx config: record its SPA fallback separately.
probe("front legacy route observation", "http://127.0.0.1:5173/integrations/payments/vnpay/return?vnp_ReturnUrl=https%3A%2F%2Fexample.invalid%2Fphishing",[200,400,404,422,503])
probe("customer document headers", "http://127.0.0.1:5173/", [200])
probe("untrusted CORS preflight", "http://127.0.0.1:5080/api/v1/bookings", [204,200,405], "OPTIONS",
      {"Origin":"https://example.invalid","Access-Control-Request-Method":"GET"})
results[-1]["passed"] = results[-1]["passed"] and results[-1]["headers"].get("Access-Control-Allow-Origin") is None

(OUT/"live-probes.json").write_text(json.dumps({"at":datetime.now(timezone.utc).isoformat(),"checks":results},indent=2),encoding="utf-8")
(OUT/"endpoint-inventory.json").write_text(json.dumps(inventory,indent=2),encoding="utf-8")
print(json.dumps({"checks":len(results),"failed":[{k:r.get(k) for k in ["name","url","status","location","error"]} for r in results if not r["passed"]],
                  "inventoriedOperations":sum(len(ms) for s in inventory.values() for ms in s.values())},indent=2))
raise SystemExit(1 if any(not r["passed"] for r in results) else 0)
