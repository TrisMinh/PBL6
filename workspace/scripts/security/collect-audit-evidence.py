"""Collect local test evidence without secrets or live user records."""
import json
import os
import pathlib
import shutil
import xml.etree.ElementTree as ET

root = pathlib.Path(__file__).resolve().parents[3]
temp = pathlib.Path(os.environ["TEMP"])
out = root / "docs/security/owasp-api-2026-11-16"
out.mkdir(parents=True, exist_ok=True)

ns = {"t":"http://microsoft.com/schemas/VisualStudio/TeamTest/2010"}
summary=[]
for path in sorted((temp / "blue-owasp-test-results").glob("*.trx")):
    doc = ET.parse(path)
    counters = doc.find(".//t:Counters", ns)
    failed = [{"name":r.get("testName"),"message":r.findtext(".//t:Message", default="", namespaces=ns)}
              for r in doc.findall(".//t:UnitTestResult", ns) if r.get("outcome") == "Failed"]
    suite = doc.find(".//t:TestMethod", ns)
    summary.append(dict(file=path.name, suite=suite.get("className") if suite is not None else "",
                        counters=counters.attrib if counters is not None else {}, failed=failed))
(out/"dotnet-test-summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
for src,dst in [("blue-owasp-dotnet-dependencies.json","dotnet-dependency-audit.json"),
                ("blue-owasp-npm-audit.json","npm-dependency-audit.json"),
                ("blue-owasp-frontend.log","frontend-test-results.txt"),
                ("blue-owasp-postman.log","postman-original-results.txt"),
                ("blue-owasp-postman-current.log","postman-current-results.txt")]:
    if (temp/src).exists():
        if dst.endswith(".txt"):
            lines = (temp/src).read_text(encoding="utf-8-sig").splitlines()
            (out/dst).write_text("\n".join(line.rstrip() for line in lines).rstrip() + "\n", encoding="utf-8")
        else:
            shutil.copyfile(temp/src,out/dst)
print(json.dumps({"suites":len(summary),"total":sum(int(s["counters"].get("total",0)) for s in summary),
                  "failed":sum(int(s["counters"].get("failed",0)) for s in summary)},indent=2))
