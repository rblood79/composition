exec(open('mk.py').read())
body = '''<div class="sheet" style="gap:15px">
  <div class="hd"><span class="num">캔버스</span><h1>패널 밖에서 일어나는 변화 셋</h1><span class="where">Styles 패널에 새 요소가 없는 것들</span></div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:22px;flex-grow:1;min-height:0">

    <div class="stack" style="min-height:0">
      <div class="plab b"><b>스크럽 미리보기</b><span>드래그 중</span></div>
      <div class="fr" style="flex-grow:1;min-height:0">
        <div class="canv">
          <div class="pg" style="left:16px;top:16px;right:16px;bottom:48px"></div>
          <div class="gho" style="left:36px;top:40px;width:96px;height:36px"></div>
          <div class="el sel" style="left:36px;top:40px;width:150px;height:36px">Button</div>
          <div class="hnd" style="left:183px;top:54px"></div>
          <div class="cap">폭이 손을 따라 늘어난다. 저장은 손 뗄 때 한 번</div>
        </div>
      </div>
      <p style="margin:0;font-size:11.5px;line-height:1.5;color:var(--ink-2)">패널에는 아무 표시도 더하지 않는다. 드래그하는 손은 캔버스를 보고 있다.</p>
    </div>

    <div class="stack" style="min-height:0">
      <div class="plab b"><b>중첩 제약 — 결함</b><span>끌어놓기 · 붙여넣기 · 세 층을 한 곳에서</span></div>
      <div class="fr" style="flex-grow:1;min-height:0">
        <div class="canv">
          <div class="pg" style="left:16px;top:16px;right:16px;bottom:72px"></div>
          <div class="el" style="left:34px;top:38px;width:150px;height:72px;align-items:flex-start;justify-content:flex-start;padding:9px 12px">Button</div>
          <div style="position:absolute;left:198px;top:38px;width:118px;height:72px;border:1px dashed var(--b-emph);border-radius:6px;font-family:Pretendard,system-ui,sans-serif;font-size:11px;color:var(--b-fg-muted);padding:5px 8px">Frame</div>
          <div class="gho" style="left:210px;top:60px;width:94px;height:32px;border-color:var(--b-notice)"></div>
          <div style="position:absolute;left:12px;right:12px;bottom:12px;background:var(--b-overlay);border-radius:8px;padding:9px 11px;box-shadow:0 2px 10px rgba(0,0,0,.14);display:flex;align-items:center;gap:9px;font-family:Pretendard,system-ui,sans-serif;font-size:11.5px;color:var(--b-fg)">
            <span style="width:3px;align-self:stretch;background:var(--b-notice);border-radius:2px"></span>
            <span style="flex-grow:1;line-height:1.4">Button 안에는 Button 을 넣을 수 없어 옆 Frame 에 넣었습니다</span>
            <span style="color:var(--b-info);border-bottom:1px solid currentColor;white-space:nowrap">되돌리기</span>
          </div>
        </div>
      </div>
      <p style="margin:0;font-size:11.5px;line-height:1.5;color:var(--ink-2)">규칙은 빌더가 정하지 않는다. <b style="color:var(--ink)">Pen 구조</b> (Text · Icon 은 잎) · <b style="color:var(--ink)">RAC 합성</b> (Select 안엔 ListBox, Tabs 안엔 TabList 와 TabPanel) · <b style="color:var(--ink)">HTML 의미</b> (button 안 button 금지) 세 층을 읽어서 같은 경고로 낸다. 막지 않고 옮긴 뒤 되돌릴 길을 준다.</p>
    </div>

    <div class="stack" style="min-height:0">
      <div class="plab b"><b>브라우저 기본 간격</b><span>측정 결과에 따라</span></div>
      <div class="fr" style="flex-grow:1;min-height:0;padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:var(--b-overlay);border-radius:3px;padding:11px;box-shadow:0 1px 3px rgba(0,0,0,.10);font-family:Pretendard,system-ui,sans-serif">
          <div class="mono" style="font-size:9px;letter-spacing:.1em;color:var(--b-fg-muted);margin-bottom:8px">CANVAS</div>
          <div style="font-size:16px;font-weight:700;color:var(--b-fg);margin:9px 0">분기 보고</div>
          <div style="font-size:11px;color:var(--b-fg-muted);line-height:1.5;margin:9px 0">Preview 와 같은 간격</div>
        </div>
        <div style="background:var(--b-overlay);border-radius:3px;padding:11px;box-shadow:0 1px 3px rgba(0,0,0,.10);font-family:Pretendard,system-ui,sans-serif">
          <div class="mono" style="font-size:9px;letter-spacing:.1em;color:var(--b-fg-muted);margin-bottom:8px">PREVIEW</div>
          <div style="font-size:16px;font-weight:700;color:var(--b-fg);margin:9px 0">분기 보고</div>
          <div style="font-size:11px;color:var(--b-fg-muted);line-height:1.5;margin:9px 0">변화 없다</div>
        </div>
      </div>
      <p style="margin:0;font-size:11.5px;line-height:1.5;color:var(--ink-2)">먼저 잰다. 격차가 없으면 하지 않는다.</p>
    </div>
  </div>

  <div class="verd">
    <div class="v g"><h3>공통 원칙</h3><p>이 셋은 <b>패널에 UI 를 더하지 않는다</b>. 캔버스에서 일어나는 일은 캔버스에서 답한다.</p></div>
    <div class="v w"><h3>가장 큰 리스크</h3><p>중첩 경고에서 끌어놓기를 <b>거부</b>하면 좌절을 부른다. 옮기고 되돌릴 길을 주는 쪽이 옳다. 캔버스는 RAC 를 그리는 도구라 세 층 모두 이미 아래에 있는 제약이고, 빌더는 관찰만 한다.</p></div>
    <div class="v f"><h3>착수 순서</h3><p><b>중첩 제약이 맨 앞이다.</b> 셋 중 유일한 결함이고 다른 둘은 편의다. Pen 잎 검사 → RAC 합성 → HTML 의미 순. 그 다음 스크럽 미리보기, 기본 간격은 측정 한 건 뒤.</p></div>
  </div>
</div>'''
build('Canvas', 1400, 700, body)
