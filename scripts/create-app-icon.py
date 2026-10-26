"""Export the repository-native Steam Shelf glyph to SVG, PNG and Windows ICO."""
from pathlib import Path
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parent.parent
public=root/'public';build=root/'build'
public.mkdir(exist_ok=True);build.mkdir(exist_ok=True)
svg='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="112" fill="#152332"/>
<rect x="116" y="140" width="54" height="216" rx="12" fill="#d6e4d0"/>
<rect x="192" y="112" width="56" height="244" rx="12" fill="#a7c8c8"/>
<path d="M282 155Q280 143 292 140L327 131Q339 128 342 140L390 334Q393 346 381 349L346 358Q334 361 331 349Z" fill="#d6e4d0"/>
<rect x="100" y="383" width="312" height="24" rx="12" fill="#85a5b6"/>
</svg>'''
(public/'icon.svg').write_text(svg,encoding='utf-8')
factor=4
im=Image.new('RGBA',(512*factor,512*factor))
d=ImageDraw.Draw(im)
box=lambda v:tuple(int(x*factor) for x in v)
d.rounded_rectangle(box((0,0,512,512)),radius=112*factor,fill='#152332')
d.rounded_rectangle(box((116,140,170,356)),radius=12*factor,fill='#d6e4d0')
d.rounded_rectangle(box((192,112,248,356)),radius=12*factor,fill='#a7c8c8')
book=Image.new('RGBA',im.size);bd=ImageDraw.Draw(book)
bd.rounded_rectangle(box((305,133,363,357)),radius=12*factor,fill='#d6e4d0')
book=book.rotate(14,resample=Image.Resampling.BICUBIC,center=(334*factor,245*factor))
im=Image.alpha_composite(im,book);d=ImageDraw.Draw(im)
d.rounded_rectangle(box((100,383,412,407)),radius=12*factor,fill='#85a5b6')
im=im.resize((512,512),Image.Resampling.LANCZOS)
im.save(public/'icon.png')
im.save(build/'icon.ico',format='ICO',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('Created Steam Shelf SVG, PNG and 7-size Windows icon')
