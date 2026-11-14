#!/usr/bin/env python3
"""Components 팔레트의 편집 가능한 무채색 SVG. 표준 라이브러리만 사용한다."""

from pathlib import Path
import html
import json
import math
import re
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PALETTE = ROOT / "apps/builder/src/builder/panels/components/paletteItems.ts"
CATALOG = ROOT / "packages/shared/src/catalog/componentCatalog.ts"
CHARTS = ROOT / "packages/rendering/src/chart/authoring.ts"
DARK, MID, SOFT, LIGHT = "#505050", "#858585", "#b9b9b9", "#dedede"


def attrs(**values):
    return " ".join(f'{k.replace("_", "-")}="{html.escape(str(v), quote=True)}"' for k, v in values.items() if v is not None)


def rect(x, y, w, h, r=6, fill=LIGHT, stroke=None, sw=1.5, **kw):
    return f'<rect {attrs(x=x, y=y, width=w, height=h, rx=r, fill=fill, stroke=stroke, stroke_width=sw if stroke else None, **kw)}/>'


def circle(x, y, r, fill=DARK, stroke=None, sw=2, **kw):
    return f'<circle {attrs(cx=x, cy=y, r=r, fill=fill, stroke=stroke, stroke_width=sw if stroke else None, **kw)}/>'


def path(d, stroke=DARK, sw=3, fill="none", **kw):
    return f'<path {attrs(d=d, fill=fill, stroke=stroke, stroke_width=sw, stroke_linecap="round", stroke_linejoin="round", **kw)}/>'


def line(x, y, x2, y2, color=SOFT, sw=2, **kw):
    return path(f'M{x} {y}H{x2}' if y == y2 else f'M{x} {y}L{x2} {y2}', color, sw, **kw)


def bar(x, y, w, h=7, color=MID):
    return rect(x, y, w, h, h / 2, color)


def panel(x=38, y=64, w=224, h=172, r=18, **kw):
    return rect(x, y, w, h, r, "url(#surface)", "#a1a1a1", 1.5, filter="url(#shadow)", **kw)


def group(content, id=None, transform=None, **kw):
    return f'<g {attrs(id=id, transform=transform, **kw)}>{content}</g>'


def check(x, y, s=1, color="#eeeeee"):
    return group(path('M-7 0L-2 5L8 -6', color, 3), transform=f'translate({x} {y}) scale({s})')


def chevron(x, y, direction="down", s=1, color=DARK):
    rot = {"down": 0, "right": -90, "left": 90, "up": 180}[direction]
    return group(path('M-5 -2L0 3L5 -2', color, 2.5), transform=f'translate({x} {y}) rotate({rot}) scale({s})')


def cross(x, y, s=1, color=MID):
    return group(path('M-4 -4L4 4M-4 4L4 -4', color, 2), transform=f'translate({x} {y}) scale({s})')


def plus(x, y, s=1, color=DARK):
    return group(path('M-6 0H6M0 -6V6', color, 2.5), transform=f'translate({x} {y}) scale({s})')


def search(x, y, s=1):
    return group(circle(0, 0, 6, "none", DARK, 2.5) + line(5, 5, 10, 10, DARK, 2.5), transform=f'translate({x} {y}) scale({s})')


def calendar_icon(x, y, s=1):
    return group(rect(-8, -7, 16, 15, 3, "none", DARK, 2) + path('M-8 -2H8M-4 -10V-5M4 -10V-5', DARK, 2) + circle(-3, 3, 1.3) + circle(3, 3, 1.3), transform=f'translate({x} {y}) scale({s})')


def avatar(x, y, r=34, shade="url(#surface)"):
    return circle(x, y, r, shade, "#a1a1a1", 1.5) + circle(x, y-r*.22, r*.24, MID) + path(f'M{x-r*.49} {y+r*.48}Q{x-r*.46} {y+r*.06} {x} {y+r*.06}Q{x+r*.46} {y+r*.06} {x+r*.49} {y+r*.48}Z', "none", 0, MID)


def button(x, y, w=100, h=38, selected=False, label=True):
    return rect(x, y, w, h, 10, "url(#ink)" if selected else "url(#surface)", DARK if selected else SOFT) + (bar(x+w*.25, y+h/2-3, w*.5, 6, "#e9e9e9" if selected else DARK) if label else "")


def field(label=True, multiline=False):
    y, h = (103, 104) if multiline else (120, 58)
    return (bar(52, y-26, 69, 8, '#767676') if label else "") + panel(38, y, 224, h, 12)


def checkbox(x, y, selected=False, radio=False, disabled=False):
    color = SOFT if disabled else DARK
    s = circle(x+10, y+10, 10, "#f0f0f0", color) if radio else rect(x, y, 20, 20, 5, color if selected else "#f0f0f0", color)
    return s + (circle(x+10, y+10, 4.5, color) if radio and selected else check(x+10, y+10, .7) if selected else "")


