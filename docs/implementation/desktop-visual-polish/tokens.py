from pathlib import Path
import re, json
root=Path('workspace/src/apps/web/src')
files=list(root.rglob('*.css'))
defs=set()
for p in files: defs.update(re.findall(r'(--[\w-]+)\s*:',p.read_text(encoding='utf-8')))
missing={}
for p in files:
  for n in re.findall(r'var\((--[\w-]+)\s*\)',p.read_text(encoding='utf-8')):
    if n not in defs: missing.setdefault(n,[]).append(str(p))
print(json.dumps({k:list(set(v)) for k,v in missing.items()},ensure_ascii=False,indent=2))
