import json

d = json.load(open(".work-srs/template-inspection.json", encoding="utf-8"))
print("sha256", d["sha256"])
print("paragraphs", len(d["paragraphs"]), "tables", len(d["tables"]), "shapes", d["inline_shapes"])
print("sections", d["sections"])
print("styles")
for s in d["styles"]:
    if s["name"] in {"Normal", "Title", "Subtitle", "Heading 1", "Heading 2", "Heading 3", "TOC 1", "TOC 2", "Caption", "List Paragraph"}:
        print(s)
print("TABLES")
for t in d["tables"]:
    print(t)
print("PARAGRAPHS")
for p in d["paragraphs"]:
    print(f'{p["index"]:03d} [{p["style"]}] {p["text"]}')