def picture(x, y, w, h):
    return rect(x, y, w, h, 10, "url(#wash)", SOFT, 1) + circle(x+w*.73, y+h*.27, h*.11, "#eeeeee") + path(f'M{x+w*.1} {y+h*.83}L{x+w*.37} {y+h*.4}L{x+w*.56} {y+h*.64}L{x+w*.69} {y+h*.49}L{x+w*.91} {y+h*.83}Z', "none", 0, MID)


def upload(x, y, s=1):
    return group(path('M-22 12V23Q-22 28 -17 28H17Q22 28 22 23V12M0 14V-23M-12 -11L0 -23L12 -11', DARK, 4), transform=f'translate({x} {y}) scale({s})')


def calendar(x, y, scale=1, selection=False, month=0, spanning=False):
    # 원점 기준 너비 128. 날짜와 선택 범위는 같은 격자의 중심을 공유한다.
    out = bar(13, 13, 46, 5, DARK) + chevron(99, 16, "left", .6) + chevron(115, 16, "right", .6)
    out += line(10, 31, 118, 31, LIGHT, 1)
    xs = [16 + 16*i for i in range(7)]
    for cx in xs:
        out += bar(cx-3, 38, 6, 3, SOFT)
    if spanning:
        start, end = (15, 31) if month == 0 else (2, 19)
        for row in range(start // 7, end // 7 + 1):
            lo, hi = max(start, row * 7) % 7, min(end, row * 7 + 6) % 7
            out += rect(xs[lo]-7, 47+row*16, xs[hi]-xs[lo]+14, 14, 7, SOFT)
        endpoint = start if month == 0 else end
        out += circle(xs[endpoint % 7], 54+(endpoint // 7)*16, 7, DARK)
    elif selection:
        out += group(rect(xs[1], 79, xs[5]-xs[1], 14, 0, SOFT) + circle(xs[1], 86, 7, DARK) + circle(xs[5], 86, 7, DARK), id=f'month-{month}-range')
    else:
        out += circle(xs[3], 86, 7, DARK)
    for row in range(5):
        for col, cx in enumerate(xs):
            cy = 54 + row*16
            active = (row*7+col == endpoint) if spanning else row == 2 and (col in (1, 5) if selection else col == 3)
            shade = "#eeeeee" if active else SOFT if (row == 0 and col < month+1) or (row == 4 and col > 3) else MID
            out += bar(cx-2.5, cy-1.5, 5, 3, shade)
    return group(out, id=f'month-{month}', transform=f'translate({x} {y}) scale({scale})')


def chart(kind):
    out = panel(32, 48, 236, 204) + bar(53, 67, 64, 7, DARK) + circle(232, 71, 3, SOFT)
    if kind in ('bar', 'line', 'area', 'scatter'):
        for y in (107, 143, 179, 215):
            out += line(56, y, 245, y, LIGHT, 1)
        out += path('M56 98V215H245', SOFT, 1.5)
        if kind == 'bar':
            for i, h in enumerate((48, 80, 62, 106)):
                out += rect(69+i*43, 215-h, 15, h, 4, "url(#ink)") + rect(86+i*43, 215-h*.65, 10, h*.65, 3, SOFT)
        elif kind in ('line', 'area'):
            curve = 'M62 192C82 192 83 148 108 154S139 190 155 151S185 143 197 124S225 115 240 103'
            if kind == 'area':
                out += path(curve+'L240 214H62Z', 'none', 0, 'url(#wash)')
            out += path(curve, DARK, 4)
            if kind == 'line':
                for x, y in ((62,192),(108,154),(155,151),(197,124),(240,103)):
                    out += circle(x,y,4,"#eeeeee",DARK,2)
        else:
            for x,y,r in ((70,190,5),(86,173,7),(107,184,4),(111,149,6),(138,162,7),(153,128,5),(173,146,4),(189,108,7),(214,126,5),(235,103,6)):
                out += circle(x,y,r,DARK if r>5 else MID)
    elif kind == 'pie':
        out += circle(149,160,66,SOFT)
        out += path('M149 160V94A66 66 0 0 1 206.16 193Z', '#ededed', 3, DARK)
        out += path('M149 160L206.16 193A66 66 0 0 1 92 193Z', '#ededed', 3, MID)
    elif kind == 'radar':
        def points(r):
            return [(150+math.sin(i*math.tau/5)*r,161-math.cos(i*math.tau/5)*r) for i in range(5)]
        for r in (28,48,68):
            p=points(r);out+=path('M'+'L'.join(f'{x:.2f} {y:.2f}' for x,y in p)+'Z',SOFT,1)
        for x,y in points(68):out+=line(150,161,x,y,SOFT,1)
        p=[(150,100),(204,143),(174,195),(122,200),(109,148)]
        out+=path('M'+'L'.join(f'{x} {y}' for x,y in p)+'Z',DARK,3,SOFT,fill_opacity='.6')
        for x,y in p:out+=circle(x,y,4,DARK)
    elif kind == 'radial':
        for r,fill,length in ((65,DARK,282),(45,MID,190),(25,SOFT,110)):
            out+=circle(150,162,r,'none',LIGHT,12)
            out+=circle(150,162,r,'none',fill,12,stroke_dasharray=f'{length} {2*math.pi*r}',stroke_linecap='round',transform='rotate(-90 150 162)')
    else:
        raise ValueError(kind)
    return out


def draw(name):
    if name.startswith('chart-'):
        return chart(name[6:])
    if name == 'Text':
        return panel(42,78,216,144) + bar(66,103,128,13,DARK) + ''.join(bar(66,y,w,8,MID) for y,w in ((134,168),(156,150),(178,110)))
    if name == 'Icon':
        return panel(75,75,150,150,32) + path('M150 104L164 132L195 137L172 159L178 190L150 175L122 190L128 159L105 137L136 132Z',DARK,4,'url(#wash)')
    if name == 'Keyboard':
        out=panel(35,100,230,100,20)
        for x,w in ((51,51),(112,51),(173,76)):
            out+=rect(x,116,w,64,10,'#eeeeee',SOFT)+line(x+5,172,x+w-5,172,LIGHT,3)
        return out+path('M68 135C61 123 82 123 75 135V153C82 165 61 165 68 153H86C98 160 98 140 86 147H68C57 140 57 160 68 153M86 147V135C93 123 73 123 80 135H68',DARK,2)+path('M137 132V157M127 142L137 132L147 142',DARK,3)+path('M226 133V147H194M202 139L194 147L202 155',DARK,3)
    if name == 'Separator':
        return panel(38,79,224,142)+bar(61,102,92,7,SOFT)+bar(61,120,144,6,LIGHT)+line(59,151,241,151,DARK,4)+bar(61,176,124,7,SOFT)+bar(61,194,93,6,LIGHT)
    if name == 'Badge':
        return panel(60,107,180,86,28)+circle(91,150,10,MID)+bar(113,144,99,12,DARK)
    if name in ('ProgressBar','Meter'):
        out=panel(32,94,236,112)+bar(54,115,74,7,DARK)+bar(213,115,32,7,MID)
        if name=='ProgressBar':return out+rect(54,147,192,16,8,LIGHT)+rect(54,147,126,16,8,'url(#ink)')
        for i in range(12):out+=rect(54+i*16,147,12,20,3,DARK if i<8 else LIGHT)
        return out+path('M178 180L184 174L190 180',MID,2)
    if name == 'Skeleton':
        return panel(38,60,224,180)+circle(78,101,21,'url(#wash)')+bar(112,86,122,10,LIGHT)+bar(112,108,83,8,LIGHT)+''.join(bar(59,y,w,10,'url(#wash)') for y,w in ((146,182),(169,156),(192,112)))
    if name == 'Avatar':return group(avatar(150,150,76),filter='url(#shadow)')
    if name == 'AvatarGroup':return group(''.join(avatar(x,150,43,shade) for x,shade in ((80,'#dfdfdf'),(150,'#e6e6e6'),(220,'#eeeeee'))),filter='url(#shadow)')
    if name == 'LabeledValue':return panel(47,91,206,118)+bar(69,114,64,8,MID)+bar(69,143,151,15,DARK)+bar(69,177,103,5,SOFT)
    if name == 'StatusLight':return panel(45,111,210,78,24)+circle(80,150,10,DARK)+circle(80,150,17,'none',LIGHT,4)+bar(108,145,117,10,DARK)
    if name == 'ActionBar':return panel(27,111,246,78,18)+checkbox(43,140,True)+bar(74,147,45,6,DARK)+line(133,129,133,171,SOFT)+button(146,130,41,40,False,False)+plus(167,150)+button(195,130,60,40,True)+bar(43,91,89,6,SOFT)
    if name == 'SelectBoxGroup':
        out=''
        for i in range(2):
            x=31+124*i;out+=panel(x,82,114,136,15)+rect(x+1,83,112,134,14,'none',DARK if i==0 else SOFT,2)+checkbox(x+14,98,i==0)+bar(x+14,144,72,8,DARK)+bar(x+14,165,81,5,MID)+bar(x+14,181,53,5,SOFT)
        return out
    if name == 'InlineAlert':return panel(31,90,238,120)+circle(62,120,13,DARK)+line(62,113,62,121,'#ededed',3)+circle(62,127,1.7,'#ededed')+bar(88,114,112,10,DARK)+bar(88,141,151,6,MID)+bar(88,158,126,6,MID)+bar(88,182,65,6,DARK)
    if name == 'ProgressCircle':return circle(150,150,76,'#ececec',SOFT,1.5,filter='url(#shadow)')+circle(150,150,52,'none',LIGHT,12)+circle(150,150,52,'none',DARK,12,stroke_dasharray='229 327',stroke_linecap='round',transform='rotate(-90 150 150)')+bar(129,146,42,8,MID)
    if name == 'Image':return panel(39,65,222,170)+picture(51,77,198,146)
    if name == 'IllustratedMessage':return panel(42,38,216,224)+picture(93,63,114,92)+bar(91,179,118,10,DARK)+bar(70,202,160,6,MID)+bar(96,219,108,6,SOFT)
    if name == 'Card':return panel(58,37,184,226)+picture(71,50,158,108)+bar(77,179,107,10,DARK)+bar(77,201,145,6,MID)+bar(77,217,102,6,SOFT)+bar(77,239,58,6,DARK)
    if name == 'frame':
        out=panel(47,57,206,186,3)+rect(65,78,170,145,5,'none',SOFT,1.5,stroke_dasharray='6 6')+rect(81,95,61,111,8,LIGHT)+rect(154,95,65,48,8,SOFT)+rect(154,155,65,51,8,LIGHT)
        for x in (47,253):
            for y in (57,243):out+=rect(x-5,y-5,10,10,2,'#eeeeee',DARK,2)
        return out
    if name == 'Section':return panel(36,57,228,186)+bar(55,77,88,10,DARK)+line(55,104,245,104,SOFT)+rect(55,121,83,99,10,LIGHT)+rect(151,121,94,42,8,SOFT)+bar(151,178,86,7,MID)+bar(151,196,63,7,SOFT)
    if name == 'Tabs':return panel(34,70,232,160)+bar(55,89,45,7,DARK)+bar(123,89,44,7,SOFT)+bar(191,89,44,7,SOFT)+line(35,111,265,111,LIGHT)+bar(53,108,50,4,DARK)+bar(56,139,126,10,MID)+bar(56,164,182,7,SOFT)+bar(56,185,146,7,SOFT)
    if name == 'Breadcrumbs':return panel(28,113,244,74)+bar(47,146,42,8,SOFT)+chevron(105,150,'right',.8,MID)+bar(122,146,46,8,MID)+chevron(186,150,'right',.8,MID)+bar(202,146,51,8,DARK)
    if name == 'Link':return panel(61,110,178,80)+bar(83,140,108,10,DARK)+line(83,159,191,159,DARK,2)+path('M205 151L219 137M209 137H219V147',DARK,2.5)
    if name == 'Nav':return panel(27,109,246,82)+rect(40,124,70,50,10,LIGHT)+bar(51,144,48,8,DARK)+bar(125,144,51,8,MID)+bar(197,144,47,8,MID)+bar(51,170,48,3,DARK)
    if name in ('SideNav','SideNavPanel'):
        out=panel(71,40,158,220) if name=='SideNav' else panel(35,40,230,220)
        x=85 if name=='SideNav' else 48
        if name=='SideNavPanel':out+=bar(51,62,88,9,DARK)+line(193,87,193,242,LIGHT)+bar(207,111,40,6,SOFT)+bar(207,127,30,6,LIGHT)+bar(207,155,40,6,SOFT)
        for i in range(4):
            y=94+i*36;out+=(rect(x,y,130,30,8,LIGHT) if i==0 else '')+rect(x+11,y+10,10,10,3,DARK if i==0 else MID)+bar(x+33,y+12,75-i*8,6,DARK if i==0 else MID)
        return out
    if name == 'Pagination':
        out=panel(27,111,246,78)
        for i in range(5):
            x=42+i*45;out+=button(x,130,36,38,i==1,False)
            out+=chevron(x+18,149,'left' if i==0 else 'right') if i in (0,4) else bar(x+14,144,8,10,'#eeeeee' if i==1 else MID)
        return out
    if name in ('Menu','ListBox'):
        out=panel(57,45,186,210,16)
        for i in range(4):
            y=67+i*44
            if i==1:out+=rect(68,y-2,164,36,8,LIGHT)
            out+=rect(80,y+8,14,14,4,MID)+bar(106,y+11,80-i*7,7,DARK if i==1 else MID)
            if name=='Menu':out+=chevron(216,y+15,'right',.7)
            elif i==1:out+=check(214,y+15,.65,DARK)
        return out
    if name in ('Accordion','Disclosure'):
        out=panel(37,54 if name=='Accordion' else 77,226,192 if name=='Accordion' else 146)
        y=76 if name=='Accordion' else 99
        out+=bar(58,y,117,8,DARK)+chevron(237,y+4)+bar(60,y+36,178,7,MID)+bar(60,y+54,140,7,SOFT)
        if name=='Accordion':
            for yy in (167,207):out+=line(53,yy-12,247,yy-12,LIGHT)+bar(58,yy,101,7,MID)+chevron(237,yy+4,'right')
        return out
    if name == 'CardView':
        out=''
        for x in (39,157):
            for y in (43,157):out+=panel(x,y,104,100,12)+picture(x+9,y+9,86,49)+bar(x+12,y+69,64,7,DARK)+bar(x+12,y+83,43,4,MID)
        return out
    if name == 'Slot':return panel(49,55,202,190)+rect(65,71,170,158,12,'none',MID,2,stroke_dasharray='7 7')+circle(150,141,26,LIGHT)+plus(150,141,1.5)+bar(115,190,70,7,MID)
    if name in ('Button','LinkButton','ActionButton','ToggleButton'):
        if name=='ActionButton':return panel(103,103,94,94,21)+plus(150,150,2)
        if name=='ToggleButton':return panel(74,113,152,74,18)+rect(78,117,144,66,15,'url(#ink)')+check(103,150)+bar(125,145,75,10,'#eeeeee')
        out=panel(57,112,186,76,23)+button(61,116,178,68,name=='Button',False)+bar(91,145,99 if name=='Button' else 80,10,'#eeeeee' if name=='Button' else DARK)
        return out+(path('M194 155L209 140M198 140H209V151',DARK,3) if name=='LinkButton' else plus(213,150,.8,'#eeeeee'))
    if name in ('ActionButtonGroup','ToggleButtonGroup','Toolbar','ButtonGroup','SegmentedControl'):
        out=panel(28,109,244,82,20)
        if name=='ButtonGroup':return out+button(42,128,100,44,False)+button(154,128,104,44,True)
        for i in range(3):
            x=41+i*74;selected=(name in ('ToggleButtonGroup','SegmentedControl') and i==1)
            out+=button(x,124,70,52,selected, name=='SegmentedControl')
            if name!='SegmentedControl':
                if i==0:out+=plus(x+35,150,1.2)
                elif i==1:out+=check(x+35,150,1.2,'#eeeeee' if selected else DARK)
                else:out+=path(f'M{x+27} 143H{x+43}M{x+27} 150H{x+40}M{x+27} 157H{x+43}',DARK,3)
        if name=='Toolbar':out+=bar(40,91,68,6,SOFT)+line(114,128,114,172,SOFT)
        return out
    if name in ('TextField','TextArea','TokenField','NumberField','SearchField','ColorField'):
        out=field(multiline=name in ('TextArea','TokenField'))
        if name=='TextArea':out+=bar(56,123,150,7,MID)+bar(56,145,172,7,MID)+bar(56,167,101,7,MID)+line(239,185,248,176,SOFT)+line(242,193,250,185,SOFT)
        elif name=='TokenField':
            for x,y,w in ((54,117,87),(152,117,88),(54,157,107)):
                out+=rect(x,y,w,29,8,LIGHT)+bar(x+10,y+11,w-36,6,DARK)+cross(x+w-12,y+14,.7)
            out+=line(174,164,174,179,DARK,2)
        elif name=='NumberField':out+=bar(57,145,67,9,DARK)+line(219,121,219,177,LIGHT)+line(220,149,260,149,LIGHT)+chevron(240,135,'up')+chevron(240,162)
        elif name=='SearchField':out+=search(64,147,1.2)+bar(91,145,115,8,MID)+cross(239,149)
        elif name=='ColorField':out+=rect(52,133,31,31,7,'url(#ink)',SOFT)+bar(97,145,112,8,DARK)
        else:out+=bar(56,145,107,9,MID)+line(170,139,170,159,DARK,2)+bar(53,197,131,6,SOFT)
        return out
    if name in ('Autocomplete','ComboBox','Select'):
        out=bar(48,48,72,7,'#767676')+panel(36,68,228,47,12)+panel(36,126,228,128,12)
        if name=='Autocomplete':out+=search(57,89)+bar(79,88,113,7,MID)+cross(243,91)
        else:out+=bar(53,88,119,7,DARK)+chevron(242,91)
        if name=='ComboBox':out+=line(182,80,182,102,DARK,1.5)
        for i in range(3):
            y=139+i*34
            if i==1:out+=rect(46,y-2,208,30,7,LIGHT)
            out+=bar(58,y+9,105-i*15,7,DARK if i==1 else MID)
            if i==1:out+=check(237,y+12,.7,DARK)
        return out
    if name == 'ColorArea':return panel(49,49,202,202)+rect(63,63,174,174,12,'url(#area)')+rect(63,63,174,174,12,'url(#shade)')+circle(188,112,10,'none','#eeeeee',4)+circle(188,112,12,'none',DARK,1.5)
    if name in ('ColorSlider','Slider','RangeSlider'):
        out=panel(31,99,238,102)+bar(52,119,73,7,DARK)+bar(217,119,27,7,MID)
        if name=='ColorSlider':return out+rect(52,151,196,15,7.5,'url(#area)')+circle(172,158.5,12,'#eeeeee',DARK,3)
        out+=rect(52,153,196,9,4.5,LIGHT)+rect(96 if name=='RangeSlider' else 52,153,106 if name=='RangeSlider' else 124,9,4.5,DARK)
        for x in ([96,202] if name=='RangeSlider' else [176]):out+=circle(x,157.5,12,'#eeeeee',DARK,3)
        return out
    if name == 'ColorWheel':
        out=circle(150,150,92,'url(#surface)',SOFT,1.5,filter='url(#shadow)')+circle(150,150,63,'none',LIGHT,26)
        for i in range(12):
            val=round(65+abs(i-5.5)*27);gray=f'#{val:02x}{val:02x}{val:02x}'
            a=(i*30-90)*math.pi/180;b=((i+1)*30-90)*math.pi/180
            out+=path(f'M{150+63*math.cos(a):.3f} {150+63*math.sin(a):.3f}A63 63 0 0 1 {150+63*math.cos(b):.3f} {150+63*math.sin(b):.3f}',gray,26).replace('stroke-linecap="round"', 'stroke-linecap="butt"')
        return out+circle(213,150,11,'none','#eeeeee',4)+circle(213,150,13,'none',DARK,1.5)
    if name == 'ColorSwatch':return panel(83,83,134,134,28)+rect(98,98,104,104,18,'url(#ink)',MID)
    if name == 'ColorSwatchPicker':
        out=panel(41,80,218,140)
        for row in range(2):
            for col in range(4):
                shade=['#e1e1e1','#bcbcbc','#8a8a8a','#505050'][col];x=58+48*col;y=98+57*row
                out+=rect(x,y,39,44,9,shade,SOFT)
                if (row,col)==(1,2):out+=rect(x-3,y-3,45,50,11,'none',DARK,2)+check(x+20,y+22,.8)
        return out
    if name in ('Checkbox','CheckboxGroup','RadioGroup'):
        single=name=='Checkbox';out=panel(45,110 if single else 65,210,80 if single else 170)
        for i in range(1 if single else 3):
            y=(140 if single else 88)+i*49
            out+=checkbox(66,y,i==0,name=='RadioGroup',i==2)+bar(103,y+6,117-i*17,8,SOFT if i==2 else DARK if i==0 else MID)
        return out
    if name == 'Switch':
        out=panel(39,81,222,138)
        for i in range(2):
            y=104+i*56;out+=rect(57,y,64,34,17,'url(#ink)' if i==0 else LIGHT,SOFT)+circle(103 if i==0 else 75,y+17,12,'#eeeeee',SOFT,1)+bar(139,y+13,99 if i==0 else 76,8,DARK if i==0 else SOFT)
        return out
    if name == 'DropZone':return panel(37,54,226,192)+rect(52,69,196,162,13,'none',MID,2,stroke_dasharray='7 7')+upload(150,123,.9)+bar(90,175,120,8,DARK)+bar(109,196,82,6,SOFT)
    if name == 'FileTrigger':return panel(49,108,202,84,20)+upload(85,146,.55)+bar(116,145,106,10,DARK)
    if name == 'FileUpload':
        out=panel(36,36,228,228)+rect(50,51,200,95,12,'none',MID,1.5,stroke_dasharray='5 5')+upload(150,81,.6)+bar(100,118,100,6,MID)
        for i in range(2):
            y=163+i*47;out+=rect(52,y,22,29,4,LIGHT,SOFT)+bar(85,y+3,102-i*19,6,DARK)+rect(85,y+19,136,5,2.5,LIGHT)+rect(85,y+19,136 if i==0 else 75,5,2.5,MID)+(check(239,y+13,.6,DARK) if i==0 else cross(239,y+13,.7))
        return out
    if name == 'Form':
        out=panel(52,32,196,236)+bar(70,53,88,10,DARK)
        for y in (89,151):out+=bar(70,y,50,6,MID)+rect(70,y+16,160,32,7,'#f1f1f1',SOFT)+bar(81,y+29,89,6,SOFT)
        return out+button(139,221,91,30,True)
    if name == 'Table':
        out=panel(28,60,244,180,12)+rect(40,72,220,31,6,LIGHT)
        for row in range(5):
            y=83+row*30
            if row>0:out+=line(40,y+18,260,y+18,LIGHT,1)
            out+=checkbox(44,y-5,row==2,False,row!=2)
            for x,w in ((80,54),(150,38),(207,39)):out+=bar(x,y+1,w-(row%2)*8,6,DARK if row==0 else MID)
        return out
    if name == 'GridList':
        out=panel(41,44,218,212)
        for i in range(3):
            y=59+i*64;out+=rect(53,y,194,57,9,LIGHT if i==1 else '#ededed',SOFT if i==1 else None)+picture(61,y+8,42,41)+bar(116,y+13,91,7,DARK)+bar(116,y+31,67,5,MID)+(check(232,y+28,.65,DARK) if i==1 else circle(232,y+28,6,'none',SOFT,1.5))
        return out
    if name == 'Tree':
        out=panel(47,45,206,210)+path('M77 92V207H93M77 128H93M103 143V167H121',SOFT,1.5)
        for x,y,w,opened in ((64,70,105,True),(91,112,91,True),(119,153,79,False),(91,194,91,False)):
            out+=chevron(x+7,y+9,'down' if opened else 'right',.7)+rect(x+20,y,16,17,4,SOFT)+bar(x+46,y+5,w-40,7,DARK if opened else MID)
        return out
    if name == 'TagGroup':
        out=panel(35,88,230,124)
        for x,y,w in ((51,104,90),(152,104,97),(51,159,116),(178,159,71)):
            out+=rect(x,y,w,34,10,LIGHT,SOFT)+bar(x+12,y+14,w-40,6,DARK)+cross(x+w-14,y+17,.75)
        return out
    if name in ('Calendar','RangeCalendar'):
        return panel(38,36,224,228,18)+calendar(38,41,1.75,name=='RangeCalendar')
    if name in ('DatePicker','DateRangePicker'):
        double=name=='DateRangePicker';w=256 if double else 128;x=(300-w)/2
        out=bar(x+3,48,67,7,'#767676')+panel(x,69,w,40,10,id='input-form')+panel(x,121,w,142,13,id='calendar-container')
        if double:
            out+=bar(x+12,86,75,6,DARK)+line(118,89,128,89,MID)+bar(140,86,75,6,DARK)+calendar_icon(258,89,.8)+line(150,133,150,250,LIGHT,1)+calendar(x,124,1,True,0,True)+calendar(x+128,124,1,True,1,True)
        else:out+=bar(x+10,86,72,6,DARK)+calendar_icon(x+108,89,.8)+calendar(x,124,1,False)
        return out
    if name in ('DateField','TimeField'):
        out=bar(51,97,72,8,'#767676')+panel(35,122,230,60,12)
        # 각 segment 중심과 delimiter 중심을 41px 간격의 같은 축에 놓는다.
        for x,w in ((68,30),(150,30),(232,30)):
            out+=bar(x-w/2,148,w,8,DARK)
        for x in (109,191):
            out+=path(f'M{x-3} 159L{x+3} 145',MID,2.5) if name=='DateField' else circle(x,148,2,MID)+circle(x,156,2,MID)
        return out+bar(51,202,115,6,SOFT)
    if name in ('Dialog','Sheet'):
        out=panel(29,35,242,230,20)+rect(40,46,220,208,13,'#c6c6c6')
        y=137 if name=='Sheet' else 73;h=117 if name=='Sheet' else 162
        out+=panel(51 if name=='Dialog' else 40,y,198 if name=='Dialog' else 220,h,15)
        if name=='Sheet':out+=bar(126,147,48,4,SOFT)
        out+=bar(68,y+25,108,10,DARK)+cross(229,y+28)+bar(68,y+52,160,6,MID)+bar(68,y+63,123,6,SOFT)+button(164,y+h-38,66,28,True)+button(90,y+h-38,65,28)
        return out
    if name in ('Popover','PreviewTrigger','ContextualHelp','Tooltip'):
        tooltip=name=='Tooltip';y=63 if name!='PreviewTrigger' else 40;h=74 if tooltip else 142 if name=='PreviewTrigger' else 124
        out=panel(45,y,210,h,15)+path(f'M139 {y+h-1}L150 {y+h+11}L161 {y+h-1}',SOFT,1.5,'#dedede')
        if tooltip:out+=bar(71,y+25,156,8,DARK)+bar(94,y+44,110,6,MID)
        elif name=='PreviewTrigger':out+=picture(59,y+13,182,77)+bar(60,y+105,105,8,DARK)+bar(60,y+123,145,5,MID)
        else:out+=bar(64,y+22,124,9,DARK)+bar(64,y+49,170,6,MID)+bar(64,y+66,147,6,MID)+bar(64,y+95,66,6,DARK)
        by=y+h+30
        if name=='ContextualHelp':out+=circle(150,by+18,19,'url(#surface)',SOFT,1.5)+path(f'M144 {by+12}Q144 {by+5} 151 {by+5}Q159 {by+5} 157 {by+13}L150 {by+19}',DARK,2.5)+circle(150,by+26,1.8,DARK)
        else:out+=button(99,by,102,36,False,name!='PreviewTrigger')+(path(f'M128 {by+18}Q150 {by-1} 172 {by+18}Q150 {by+37} 128 {by+18}Z',MID,2)+circle(150,by+18,5,DARK) if name=='PreviewTrigger' else '')
        return out
    raise ValueError(f'일러스트 누락: {name}')


DEFS = '''<defs>
<linearGradient id="surface" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f4f4f4"/><stop offset="1" stop-color="#dedede"/></linearGradient>
<linearGradient id="ink" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#777777"/><stop offset="1" stop-color="#4c4c4c"/></linearGradient>
<linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e1e1e1"/><stop offset="1" stop-color="#b5b5b5"/></linearGradient>
<linearGradient id="area" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#eeeeee"/><stop offset="1" stop-color="#555555"/></linearGradient>
<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#303030" stop-opacity="0"/><stop offset="1" stop-color="#303030" stop-opacity=".8"/></linearGradient>
<filter id="shadow" x="0" y="0" width="300" height="300" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity=".16"/></filter>
</defs>'''


def inventory():
    src = PALETTE.read_text().split('}> = [',1)[1].split('];',1)[0]
    entries = re.findall(r'\{ type: "([^"]+)"([^}]*)}',src)
    chart_types = re.findall(r'descriptor\(\s*"([^"]+)",\s*"([^"]+)"',CHARTS.read_text())
    catalog=CATALOG.read_text()
    result=[]
    for name, flags in entries:
        if 'libraryOnly: true' in flags:
            continue
        if name=='Chart':
            result.extend({'id':f'chart-{t}','componentType':'Chart','category':'charts','label':label} for t,label in chart_types)
            continue
        match=re.search(r'(?:primitiveEntry|reusableEntry|nativeEntry)\(\s*"'+re.escape(name)+r'"[\s\S]*?category: "([^"]+)"',catalog)
        category=match.group(1) if match else 'content' if name=='Image' else 'layout'
        result.append({'id':name,'componentType':name,'category':category,'label':name,**({'layoutOnly':True} if name=='Slot' else {})})
    return result


def svg(name):
    body=draw(name)
    s=f'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300" fill="none" role="img" aria-labelledby="title desc"><title id="title">{name}</title><desc id="desc">투명 배경의 편집 가능한 무채색 {name} 컴포넌트 일러스트</desc>{DEFS}<g id="illustration">{body}</g></svg>'
    # 여러 SVG를 같은 문서에 붙여 넣어도 그라데이션/필터 ID가 충돌하지 않는다.
    ids=re.findall(r'id="([^"]+)"',s)
    for id in ids:
        s=s.replace(f'id="{id}"',f'id="{name}-{id}"').replace(f'url(#{id})',f'url(#{name}-{id})')
    s=s.replace('aria-labelledby="title desc"',f'aria-labelledby="{name}-title {name}-desc"')
    root=ET.fromstring(s);ET.indent(root,space='  ')
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    return ET.tostring(root,encoding='unicode')+'\n'


def sheet(items, bg, filename, columns=6, cell=210):
    rows=math.ceil(len(items)/columns);w=columns*cell;h=rows*(cell+28)+65
    fg='#454545' if bg=='#ffffff' else '#eeeeee'
    out=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'+rect(0,0,w,h,0,bg)+f'<text x="24" y="37" font-family="sans-serif" font-size="18" fill="{fg}">COMPONENTS / {len(items)} / GRAYSCALE</text>'
    for i,item in enumerate(items):
        x=(i%columns)*cell;y=60+(i//columns)*(cell+28)
        source=svg(item['id']).replace('width="300" height="300"',f'x="{x}" y="{y}" width="{cell}" height="{cell}"',1)
        out+=source+f'<text x="{x+cell/2}" y="{y+cell+9}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="{fg}">{item["label"]}</text>'
    out+='</svg>\n'
    (HERE/filename).write_text(out)


def main():
    items=inventory()
    (HERE/'svg').mkdir(parents=True,exist_ok=True)
    for item in items:
        (HERE/'svg'/f'{item["id"]}.svg').write_text(svg(item['id']))
        item['file']=f'svg/{item["id"]}.svg'
    manifest={'size':[300,300],'background':'transparent','paletteSource':str(PALETTE.relative_to(ROOT)),'excluded':[{'id':'Toast','reason':'libraryOnly: true; Components 패널에서 제외'}],'count':len(items),'items':items}
    serialized=json.dumps(manifest,ensure_ascii=False,indent=2).replace('[\n    300,\n    300\n  ]','[300, 300]')
    (HERE/'manifest.json').write_text(serialized+'\n')
    for bg,suffix in (('#ffffff','light'),('#000000','dark')):
        sheet(items,bg,f'contact-sheet-{suffix}.svg')
        sheet([i for i in items if i['category']=='dateTime'],bg,f'date-time-{suffix}.svg',3,300)
    print(f'{len(items)} editable SVG illustrations generated at {HERE}')


if __name__=='__main__':
    main()
