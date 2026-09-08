exec(open('mk.py').read())

def hrow(label, time, cur=False, indent=False, top=False):
    bg = "background:var(--b-muted);" if cur else ""
    pad = "padding:0 8px 0 24px;" if indent else "padding:0 8px;"
    bt = "border-top:1px solid var(--b-border);" if top else ""
    col = "color:var(--b-fg-muted);" if indent else ""
    fs = "11px" if indent else "11.5px"
    w = "font-weight:600;" if cur else ""
    return (f'<div style="display:flex;align-items:center;justify-content:space-between;min-height:26px;'
            f'{pad}{bg}{bt}{col}font-size:{fs};{w}"><span>{label}</span>'
            f'<span style="color:var(--b-fg-muted);font-size:10.5px">{time}</span></div>')

def panel(after):
    if after:
        rows = (hrow("▾ AI · 히어로 정리 (7)","방금",cur=True)
                + hrow("Button 텍스트 변경","↺",indent=True)
                + hrow("Button 색 변경","↺",indent=True)
                + hrow("Frame 간격 변경","↺",indent=True)
                + hrow("4개 더","",indent=True)
                + hrow("제목 수정","2분 전",top=True))
        b = '<div class="bdg" style="left:-9px;top:44px">19</div>'
    else:
        rows = (hrow("Button 텍스트 변경","방금",cur=True)
                + hrow("Button 색 변경","방금") + hrow("Frame 간격 변경","방금")
                + hrow("Text 추가","방금") + hrow("Text 추가","방금")
                + hrow("Frame 추가","방금") + hrow("Frame 여백 변경","방금")
                + hrow("제목 수정","2분 전",top=True))
        b = ''
    return f'''<div class="pnl">
  {b}
  <div class="phd"><span>History</span><em class="ico"><i>↺</i><i>↻</i></em></div>
  <div class="sec"><div class="sct" style="gap:0;padding:6px 0">{rows}</div></div>
</div>'''

body = f'''<div class="sheet" style="gap:15px">
  <div class="hd"><span class="num">06</span><h1>일괄 변경은 한 단계로 되돌린다</h1><span class="where">History 패널 · Cmd+Z</span></div>
  <div class="lay">
    <div class="stack"><div class="plab a"><b>지금</b><span>7개 변경 = 7개 항목</span></div>{panel(False)}</div>
    <div class="stack"><div class="plab b"><b>적용 후</b><span>묶음 1개, 펼치면 부분 되돌리기</span></div>{panel(True)}</div>
    <div class="notes">
      <div class="nt"><em>19</em><div>
        <h4>묶음은 부른 쪽이 지정할 때만 생긴다</h4>
        <p>AI 도구와 다중 선택 편집처럼 <b>한 번의 의도</b> 로 여러 변경이 나가는 경우만 묶는다. 손으로 빠르게 이어 편집한 것은 묶지 않는다.</p>
        <p class="why">왜 시간으로 안 묶나 — 시간 간격으로 자동 병합하면 "왜 이건 묶이고 저건 안 묶이지" 를 사용자가 예측할 수 없다. 의도가 기준이면 규칙이 한 줄로 설명된다.</p>
      </div></div>
      <div class="nt"><em>20</em><div>
        <h4>펼침 삼각형과 들여쓰기만 더한다</h4>
        <p>행 모양은 지금 그대로다. 묶음 행에 <b>삼각형 하나</b>, 안쪽 행에 들여쓰기와 되돌리기 표시를 준다.</p>
        <p class="why">왜 — Layers 패널이 이미 같은 삼각형과 들여쓰기 어법을 쓴다. 트리를 접고 펴는 방식이 패널마다 다르면 안 된다.</p>
      </div></div>
      <div class="nt"><em>21</em><div>
        <h4>묶음 이름은 부른 쪽이 준 문장을 쓴다</h4>
        <p>"AI · 히어로 정리 (7)" 처럼 <b>무엇을 시켰는지</b> 와 <b>몇 개가 바뀌었는지</b> 를 적는다. "일괄 변경 7건" 같은 기계 문장은 되돌릴지 판단하는 데 도움이 안 된다.</p>
      </div></div>
    </div>
  </div>
</div>'''
build('History', 1400, 560, body)
