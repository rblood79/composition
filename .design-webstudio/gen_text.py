exec(open('mk.py').read())

def typo(after):
    s = lambda c: f'<i class="src {c}"></i>' if after else ''
    return f'''<div class="sec">
  <div class="shd"><b>Typography</b><em class="ico"><i>↺</i><i>⌃</i></em></div>
  <div class="sct">
    <div class="fg"><div class="lg">{s("s-ih")}Font Family</div><div class="ct sel">Pretendard</div></div>
    <div class="fg"><div class="lg">{s("s-ov")}Size / Weight</div><div class="g2"><div class="ct">14<u>px</u></div><div class="ct sel">500</div></div></div>
    <div class="fg"><div class="lg">Style / Line Height</div><div class="g2"><div class="ct sel">normal</div><div class="ct">1.5</div></div></div>
    <div class="fg"><div class="lg">Letter Spacing</div><div class="ct">0<u>px</u></div></div>
    <div class="fg"><div class="lg">{s("s-ih")}Color</div><div class="ct"><span>gray-800</span><span class="sw" style="background:oklch(27.8% 0.033 256.848)"></span></div></div>
    <div class="fg"><div class="lg">{s("s-in")}Align</div><div class="seg"><span class="on">좌</span><span>중</span><span>우</span><span>양</span></div></div>
    <div class="fg"><div class="lg">Decoration / Transform</div><div class="g2"><div class="ct sel">none</div><div class="ct sel">none</div></div></div>
    <div class="fg"><div class="lg">Vertical / White Space</div><div class="g2"><div class="ct sel">baseline</div><div class="ct sel">normal</div></div></div>
    <div class="fg"><div class="lg">Word Break / Wrap</div><div class="g2"><div class="ct sel">normal</div><div class="ct sel">normal</div></div></div>
    <div class="fg"><div class="lg">Text Overflow</div><div class="ct sel">clip</div></div>
  </div>
</div>'''

def panel(after):
    chips = '<div class="chips"><span class="chip on">Local</span><span class="chip"><i class="src s-ov"></i>card-base · 12</span><span class="chip">+</span></div>' if after else ''
    b = '<div class="bdg" style="left:-9px;top:132px">9</div>' if after else ''
    return f'''<div class="pnl">
  {b}
  <div class="phd"><span>Button</span><em class="ico"><i>⧉</i><i>⎘</i></em></div>
  {chips}
  {tabs("text")}
  {typo(after)}
</div>'''

body = f'''<div class="sheet" style="gap:15px">
  <div class="hd"><span class="num">탭 3/5</span><h1>텍스트 — Typography</h1><span class="where">Styles 패널 233px · 전체 필드</span></div>
  <div class="lay">
    <div class="stack"><div class="plab a"><b>지금</b><span>값 10개, 출처는 알 수 없다</span></div>{panel(False)}</div>
    <div class="stack"><div class="plab b"><b>적용 후</b><span>막대 4개, 나머지는 조용하다</span></div>{panel(True)}</div>
    <div class="notes">
      <div class="nt"><em>9</em><div>
        <h4>가장 시끄러워질 뻔한 탭이라 여기서 규칙을 시험한다</h4>
        <p>Typography 는 필드가 <b>10개로 가장 많다</b>. 전부에 표시를 달면 패널이 무늬가 된다. 기본값을 비워 두는 규칙 덕분에 실제로 붙는 건 <b>4개</b> 뿐이다.</p>
        <p class="why">왜 이 탭으로 검증하나 — 규칙은 가장 밀도 높은 화면에서 깨진다. 여기서 견디면 나머지 탭은 여유가 있다.</p>
      </div></div>
      <div class="nt"><em>10</em><div>
        <h4>상속이 가장 많이 걸리는 곳도 여기다</h4>
        <p>Font Family 와 Color 는 부모에서 내려오는 게 정상이다. 이 둘에 <b>상속 막대</b> 가 붙으면 "내가 안 정했는데 값이 있다" 는 혼란이 사라진다.</p>
        <p class="why">왜 중요한가 — 지금은 상속값과 직접 설정값이 똑같이 보인다. 사용자는 부모를 고쳐야 할 때 자식을 고치고, 그 자식만 부모에서 떨어져 나간다.</p>
      </div></div>
      <div class="nt"><em>11</em><div>
        <h4>Align 같은 분절 컨트롤은 막대를 legend 에 붙인다</h4>
        <p>4칸 분절 컨트롤은 안에 막대를 넣을 자리가 없다. 다른 필드와 <b>같은 자리</b> 인 legend 왼쪽에 붙인다.</p>
        <p class="why">왜 — 막대가 컨트롤 종류마다 다른 자리에 있으면 세로로 훑을 수 없다. 자리가 하나여야 스캔이 된다.</p>
      </div></div>
      <div class="nt"><em>12</em><div>
        <h4>탭의 수정 점과 막대는 다른 것을 센다</h4>
        <p>탭 점은 <b>"기본값과 다른 값이 이 그룹에 있다"</b>, 막대는 <b>"이 값이 어디서 왔다"</b> 다. 상속값만 있는 그룹은 탭에 점이 없고 안에는 막대가 있다.</p>
        <p class="why">왜 모양을 달리 했나 — 두 신호가 같은 점이면 위 문장이 모순으로 읽힌다.</p>
      </div></div>
    </div>
  </div>
</div>'''
build('TabText', 1400, 800, body)
