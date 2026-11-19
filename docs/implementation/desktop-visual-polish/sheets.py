from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import sys
root=Path(__file__).parent / (sys.argv[1] if len(sys.argv)>1 else 'before')
for target in ['admin','operator','customer']:
    paths=sorted(root.glob(target+'-*-viewport.png'))
    w,h=480,358
    sheet=Image.new('RGB',(w*3,h*((len(paths)+2)//3)), '#dce4ed')
    draw=ImageDraw.Draw(sheet)
    for i,path in enumerate(paths):
        img=Image.open(path).convert('RGB');img.thumbnail((480,334))
        x=(i%3)*w;y=(i//3)*h
        sheet.paste(img,(x,y+24));draw.text((x+8,y+5),path.name,fill='#10243e')
    sheet.save(root / (target+'-sheet.jpg'),quality=90)
