"""Render the 1080p campaign film from the four selected campaign posters."""
from pathlib import Path
import json
import shutil
import subprocess
import time

BASE = Path(__file__).resolve().parents[1]
PROJECT = BASE.parents[1]
SOURCE = BASE/'source'
VIDEO = BASE/'video'
VIDEO.mkdir(exist_ok=True)
ffmpeg = shutil.which('ffmpeg')
ffprobe = shutil.which('ffprobe')
if not ffmpeg or not ffprobe:
    raise SystemExit('FFmpeg and ffprobe are required.')

captions = [
    (.8,6.7,'把 Steam 游戏库，变成你的 3D 收藏书架。'),
    (7.85,14.0,'已安装与未安装游戏，一起陈列。'),
    (15.1,21.1,'抽出游戏盒，360° 查看封面、盒脊与背面。'),
    (22.4,28.1,'胡桃木氛围与自由布置，手柄和奖杯也能 360° 查看。'),
]

def timestamp(value,ass=False):
    hours=int(value//3600);minutes=int(value%3600//60);seconds=value%60
    return f'{hours}:{minutes:02d}:{seconds:05.2f}' if ass else f'{hours:02d}:{minutes:02d}:{seconds:06.3f}'.replace('.',',')

subtitles='\n\n'.join(f'{i}\n{timestamp(a)} --> {timestamp(b)}\n{text}' for i,(a,b,text) in enumerate(captions,1))+'\n'
(VIDEO/'steam-shelf-zh-CN.srt').write_text(subtitles,encoding='utf-8-sig')
ass='''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Caption,Microsoft YaHei,34,&H00F5F8FF,&H000000FF,&H001A140F,&H80000000,0,0,0,0,100,100,0,0,1,2.2,1,2,80,80,42,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
'''
for a,b,text in captions:
    ass+=f'Dialogue: 0,{timestamp(a,True)},{timestamp(b,True)},Caption,,0,0,0,,{{\\fad(180,180)}}{text}\n'
(SOURCE/'subtitles.ass').write_text(ass,encoding='utf-8-sig')

def fp(path):
    return str(path).replace('\\','/').replace(':','\\:').replace("'","\\'")

bold=fp(Path('C:/Windows/Fonts/msyhbd.ttc'))
regular=fp(Path('C:/Windows/Fonts/msyh.ttc'))
posters=['01-steam-shelf-hero.png','02-complete-library.png','03-360-inspection.png','04-personal-game-room.png']
zoom=['1.012+0.018*on/239','1.030-0.018*on/239','1.010+0.020*on/239','1.010+0.020*on/239']
filters=[]
for i in range(4):
    filters.append(f"[{i}:v]scale=3840:2160:flags=lanczos,zoompan=z='{zoom[i]}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=240:s=1920x1080:fps=30,setsar=1,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS"+(" ,fade=t=in:st=0:d=0.65" if i==0 else '')+f'[s{i}]')
filters += [
    '[4:v]setsar=1,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[endbg]',
    '[5:v]scale=128:128:flags=lanczos,format=rgba[icon]',
    "[endbg][icon]overlay=x=896:y=242:eof_action=repeat:shortest=0,"
    f"drawtext=fontfile='{bold}':text='Steam Shelf':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=413,"
    f"drawtext=fontfile='{bold}':text='把热爱，留在眼前。':fontsize=40:fontcolor=0xDCEAF6:x=(w-text_w)/2:y=530,"
    f"drawtext=fontfile='{regular}':text='Windows 桌面应用':fontsize=25:fontcolor=0xA8BFD5:x=(w-text_w)/2:y=612,"
    'drawbox=x=830:y=683:w=260:h=3:color=0x66C0F4:t=fill[end]',
    '[s0][s1]xfade=transition=fade:duration=0.75:offset=7.25[x1]',
    '[x1][s2]xfade=transition=fade:duration=0.75:offset=14.5[x2]',
    '[x2][s3]xfade=transition=fade:duration=0.75:offset=21.75[x3]',
    '[x3][end]xfade=transition=fade:duration=1:offset=28.75,fade=t=out:st=32.35:d=0.65,'
    "drawbox=x=0:y=970:w=1920:h=110:color=0x111A26@0.40:t=fill:enable='between(t,0.7,28.3)',"
    "subtitles=filename='source/subtitles.ass'[video]",
    '[6:a]loudnorm=I=-20:TP=-1.5:LRA=8,afade=t=in:st=0:d=0.4,afade=t=out:st=31.1:d=1.9[audio]',
]
graph=';\n'.join(filters)
(SOURCE/'promo-filter.txt').write_text(graph,encoding='utf-8')
command=[ffmpeg,'-hide_banner','-y','-filter_complex_threads','2']
for file in posters:
    command += ['-threads','2','-i',str(BASE/'images'/file)]
command += ['-f','lavfi','-i','color=c=0x142131:s=1920x1080:r=30:d=4.25','-threads','2','-i',str(PROJECT/'public/icon.png'),'-i',str(SOURCE/'steam-shelf-original-score.wav')]
output=VIDEO/'steam-shelf-promo-1080p.mp4'
command += ['-filter_complex',graph,'-map','[video]','-map','[audio]','-t','33','-r','30','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-threads','4','-profile:v','high','-level','4.1','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709',str(output)]
print('Rendering 33-second 1920x1080 campaign film...',flush=True)
start=time.monotonic()
with (SOURCE/'render.log').open('w',encoding='utf-8') as log:
    result=subprocess.run(command,cwd=BASE,stdout=log,stderr=subprocess.STDOUT)
if result.returncode:
    print((SOURCE/'render.log').read_text(encoding='utf-8')[-6000:],flush=True)
    raise SystemExit(result.returncode)
probe=subprocess.run([ffprobe,'-v','error','-show_format','-show_streams','-of','json',str(output)],capture_output=True,text=True,check=True)
(SOURCE/'video-info.json').write_text(probe.stdout,encoding='utf-8')
info=json.loads(probe.stdout)
video=next(s for s in info['streams'] if s['codec_type']=='video')
audio=next(s for s in info['streams'] if s['codec_type']=='audio')
assert video['width']==1920 and video['height']==1080
assert video['codec_name']=='h264' and audio['codec_name']=='aac'
assert abs(float(info['format']['duration'])-33)<.15
print(f'Rendered {output.name}: {info["format"]["duration"]}s, {int(info["format"]["size"])/1024/1024:.1f} MiB, {time.monotonic()-start:.1f}s render time.',flush=True)
