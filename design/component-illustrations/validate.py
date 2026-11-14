#!/usr/bin/env python3
"""SVG 전달 규격과 현재 팔레트 누락 여부를 검사한다."""

from pathlib import Path
import json
import re
import sys
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True
from generate import inventory

HERE = Path(__file__).resolve().parent
NS = '{http://www.w3.org/2000/svg}'
manifest = json.loads((HERE / 'manifest.json').read_text())
expected = [item['id'] for item in inventory()]
actual = [item['id'] for item in manifest['items']]
assert expected == actual, '현재 팔레트와 manifest 불일치'
assert len(set(actual)) == len(actual) == manifest['count']
assert {p.stem for p in (HERE / 'svg').glob('*.svg')} == set(actual)
allowed = {'svg', 'title', 'desc', 'defs', 'g', 'rect', 'circle', 'path',
           'linearGradient', 'stop', 'filter', 'feDropShadow'}

for item in manifest['items']:
    file = HERE / item['file']
    root = ET.parse(file).getroot()
    assert root.attrib['width'] == root.attrib['height'] == '300', file
    assert root.attrib['viewBox'] == '0 0 300 300', file
    ids = []
    refs = []
    for node in root.iter():
        tag = node.tag.removeprefix(NS)
        assert tag in allowed, (file, tag)
        if 'id' in node.attrib:
            ids.append(node.attrib['id'])
        for key, value in node.attrib.items():
            assert not key.endswith('href'), (file, key)
            assert 'data:' not in value and 'https:' not in value, file
            for color in re.findall(r'#[0-9a-fA-F]{6}(?![\w-])', value):
                assert color[1:3] == color[3:5] == color[5:7], (file, color)
            refs.extend(re.findall(r'url\(#([^)]*)\)', value))
            if key == 'transform':
                for scale in re.findall(r'scale\(([^)]*)\)', value):
                    parts = re.split(r'[ ,]+', scale)
                    assert len(parts) == 1 or parts[0] == parts[1], (file, scale)
        if tag == 'rect':
            assert not (node.get('x') == node.get('y') == '0'
                        and node.get('width') == node.get('height') == '300'), file
    assert len(ids) == len(set(ids)), (file, '중복 ID')
    assert set(refs) <= set(ids), (file, '미정의 참조')


def element(name, suffix):
    root = ET.parse(HERE / 'svg' / f'{name}.svg').getroot()
    return next(n for n in root.iter() if n.get('id') == f'{name}-{suffix}')


for name in ('DatePicker', 'DateRangePicker'):
    a, b = element(name, 'input-form'), element(name, 'calendar-container')
    assert (a.get('x'), a.get('width')) == (b.get('x'), b.get('width'))
assert float(element('DateRangePicker', 'input-form').get('width')) == 2 * float(element('DatePicker', 'input-form').get('width'))

print(f'PASS: {len(actual)}종 등록 일치, 300×300, 기본 벡터 요소, 무채색, 외부 리소스 없음, 고유 ID, 균등 배율, 날짜 너비 정렬')
