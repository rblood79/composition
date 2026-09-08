exec(open('mk.py').read())

def transform(after):
    s = lambda c: f'<i class="src {c}"></i>' if after else ''
    return f'''<div class="sec">
  <div class="shd"><b>Transform</b><em class="ico"><i>↺</i><i>⌃</i></em></div>
  <div class="sct">
    <div class="fg"><div class="lg">{s("s-in")}Size</div><div class="g2"><div class="ct">184<u>px</u></div><div class="ct">40<u>px</u></div></div></div>
    <div class="fg"><div class="lg">Min / Max Width</div><div class="g2"><div class="ct">auto</div><div class="ct">none</div></div></div>
    <div class="fg"><div class="lg">Min / Max Height</div><div class="g2"><div class="ct">auto</div><div class="ct">none</div></div></div>
    <div class="fg"><div class="lg">Aspect Ratio</div><div class="ct">auto</div></div>
    <div class="fg"><div class="lg">Position</div><div class="ct sel">relative</div></div>
    <div class="fg"><div class="lg">Top / Left</div><div class="g2"><div class="ct">auto</div><div class="ct">auto</div></div></div>
    <div class="fg"><div class="lg">Grow / Shrink</div><div class="g2"><div class="ct">0</div><div class="ct">1</div></div></div>
    <div class="fg"><div class="lg">Basis</div><div class="ct">auto</div></div>
    <div class="fg"><div class="lg">{s("s-ih")}Align / Justify Self</div><div class="g2"><div class="ct sel">stretch</div><div class="ct sel">auto</div></div></div>
  </div>
</div>'''

def layout(after):
    s = lambda c: f'<i class="src {c}"></i>' if after else ''
    return f'''<div class="sec">
  <div class="shd"><b>Layout</b><em class="ico"><i>↺</i><i>⌃</i></em></div>
  <div class="sct">
    <div class="fg"><div class="lg">{s("s-in")}Display</div><div class="ct sel">flex</div></div>
    <div class="fg"><div class="lg">Direction / Wrap</div><div class="g2"><div class="ct sel">row</div><div class="ct sel">nowrap</div></div></div>
    <div class="fg"><div class="lg">{s("s-ov")}Align / Justify</div><div class="g2"><div class="ct sel">center</div><div class="ct sel">start</div></div></div>
    <div class="fg"><div class="lg">{s("s-in")}Row / Column Gap</div><div class="g2"><div class="ct">8<u>px</u></div><div class="ct">8<u>px</u></div></div></div>
    <div class="fg"><div class="lg">Padding</div><div class="g4"><div class="ct">12</div><div class="ct">16</div><div class="ct">12</div><div class="ct">16</div></div></div>
    <div class="fg"><div class="lg">Margin</div><div class="g4"><div class="ct">0</div><div class="ct">0</div><div class="ct">0</div><div class="ct">0</div></div></div>
  </div>
</div>'''

def panel(after):
    chips = '<div class="chips"><span class="chip on">Local</span><span class="chip"><i class="src s-ov"></i>card-base · 12</span><span class="chip">+</span></div>' if after else ''
    b1 = '<div class="bdg" style="left:-9px;top:70px">1</div>' if after else ''
    b3 = '<div class="bdg" style="left:-9px;top:38px">3</div>' if after else ''
    return f'''<div class="pnl">
  {b3}{b1}
  <div class="phd"><span>Button</span><em class="ico"><i>⧉</i><i>⎘</i></em></div>
  {chips}
  {tabs("layout")}
  {transform(after)}
  {layout(after)}
</div>'''

body = f'''<div class="sheet" style="gap:15px">
  <div class="hd"><span class="num">탭 1/5</span><h1>배치 — Transform · Layout</h1><span class="where">Styles 패널 233px · 전체 필드</span></div>
  <div class="lay">
    <div class="stack"><div class="plab a"><b>지금</b></div>{panel(False)}</div>
    <div class="stack"><div class="plab b"><b>적용 후</b></div>{panel(True)}</div>
    <div class="notes">
      <div class="srcleg">
        <span><i class="src s-in" style="height:12px"></i>이 요소에서 직접</span>
        <span><i class="src s-ov" style="height:12px"></i>breakpoint 재정의</span>
        <span><i class="src s-ih" style="height:12px"></i>부모에서 상속</span>
        <span style="color:var(--ink-3)">catalog 기본값은 표시 없음</span>
      </div>
      <div class="nt"><em>1</em><div>
        <h4>출처는 점이 아니라 라벨 왼쪽 3px 세로 막대</h4>
        <p>값이 catalog 기본값이면 <b>아무 표시도 하지 않는다</b>. 직접 설정 · breakpoint 재정의 · 상속 세 가지만 막대를 단다. 위 패널에서 막대가 붙은 줄은 9개 중 <b>4개</b>다.</p>
        <p class="why">왜 점이 아닌가 — 탭 줄이 이미 점을 "수정됨" 신호로 쓴다 (styles-panel-tab-dot). 같은 모양에 두 뜻을 얹으면 읽는 사람이 매번 되묻는다. 막대는 legend 왼쪽에 붙어 세로로 열이 맞아 스캔이 된다.</p>
      </div></div>
      <div class="nt"><em>2</em><div>
        <h4>필드마다 되돌리기 버튼을 달지 않는다</h4>
        <p>되돌리기는 지금대로 <b>섹션 헤더에만</b> 둔다. 막대를 누르면 값을 준 곳으로 간다. 상속이면 부모 요소가 선택되고, 재정의면 Desktop 값을 보여준다.</p>
        <p class="why">왜 — 233px 폭에 24px 버튼을 줄마다 넣으면 컨트롤이 그만큼 좁아진다. 섹션 되돌리기는 이미 탭의 수정 점과 같은 판정을 공유한다 (styleGroups.ts). 판정이 하나면 UI 도 하나여야 한다.</p>
      </div></div>
      <div class="nt"><em>3</em><div>
        <h4>스타일 세트 줄은 탭 위, 높이 32px</h4>
        <p>세트는 배치 · 스타일 · 텍스트를 <b>가로지른다</b>. 그래서 탭 안이 아니라 패널 헤더와 탭 줄 사이에 놓는다. 세트가 없는 요소에서는 줄이 통째로 사라진다.</p>
        <p class="why">왜 32px 인가 — 섹션 헤더와 같은 높이다. 패널에 이미 32px (헤더 · 탭 · 섹션 헤더) 과 28px (컨트롤) 두 단만 있다. 새 높이를 만들지 않는다.</p>
      </div></div>
      <div class="nt"><em>4</em><div>
        <h4>스크럽 미리보기는 패널에 아무것도 더하지 않는다</h4>
        <p>드래그 중 캔버스가 따라오는 변화는 <b>패널에 새 요소가 없다</b>. "미리보기 중" 배지도 달지 않는다.</p>
        <p class="why">왜 — 배지는 드래그하는 손이 보고 있지 않은 곳에 뜬다. 사용자는 캔버스를 본다. 패널이 조용한 게 이 변화의 올바른 모습이다.</p>
      </div></div>
    </div>
  </div>
</div>'''
build('TabLayout', 1400, 1120, body)
