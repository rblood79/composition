exec(open('mk.py').read())

# ---------- screen 탭 ----------
def resp(after):
    s = lambda c: f'<i class="src {c}"></i>' if after else ''
    ov = '''<div class="sct" style="gap:5px">
    <div class="lg" style="margin-bottom:2px">Tablet 에서 재정의된 값</div>
    <div class="mrow" style="padding:0"><span>Font Size</span><span>16 → 14px</span></div>
    <div class="mrow" style="padding:0"><span>Align Items</span><span>start → center</span></div>
    <div class="mrow" style="padding:0"><span>Padding</span><span>16 → 12px</span></div>
  </div>''' if after else ''
    return f'''<div class="sec">
  <div class="shd"><b>Responsive</b><em class="ico"><i>↺</i><i>⌃</i></em></div>
  <div class="sct">
    <div class="fg"><div class="lg">Breakpoint</div><div class="seg"><span>Desktop</span><span class="on">Tablet</span><span>Mobile</span></div></div>
    <div class="fg"><div class="lg">{s("s-ov")}Visibility</div><div class="seg"><span class="on">표시</span><span>숨김</span></div></div>
  </div>
  {ov}
</div>'''

def panel_screen(after):
    chips = '<div class="chips"><span class="chip on">Local</span><span class="chip"><i class="src s-ov"></i>card-base · 12</span><span class="chip">+</span></div>' if after else ''
    b = '<div class="bdg" style="left:-9px;top:170px">13</div>' if after else ''
    return f'''<div class="pnl">
  {b}
  <div class="phd"><span>Button</span><em class="ico"><i>⧉</i><i>⎘</i></em></div>
  {chips}
  {tabs("screen")}
  {resp(after)}
</div>'''

body = f'''<div class="sheet" style="gap:15px">
  <div class="hd"><span class="num">탭 4/5</span><h1>화면 — Responsive</h1><span class="where">Styles 패널 233px · 전체 필드</span></div>
  <div class="lay">
    <div class="stack"><div class="plab a"><b>지금</b><span>어느 값이 재정의됐는지 이 탭에서 알 수 없다</span></div>{panel_screen(False)}</div>
    <div class="stack"><div class="plab b"><b>적용 후</b><span>재정의 목록이 여기 모인다</span></div>{panel_screen(True)}</div>
    <div class="notes">
      <div class="nt"><em>13</em><div>
        <h4>보라 막대가 가리키는 곳을 이 탭이 목록으로 받는다</h4>
        <p>다른 탭에서 보라 막대를 본 사용자가 <b>"그럼 이 breakpoint 에서 뭘 바꿨지"</b> 를 물을 자리가 지금은 없다. 화면 탭 아래에 재정의된 값 목록을 둔다. 원래 값과 바뀐 값을 한 줄에 같이 보여준다.</p>
        <p class="why">왜 여기인가 — 화면 탭은 지금 컨트롤이 둘뿐이라 가장 비어 있다. 새 섹션을 만들 필요 없이 남는 자리에 들어간다.</p>
      </div></div>
      <div class="nt"><em>14</em><div>
        <h4>목록 행은 Modified 뷰와 같은 어법을 쓴다</h4>
        <p>왼쪽에 속성 이름, 오른쪽에 값을 고정폭 글자로. 이미 Modified 뷰가 쓰는 <b>같은 행 모양</b> 이라 새로 배울 게 없다.</p>
        <p class="why">왜 — 같은 성격의 목록이 패널 안에서 두 모양을 가지면 안 된다.</p>
      </div></div>
      <div class="nt"><em>15</em><div>
        <h4>Desktop 을 보고 있을 때는 목록이 비어 있다</h4>
        <p>Desktop 이 기준선이라 재정의라는 개념이 없다. 목록 자리에 <b>"Tablet · Mobile 에서 각각 3개 · 1개 재정의됨"</b> 한 줄만 둔다.</p>
        <p class="why">왜 — 빈 목록을 그대로 두면 고장으로 읽힌다. 다른 breakpoint 의 개수를 알려주면 그리로 가는 이유가 된다.</p>
      </div></div>
    </div>
  </div>
</div>'''
build('TabScreen', 1400, 620, body)

