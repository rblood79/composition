exec(open('mk.py').read())

def appearance(after, bad=False):
    s = lambda c: f'<i class="src {c}"></i>' if after else ''
    radius = '<div class="ct err">12p</div>' if (after and bad) else ('<div class="ct act">12p</div>' if bad else '<div class="ct">6<u>px</u></div>')
    hint = '<div class="hint">저장되지 않음 — "12p" 는 길이 값이 아닙니다. <b>12px</b> 또는 <b>12%</b> 로 입력하세요. <span style="color:var(--b-info);border-bottom:1px solid currentColor">그대로 저장</span></div>' if (after and bad) else ''
    return f'''<div class="sec">
  <div class="shd"><b>Appearance</b><em class="ico"><i>↺</i><i>⌃</i></em></div>
  <div class="sct">
    <div class="fg"><div class="lg">{s("s-in")}Background</div><div class="ct"><span>gray-100</span><span class="sw" style="background:oklch(96.7% 0.001 286.375)"></span></div></div>
    <div class="fg"><div class="lg">Opacity</div><div class="ct">100<u>%</u></div></div>
    <div class="fg"><div class="lg">{s("s-ih")}Border Color</div><div class="ct"><span>gray-300</span><span class="sw" style="background:oklch(87.2% 0.01 258.338)"></span></div></div>
    <div class="fg"><div class="lg">Border Width / Radius</div><div class="g2"><div class="ct">1<u>px</u></div>{radius}</div></div>
  </div>
  {hint}
  <div class="sct" style="padding-top:0">
    <div class="fg"><div class="lg">Border Style</div><div class="ct sel">solid</div></div>
    <div class="fg"><div class="lg">{s("s-in")}Box Shadow</div><div class="g2" style="grid-template-columns:1fr 44px"><div class="ct sel">sm</div><div class="ct" style="justify-content:center;color:var(--b-fg-muted)">inset</div></div></div>
    <div class="fg"><div class="lg">Overflow</div><div class="ct sel">visible</div></div>
  </div>
</div>'''

def panel(after, bad):
    chips = '<div class="chips"><span class="chip on">Local</span><span class="chip"><i class="src s-ov"></i>card-base · 12</span><span class="chip">+</span></div>' if after else ''
    b = '<div class="bdg" style="left:-9px;top:186px">5</div>' if after else ''
    return f'''<div class="pnl">
  {b}
  <div class="phd"><span>Button</span><em class="ico"><i>⧉</i><i>⎘</i></em></div>
  {chips}
  {tabs("style")}
  {appearance(after, bad)}
</div>'''

body = f'''<div class="sheet" style="gap:15px">
  <div class="hd"><span class="num">탭 2/5</span><h1>스타일 — Appearance</h1><span class="where">Styles 패널 233px · 전체 필드</span></div>
  <div class="lay">
    <div class="stack"><div class="plab a"><b>지금</b><span>Radius 에 "12p" 를 입력한 상태</span></div>{panel(False, True)}</div>
    <div class="stack"><div class="plab b"><b>적용 후</b><span>같은 입력</span></div>{panel(True, True)}</div>
    <div class="notes">
      <div class="nt"><em>5</em><div>
        <h4>잘못된 값은 필드 테두리와 그 아래 한 줄로만</h4>
        <p>필드는 <b>negative 토큰</b> 으로 테두리와 글자색이 바뀌고, 안내는 팝오버가 아니라 <b>그 필드 바로 아래 한 줄</b> 에 붙는다. 값은 화면에 남고 문서에는 들어가지 않는다.</p>
        <p class="why">왜 팝오버가 아닌가 — 233px 패널에서 팝오버는 자기가 설명하는 필드를 가린다. 아래 한 줄은 섹션 안에서 자리를 밀 뿐 아무것도 덮지 않는다.</p>
        <p class="why">왜 새 색을 안 만드나 — 패널에 negative · notice · informative 세 상태색이 이미 있다. 오류는 negative 하나로 끝난다.</p>
      </div></div>
      <div class="nt"><em>6</em><div>
        <h4>검증은 입력을 마쳤을 때만</h4>
        <p>"12" → "12p" → "12px" 로 타이핑하는 중에는 <b>색이 변하지 않는다</b>. 포커스가 빠지거나 Enter 를 눌렀을 때 한 번 판정한다.</p>
        <p class="why">왜 — 글자마다 빨개지는 필드는 사용자를 재촉한다. 기존 ScrubInput 도 같은 규칙이다. 드래그 중에는 표시만 바꾸고 손을 뗄 때 커밋한다.</p>
      </div></div>
      <div class="nt"><em>7</em><div>
        <h4>"그대로 저장" 은 남긴다</h4>
        <p>검증 데이터가 브라우저 구현보다 뒤처져 멀쩡한 최신 값이 막힐 수 있다. 그때 <b>원래 문자열로 저장</b> 할 길을 준다. 대신 그 값의 출처 막대는 경고색으로 남는다.</p>
        <p class="why">왜 — 검증이 사용자를 이기면 안 된다. 막을 수 없는 값이 하나라도 있으면 기능 전체가 불신을 산다.</p>
      </div></div>
      <div class="nt"><em>8</em><div>
        <h4>Background 는 Fill 스택이라 막대가 필드 단위로 붙는다</h4>
        <p>배경은 색 하나가 아니라 <b>Fill 레이어 스택</b> 이다. 막대는 스택 전체에 하나만 붙이고, 레이어별 출처는 Fill 상세를 열었을 때 보여준다.</p>
        <p class="why">왜 — 레이어마다 막대를 달면 233px 안에서 색 견본과 막대가 붙어 서로를 방해한다.</p>
      </div></div>
    </div>
  </div>
</div>'''
build('TabStyle', 1400, 720, body)
