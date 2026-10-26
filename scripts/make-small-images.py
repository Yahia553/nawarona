# بيعمل النسخ الصغيرة من الصور (public/img/sm/) وملف public/assets/hero-sm.css
# اللي بيخلّي الموبايل الصغير اللي في أول الصفحة يستخدمها بدل الصور الكبيرة.
# شغّلوه بعد أي تغيير في صور القوالب أو في الصور جوه invite.css:
#   pip install pillow
#   python scripts/make-small-images.py
import os
import re
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
SRC, OUT = os.path.join(ROOT, 'img'), os.path.join(ROOT, 'img', 'sm')
os.makedirs(OUT, exist_ok=True)


def shrink(name, width, quality, suffix=''):
    im = Image.open(os.path.join(SRC, name + '.webp')).convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    dst = os.path.join(OUT, name + suffix + '.webp')
    im.save(dst, 'WEBP', quality=quality, method=6)
    return os.path.getsize(dst)


# كل صور القوالب: للكروت وللموبايل اللي في الهيرو
total = 0
for f in sorted(os.listdir(SRC)):
    if f.endswith('.webp'):
        total += shrink(f[:-5], 480, 62)
# الخلفيات اللي بتملا الشاشة على الموبايل (تحت طبقة غامقة)
total += shrink('royal-hall', 760, 52, '-bg') + shrink('night-bg', 760, 52, '-bg')
print('small images:', total // 1024, 'KB')

# hero-sm.css: نفس قواعد invite.css اللي فيها صور، بس جوه #phone-hero وبالنسخ الصغيرة
css = open(os.path.join(ROOT, 'assets', 'invite.css'), encoding='utf-8').read()
rules = []
for sel, body in re.findall(r'([^{}]+)\{([^{}]*url\(\.\./img/[^)]+\)[^{}]*)\}', css):
    sel = ','.join('#phone-hero ' + s.strip() for s in sel.strip().split(','))
    rules.append(sel + '{' + re.sub(r'url\(\.\./img/', 'url(../img/sm/', body).strip() + '}')
open(os.path.join(ROOT, 'assets', 'hero-sm.css'), 'w', encoding='utf-8', newline='\n').write(
    '/* متولّد من scripts/make-small-images.py — ما تعدّلوش بإيدكم */\n' + '\n'.join(rules) + '\n')
print('hero-sm.css rules:', len(rules))