# ---------- modified 뷰 ----------
def mod(after):
    rows_before = '''
    <div class="mrow"><span>Width</span><span>184px</span></div>
    <div class="mrow"><span>Gap</span><span>8px</span></div>
    <div class="mrow"><span>Background</span><span>gray-100</span></div>
    <div class="mrow"><span>Border Radius</span><span>6px</span></div>
    <div class="mrow"><span>Font Weight</span><span>500</span></div>
    <div class="mrow"><span>Text Align</span><span>left</span></div>'''
    rows_after = '''
    <div class="mrow"><span><i class="src s-in" style="display:inline-block;vertical-align:-2px;margin-right:6px"></i>Width</span><span>184px</span></div>
    <div class="mrow"><span><i class="src s-in" style="display:inline-block;vertical-align:-2px;margin-right:6px"></i>Gap</span><span>8px</span></div>
    <div class="mrow"><span><i class="src s-in" style="display:inline-block;vertical-align:-2px;margin-right:6px"></i>Background</span><span>gray-100</span></div>
    <div class="mrow"><span><i class="src s-in" style="display:inline-block;vertical-align:-2px;margin-right:6px"></i>Border Radius</span><span>6px</span></div>
    <div class="mrow"><span><i class="src s-in" style="display:inline-block;vertical-align:-2px;margin-right:6px"></i>Font Weight</span><span>500</span></div>
    <div class="mrow"><span><i class="src s-in" style="display:inline-block;vertical-align:-2px;margin-right:6px"></i>Text Align</span><span>left</span></div>
    <div class="mrow" style="border-top:1px solid var(--b-border);margin-top:6px;padding-top:8px"><span><i class="src s-ov" style="display:inline-block;vertical-align:-2px;margin-right:6px"></i>Font Size</span><span>14px · Tablet</span></div>
    <div class="mrow"><span><i class="src s-ov" style="display:inline-block;vertical-align:-2px;margin-right:6px"></i>Align Items</span><span>center · Tablet</span></div>'''
    return f'''<div class="sec">
  <div class="shd"><b>수정된 속성</b><em class="ico"><i>↺</i></em></div>
  <div class="sct" style="gap:0;padding:8px 0">{rows_after if after else rows_before}</div>
</div>'''

def panel_mod(after):
    chips = '<div class="chips"><span class="chip on">Local</span><span class="chip"><i class="src s-ov"></i>card-base · 12</span><span class="chip">+</span></div>' if after else ''
    b = '<div class="bdg" style="left:-9px;top:206px">16</div>' if after else ''
    return f'''<div class="pnl">
  {b}
  <div class="phd"><span>Button</span><em class="ico"><i>⧉</i><i>⎘</i></em></div>
  {chips}
  {tabs("modified")}
  {mod(after)}
</div>'''

body = f'''<div class="sheet" style="gap:15px">
  <div class="hd"><span class="num">탭 5/5</span><h1>수정 — 수정된 속성만</h1><span class="where">Styles 패널 233px · 그룹을 가로지르는 필터</span></div>
  <div class="lay">
    <div class="stack"><div class="plab a"><b>지금</b><span>직접 설정한 값 6개</span></div>{panel_mod(False)}</div>
    <div class="stack"><div class="plab b"><b>적용 후</b><span>재정의 2개가 구분되어 함께</span></div>{panel_mod(True)}</div>
    <div class="notes">
      <div class="nt"><em>16</em><div>
        <h4>이 뷰는 없애지 않는다. 막대와 겹치지 않기 때문이다</h4>
        <p>막대는 <b>"이 값이 어디서 왔나"</b> 를 필드 옆에서 답하고, 이 뷰는 <b>"내가 건드린 게 뭐뭐냐"</b> 를 한 화면에 모아 답한다. 질문이 다르다.</p>
        <p class="why">왜 확인이 필요한가 — 새 표시를 넣을 때 가장 흔한 실수가 기존 화면과 역할이 겹치는 것이다. 여기서는 겹치지 않는 게 확인됐다.</p>
      </div></div>
      <div class="nt"><em>17</em><div>
        <h4>대신 이 뷰가 breakpoint 재정의까지 받는다</h4>
        <p>지금은 직접 설정한 값만 나온다. 재정의도 "사용자가 만든 값" 이므로 <b>구분선 아래</b> 에 붙이고 어느 breakpoint 인지 값 옆에 적는다.</p>
        <p class="why">왜 섞지 않고 나누나 — 위쪽은 모든 화면 크기에 적용되고 아래쪽은 한 화면에만 적용된다. 되돌리기 범위가 다르므로 줄을 그어야 한다.</p>
      </div></div>
      <div class="nt"><em>18</em><div>
        <h4>탭 줄의 수정 탭에는 점을 계속 찍지 않는다</h4>
        <p>지금 규칙 그대로다. 수정 탭의 점은 다른 네 탭 점의 합이라 <b>정의상 중복</b> 이고, 다섯 개가 다 점을 달면 신호가 묽어진다.</p>
        <p class="why">이건 이미 코드에 적힌 판단이다 (StylesPanelTabs). 새 표시를 넣으면서 이 규칙을 깨지 않는다.</p>
      </div></div>
    </div>
  </div>
</div>'''
build('TabModified', 1400, 620, body)
print("ok")
