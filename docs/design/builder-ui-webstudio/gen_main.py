exec(open('mk.py').read())

def row(n, name, where, feel, feelc, risk, riskc, fix, last=False):
    bb = "" if last else "border-bottom:1px solid var(--rule);"
    p = f'padding:10px 16px 10px 0;{bb}'
    return (f'<div class="mono" style="{p}color:var(--blue)">{n}</div>'
            f'<div style="{p}font-weight:700">{name}</div>'
            f'<div style="{p}color:var(--ink-2)">{where}</div>'
            f'<div style="{p}color:var(--{feelc});font-weight:700">{feel}</div>'
            f'<div style="{p}color:var(--ink-2)"><b style="color:var(--{riskc})">{risk}</b> · {fix}</div>')

rows = "".join([
  row("09","중첩 제약 — Pen 구조 · RAC 합성 · HTML 의미","캔버스 끌어놓기","결함","b-neg","필수","b-neg","편의가 아니다 · 지금은 RAC 가 못 그리는 트리를 만든다 · 세 층을 관찰로 유도"),
  row("03","스크럽 중 캔버스 미리보기","캔버스","크다","b-pos","중간","b-notice","요소 많으면 자동 제한"),
  row("04","값 출처 막대","패널 전 탭","크다","b-pos","중간","b-notice","기본값은 표시 없음 · 점 대신 막대"),
  row("07","잘못된 값 표시","스타일 · 텍스트 탭","보통","ink-2","중간","b-notice","입력 마쳤을 때만 · 그대로 저장 남김"),
  row("10","공유 스타일 세트","패널 헤더 아래","크다","b-pos","높다","b-neg","항상 Local 복귀 · 적용 개수 표시"),
  row("06","일괄 변경 되돌리기 묶음","History","보통","ink-2","중간","b-notice","부른 쪽이 지정할 때만 묶음"),
  row("08","브라우저 기본 간격","캔버스 텍스트","조건부","ink-3","중간","b-notice","측정 먼저 · 격차 있을 때만", True),
])

hp='padding:0 16px 6px 0;border-bottom:1px solid var(--ink)'
body = f'''<div class="sheet" style="gap:17px">
  <div class="hd" style="border-bottom-width:2px"><span class="num">개요</span><h1>Styles 패널에 무엇을 얹을 것인가</h1><span class="where">webstudio 패턴 대조 · 2026-09-08</span></div>

  <p style="margin:0;max-width:760px;color:var(--ink-2);font-size:13px;line-height:1.6">
    가져올 만하다고 판정한 11개 중 화면에 나타나는 것은 7개고, 그중 <b style="color:var(--ink)">4개가 Styles 패널</b> 안에서 일어난다. 아래 아트보드는 패널의 <b style="color:var(--ink)">탭 5개를 전부</b> 지금과 적용 후로 그렸다. 필드를 하나도 빼지 않았으므로 새 표시가 실제로 얼마나 늘어나는지 그대로 읽힌다.
  </p>

  <div style="display:grid;grid-template-columns:40px 1fr 132px 66px 1fr;column-gap:0;font-size:12px">
    <div class="mono" style="font-size:9.5px;letter-spacing:.11em;color:var(--ink-3);{hp}">번호</div>
    <div class="mono" style="font-size:9.5px;letter-spacing:.11em;color:var(--ink-3);{hp}">패턴</div>
    <div class="mono" style="font-size:9.5px;letter-spacing:.11em;color:var(--ink-3);{hp}">바뀌는 곳</div>
    <div class="mono" style="font-size:9.5px;letter-spacing:.11em;color:var(--ink-3);{hp}">체감</div>
    <div class="mono" style="font-size:9.5px;letter-spacing:.11em;color:var(--ink-3);{hp}">불편 리스크와 완화</div>
    {rows}
  </div>

  <div>
    <div class="mono" style="font-size:9.5px;letter-spacing:.11em;color:var(--ink-3);padding-bottom:7px;border-bottom:1px solid var(--ink)">제안이 따른 기존 어법 — 코드에서 읽은 것</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;margin-top:11px">
      <div style="padding-right:22px;border-right:1px solid var(--rule)">
        <h3 style="margin:0 0 4px;font-size:12px">높이는 두 단뿐이다</h3>
        <p style="margin:0;font-size:11.5px;line-height:1.5;color:var(--ink-2)">패널 헤더 · 탭 줄 · 섹션 헤더가 <b style="color:var(--ink)">32px</b>, 컨트롤이 <b style="color:var(--ink)">28px</b>. 스타일 세트 줄은 32px 로 맞췄다. 새 높이를 만들지 않았다.</p>
      </div>
      <div style="padding:0 22px;border-right:1px solid var(--rule)">
        <h3 style="margin:0 0 4px;font-size:12px">점은 이미 뜻이 있다</h3>
        <p style="margin:0;font-size:11.5px;line-height:1.5;color:var(--ink-2)">탭의 점은 "이 그룹에 수정된 값이 있다" 다. 출처는 <b style="color:var(--ink)">3px 세로 막대</b> 로 어법을 갈랐다. 같은 모양에 두 뜻을 얹지 않는다.</p>
      </div>
      <div style="padding-left:22px">
        <h3 style="margin:0 0 4px;font-size:12px">되돌리기는 섹션 단위다</h3>
        <p style="margin:0;font-size:11.5px;line-height:1.5;color:var(--ink-2)">필드마다 버튼을 달지 않는다. 233px 에서 컨트롤이 좁아진다. 섹션 되돌리기는 탭의 점과 <b style="color:var(--ink)">같은 판정</b> 을 이미 공유한다.</p>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px">
    <div>
      <div class="mono" style="font-size:9.5px;letter-spacing:.11em;color:var(--ink-3);padding-bottom:7px;border-bottom:1px solid var(--rule)">화면 변화가 없는 것</div>
      <p style="margin:9px 0 0;font-size:12px;line-height:1.6;color:var(--ink-2)">생성물 검사 · 번들 크기 검사 · AI 도구 정의 생성 · AI 평가 회귀. 사용자가 느끼는 건 오래된 CSS 가 커밋되지 않는다는 정도다.</p>
    </div>
    <div>
      <div class="mono" style="font-size:9.5px;letter-spacing:.11em;color:var(--ink-3);padding-bottom:7px;border-bottom:1px solid var(--rule)">순서</div>
      <p style="margin:9px 0 0;font-size:12px;line-height:1.6;color:var(--ink-2)"><b style="color:var(--ink)">09 중첩 제약이 맨 앞이다.</b> 나머지는 없어도 빌더가 틀리지 않지만 이건 없으면 RAC 가 그릴 수 없는 트리를 빌더가 만들어 낸다. 편의가 아니라 결함이다. 결정을 기다릴 것은 <b style="color:var(--ink)">10 공유 스타일 세트</b> 하나뿐이고, 편의 항목 중에서는 <b style="color:var(--ink)">03</b> 과 <b style="color:var(--ink)">04</b> 가 먼저다.</p>
    </div>
  </div>
</div>'''
build('Main', 1400, 800, body)
