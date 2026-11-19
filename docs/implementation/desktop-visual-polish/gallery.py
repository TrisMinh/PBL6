from pathlib import Path
from PIL import Image,ImageDraw
import html,json
root=Path(__file__).parent
sheet=Image.new('RGB',(912,332),'#e5ebf3')
d=ImageDraw.Draw(sheet)
for i,(phase,title) in enumerate([('before','Before'),('reviewed','After')]):
    img=Image.open(root/phase/'admin-account-viewport.png').convert('RGB')
    crop=img.crop((500,360,940,640))
    sheet.paste(crop,(8+i*456,36));d.text((20+i*456,12),title,fill='#10243e')
sheet.save(root/'account-before-after.png')
paths=sorted((root/'reviewed').glob('*-viewport.png'))
cards=''.join(f'<article data-group="{p.name.split("-")[0]}"><a href="reviewed/{p.name.replace("-viewport","")}"><img loading="lazy" src="reviewed/{p.name}" alt="{html.escape(p.stem)}"><span>{html.escape(p.stem.replace("-viewport",""))}</span></a></article>' for p in paths)
page='''<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BLUE desktop visual review</title><style>body{font:15px/1.6 system-ui;background:#f2f5fa;color:#10243e;margin:32px}h1{margin-bottom:8px}nav{display:flex;gap:12px;margin:24px 0}button{padding:10px 20px;border:1px solid #c6d7eb;border-radius:8px;background:white;cursor:pointer}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}article{background:white;border-radius:12px;overflow:hidden;border:1px solid #d6e0ed}article img{width:100%;display:block}a{color:inherit;text-decoration:none}article span{display:block;padding:12px;font-size:13px}header img{max-width:912px;width:100%;border-radius:12px}@media(max-width:1100px){main{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><header><h1>BLUE · Desktop visual review</h1><p>Ảnh production thật, chụp theo trạng thái. Click để xem ảnh đầy đủ. Các ảnh là bằng chứng rà trực quan, không tự chứng minh độ giống Figma.</p><img src="account-before-after.png" alt="Account dialog before and after"></header><nav><button data-filter="all">Tất cả</button><button data-filter="customer">Customer</button><button data-filter="operator">Operator</button><button data-filter="admin">Admin</button></nav><main>'''+cards+'''</main><script>document.querySelectorAll('button[data-filter]').forEach(b=>b.onclick=()=>document.querySelectorAll('article').forEach(a=>a.hidden=b.dataset.filter!=='all'&&a.dataset.group!==b.dataset.filter));</script></html>'''
(root/'review-gallery.html').write_text(page,encoding='utf-8')
print('Reviewed viewport captures:',len(paths))
