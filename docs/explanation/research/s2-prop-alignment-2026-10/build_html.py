"""S2 prop 정렬 조사 — 공유 페이지 생성 (dataset.json → html)."""
import json
import sys

data = json.load(open(sys.argv[1]))
out_path = sys.argv[2]

PAGE = r"""<title>S2 프로퍼티 정렬</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">
<style>
/* Layout: one reading column (max 1120px) — standard → summary → axis groups → diffs → explorer → by-prop → decisions. */
:root {
  --bg: #f6f7f9; --surface: #ffffff; --surface-2: #eef1f5; --fg: #17191d; --muted: #5b6270; --line: #d9dee6;
  --accent: #2c5bd3;
  --c-same: #2f8a5b; --c-diff: #b7791f; --c-rac: #5d6b82; --c-v3: #7b4fc2; --c-own: #c2415d; --c-s2: #2c5bd3; --c-editor: #9aa3b2;
  --c-same-bg: #e3f3ea; --c-diff-bg: #fbf0dc; --c-rac-bg: #e7ebf1; --c-v3-bg: #efe7fb; --c-own-bg: #fbe6eb; --c-s2-bg: #e3ebfb; --c-editor-bg: #eef0f3;
  --font-body: "IBM Plex Sans KR", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  --radius: 8px;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #111317; --surface: #191c22; --surface-2: #20242c; --fg: #e8eaee; --muted: #9aa2b1; --line: #2c313b; --accent: #7fa2ff;
  --c-same: #5cc58f; --c-diff: #e3a94b; --c-rac: #9aa8bf; --c-v3: #b28cf0; --c-own: #f07a94; --c-s2: #7fa2ff; --c-editor: #6d7584;
  --c-same-bg: #17301f; --c-diff-bg: #33270f; --c-rac-bg: #232a35; --c-v3-bg: #2a1f3c; --c-own-bg: #3a1a22; --c-s2-bg: #1b2747; --c-editor-bg: #232730;
  color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #111317; --surface: #191c22; --surface-2: #20242c; --fg: #e8eaee; --muted: #9aa2b1; --line: #2c313b; --accent: #7fa2ff;
  --c-same: #5cc58f; --c-diff: #e3a94b; --c-rac: #9aa8bf; --c-v3: #b28cf0; --c-own: #f07a94; --c-s2: #7fa2ff; --c-editor: #6d7584;
  --c-same-bg: #17301f; --c-diff-bg: #33270f; --c-rac-bg: #232a35; --c-v3-bg: #2a1f3c; --c-own-bg: #3a1a22; --c-s2-bg: #1b2747; --c-editor-bg: #232730;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: var(--font-body); font-size: 15px; line-height: 1.6; }
.wrap { max-width: 1120px; margin: 0 auto; padding-inline: 20px; padding-block: 32px 64px; display: grid; gap: 40px; }
h1, h2, h3 { text-wrap: balance; line-height: 1.25; margin: 0; }
h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.01em; }
h2 { font-size: 20px; font-weight: 700; }
h3 { font-size: 15px; font-weight: 600; }
p { margin: 0; max-width: 72ch; }
code, .mono { font-family: var(--font-mono); font-size: 0.88em; }
.eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
section { display: grid; gap: 14px; min-width: 0; }
.lede { color: var(--muted); }
.meta { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--muted); font-size: 13px; }
.meta span { white-space: nowrap; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; min-width: 0; }
.order { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; counter-reset: o; }
.order li { display: grid; grid-template-columns: 28px 1fr; gap: 10px; align-items: baseline; }
.order li::before { counter-increment: o; content: counter(o); font-family: var(--font-mono); font-weight: 500; color: var(--accent);
  border: 1px solid var(--line); border-radius: 50%; width: 24px; height: 24px; display: grid; place-items: center; font-size: 12px; }
.bar { display: flex; height: 18px; border-radius: 4px; overflow: hidden; border: 1px solid var(--line); }
.bar > div { height: 100%; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 13px; }
.legend span { display: inline-flex; gap: 6px; align-items: center; font-variant-numeric: tabular-nums; }
.dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; display: grid; gap: 2px; }
.stat b { font-size: 24px; font-variant-numeric: tabular-nums; font-weight: 600; }
.stat small { color: var(--muted); font-size: 12px; }
.scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
th, td { text-align: left; vertical-align: top; padding: 9px 12px; border-bottom: 1px solid var(--line); }
th { font-size: 12px; font-weight: 600; color: var(--muted); background: var(--surface-2); white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
td.k { white-space: nowrap; font-weight: 600; }
.tag { display: inline-block; font-family: var(--font-mono); font-size: 12px; padding: 1px 7px; border-radius: 4px; margin: 2px 4px 2px 0; white-space: nowrap; }
.t-same { background: var(--c-same-bg); color: var(--c-same); }
.t-diff { background: var(--c-diff-bg); color: var(--c-diff); }
.t-rac { background: var(--c-rac-bg); color: var(--c-rac); }
.t-v3 { background: var(--c-v3-bg); color: var(--c-v3); }
.t-own { background: var(--c-own-bg); color: var(--c-own); }
.t-s2 { background: var(--c-s2-bg); color: var(--c-s2); }
.t-editor { background: var(--c-editor-bg); color: var(--c-editor); }
.group-label { display: inline-block; font-weight: 700; font-family: var(--font-mono); width: 1.6em; }
.tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
input[type=search] { font: inherit; font-size: 14px; padding: 7px 11px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--fg); min-width: 0; flex: 1 1 220px; max-width: 320px; }
input[type=search]:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.chip { font: inherit; font-size: 13px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); cursor: pointer; }
.chip[aria-pressed="true"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.count { color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.rows { display: grid; gap: 6px; }
details.row { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); }
details.row > summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: minmax(130px, 1.2fr) minmax(100px, 1fr) minmax(160px, 2.4fr); gap: 12px; align-items: center; padding: 10px 14px; }
details.row > summary::-webkit-details-marker { display: none; }
details.row > summary .name { font-weight: 600; }
details.row > summary .s2 { color: var(--muted); font-size: 13px; }
details.row[open] > summary { border-bottom: 1px solid var(--line); }
.mini { display: flex; height: 8px; border-radius: 3px; overflow: hidden; background: var(--surface-2); }
.mini > div { height: 100%; }
.detail { padding: 12px 14px 14px; display: grid; gap: 10px; }
.detail dl { margin: 0; display: grid; grid-template-columns: 150px 1fr; gap: 6px 12px; }
.detail dt { color: var(--muted); font-size: 13px; padding-top: 2px; }
.detail dd { margin: 0; min-width: 0; }
.diffline { font-size: 13px; }
.tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.hint { color: var(--muted); font-size: 13px; }
.decisions { margin: 0; padding-left: 20px; display: grid; gap: 8px; }
footer { color: var(--muted); font-size: 13px; display: grid; gap: 6px; }
@media (max-width: 640px) {
  .wrap { padding-inline: 16px; }
  h1 { font-size: 24px; }
  details.row > summary { grid-template-columns: 1fr 1fr; }
  details.row > summary .mini { grid-column: 1 / -1; }
  .detail dl { grid-template-columns: 1fr; }
  .detail dt { padding-top: 6px; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; } }
</style>

<div class="wrap">
  <header style="display:grid;gap:10px">
    <div class="eyebrow">composition · D2 Props/API 조사 · 2026-10-09</div>
    <h1>S2 프로퍼티 정렬</h1>
    <p class="lede">composition catalog 의 컴포넌트 prop 137개 type 을 React Spectrum S2 1.8.0 의 실제 prop 집합과 한 줄씩 대조했습니다. 무엇이 이미 같고, 무엇을 바꾸거나 들여야 하는지 정리한 기록입니다.</p>
    <div class="meta"><span>S2 <code>@react-spectrum/s2</code> 1.8.0</span><span>RAC 1.21.0 (설치본)</span><span>v3 <code>@adobe/react-spectrum</code> 3.47.6</span><span>spectrum-design-data 3.4.0</span></div>
  </header>

  <section aria-labelledby="std">
    <h2 id="std">기준 (사용자 결정 2026-10-09)</h2>
    <div class="panel" style="display:grid;gap:12px">
      <p>prop 이름과 값은 아래 순서에서 처음 답하는 곳을 따릅니다. 시각 값 (색 · 크기 · 형태) 은 이와 무관하게 catalog rule 이 정본입니다.</p>
      <ol class="order">
        <li><span><b>S2 1.8.0</b> (버전 고정) — RAC 위의 Spectrum 2 구현. 동작 · 상태 prop 은 RAC 이름, 시각 prop 은 Spectrum 축입니다.</span></li>
        <li><span><b>spectrum-design-data</b> — S2 에 없는 컴포넌트 · 축일 때 디자인 정본의 컴포넌트 스키마.</span></li>
        <li><span><b>v3</b> — Spectrum 1 구현. 위 둘에 없을 때만.</span></li>
        <li><span><b>composition 확장</b> — 어디에도 없으면 확장이라고 밝혀 둡니다.</span></li>
      </ol>
      <p class="hint">왜: RAC 는 headless 라 테마를 바꿀 수 있어 채택했고, prop 개념은 React Spectrum 을 따랐습니다. 기준이 "RSP" 로만 적혀 v3 와 S2 의 이름이 섞였습니다.</p>
    </div>
  </section>

  <section aria-labelledby="sum">
    <h2 id="sum">요약</h2>
    <p>비교한 우리 prop <b id="cmp-total"></b>개 가운데 <b id="cmp-same"></b>개 (<span id="cmp-pct"></span>%) 가 S2 와 이름 · 값까지 같습니다.</p>
    <div class="bar" id="sum-bar" role="img" aria-label="우리 prop 분류 비율"></div>
    <div class="legend" id="sum-legend"></div>
    <div class="stats" id="sum-stats"></div>
  </section>

  <section aria-labelledby="axis">
    <h2 id="axis">시각 축 6개의 재분류</h2>
    <p class="lede"><code>variant</code> · <code>isEmphasized</code> · <code>fillStyle</code> · <code>staticColor</code> · <code>isQuiet</code> · <code>density</code> 를 새 기준으로 다시 나눈 결과입니다.</p>
    <div class="scroll"><table>
      <thead><tr><th>묶음</th><th>대상</th><th>조치</th></tr></thead>
      <tbody>
        <tr><td class="k"><span class="group-label">A</span>그대로</td><td>Button <code>variant</code> · <code>fillStyle</code> · <code>staticColor</code>, Badge, StatusLight, Card, Link, ToggleButton(Group), ProgressCircle · ProgressBar <code>staticColor</code>, Toast, Select · GridList <code>isQuiet</code>, ColorSwatchPicker · TableView · Tabs <code>density</code></td><td>없음</td></tr>
        <tr><td class="k"><span class="group-label">B</span>이름 변경</td><td>Checkbox · Switch <code>variant</code> → <code>isEmphasized</code><br>CheckboxGroup · RadioGroup <code>variant</code> → <code>isEmphasized</code> (그룹이 자식에게)<br>Radio <code>variant</code> 삭제 · Form <code>variant</code> → <code>isEmphasized</code><br>TableView <code>variant</code> quiet → <code>isQuiet</code> · Tree <code>variant</code> → <code>isEmphasized</code> (design-data)</td><td>contract 변경</td></tr>
        <tr><td class="k"><span class="group-label">C</span>값 변경</td><td>Meter <code>warning</code>/<code>critical</code> → <code>notice</code>/<code>negative</code> + <code>staticColor</code><br>InlineAlert <code>info</code> → <code>informative</code> + <code>fillStyle</code><br>CardView <code>variant</code> → primary/secondary/tertiary/quiet<br>Tooltip → neutral/informative/negative (design-data)</td><td>contract 변경</td></tr>
        <tr><td class="k"><span class="group-label">D</span>추가</td><td>Slider · TagGroup <code>isEmphasized</code>, Avatar <code>isOverBackground</code>, Disclosure <code>isQuiet</code> · <code>density</code>, Separator <code>staticColor</code></td><td>추가만</td></tr>
        <tr><td class="k"><span class="group-label">E</span>v3 근거 유지</td><td>field <code>isQuiet</code>: TextField · TextArea · ComboBox · SearchField · NumberField · DateField · DatePicker · TimeField · ColorField</td><td>S2 가 뺀 축임을 알고 유지</td></tr>
        <tr><td class="k"><span class="group-label">F</span>어디에도 없음</td><td>ProgressBar <code>variant</code>, Table <code>variant</code> striped/bordered (design-data: "Don't use zebra stripes"), Separator <code>variant</code>, Calendar · RangeCalendar · CalendarGrid · ListBox · GridList · DisclosureGroup · Toolbar · FileTrigger · Skeleton · Pagination · Nav · ColorSwatchPicker · Section · ColorPicker · Chart <code>variant</code></td><td>확장 유지 / 삭제 결정</td></tr>
      </tbody>
    </table></div>
  </section>

  <section aria-labelledby="diffs">
    <h2 id="diffs">값이 다른 prop</h2>
    <p class="lede">이름은 같고 값 집합이 다른 경우입니다. 대부분 <code>size</code> 이며, S2 는 <code>S · M · L · XL</code> (일부 <code>XS</code>), 우리는 <code>xs · sm · md · lg · xl</code> 입니다.</p>
    <div class="scroll"><table>
      <thead><tr><th>type</th><th>prop</th><th>우리</th><th>S2</th></tr></thead>
      <tbody id="diff-body"></tbody>
    </table></div>
  </section>

  <section aria-labelledby="explore">
    <h2 id="explore">컴포넌트별 상세</h2>
    <div class="tools">
      <label for="q" class="hint">검색</label>
      <input type="search" id="q" placeholder="type 또는 prop 이름…" autocomplete="off">
      <div class="tabs" role="group" aria-label="필터" id="filters"></div>
      <span class="count" id="row-count"></span>
    </div>
    <div class="legend" id="row-legend"></div>
    <div class="rows" id="rows"></div>
  </section>

  <section aria-labelledby="byprop">
    <h2 id="byprop">prop 별 보기</h2>
    <div class="tabs" role="group" aria-label="목록 선택" id="prop-tabs"></div>
    <div class="scroll"><table>
      <thead><tr><th>prop</th><th style="text-align:right">개수</th><th>type</th></tr></thead>
      <tbody id="prop-body"></tbody>
    </table></div>
  </section>

  <section aria-labelledby="dec">
    <h2 id="dec">결정이 필요한 것</h2>
    <ol class="decisions">
      <li><b><code>size</code> 표기와 범위</b> — 39개 type. S2 <code>S/M/L/XL</code> 로 맞출지, S2 에 없는 <code>xs</code> 단계와 일부 <code>xl</code> 을 어떻게 할지.</li>
      <li><b>S2 에만 있는 시각 · 내용 prop 의 도입 범위</b> — <code>contextualHelp</code> (16) · <code>isEmphasized</code> (7) · <code>prefix</code> (5) 순으로 많습니다.</li>
      <li><b>F 묶음</b> — 어디에도 없는 <code>variant</code> 를 확장으로 남길지 지울지 (항목별).</li>
      <li><b>B · C 의 contract 변경</b> — 한 번으로 묶을지.</li>
    </ol>
  </section>

  <footer>
    <div>방법: S2 1.8.0 · RAC 1.21.0 의 컴포넌트 props 를 TypeScript 검사기로 상속까지 펼쳐 뽑고, catalog binding accepts · rule 의 variant/size 이름과 대조했습니다. 전역 DOM · aria · 이벤트 · <code>UNSAFE_*</code> · <code>styles</code> 는 비교에서 뺐습니다. origin 의 template 바인딩 prop (Card <code>title</code> 등) 은 비교 대상이 아닙니다.</div>
    <div>원본: <code>docs/explanation/research/S2_PROP_ALIGNMENT_2026-10.md</code> · 데이터 <code>docs/explanation/research/s2-prop-alignment-2026-10/</code></div>
  </footer>
</div>

<script id="data" type="application/json">__DATA__</script>
<script>
(function () {
  const DATA = JSON.parse(document.getElementById("data").textContent);
  const CATS = [
    { key: "same", label: "S2 와 같음", cls: "same" },
    { key: "diff", label: "값이 다름", cls: "diff" },
    { key: "rac", label: "RAC 근거", cls: "rac" },
    { key: "v3", label: "v3 근거", cls: "v3" },
    { key: "own", label: "우리만", cls: "own" },
  ];
  const S2CATS = [
    { key: "s2vis", label: "S2 에만 · 시각/내용" },
    { key: "s2link", label: "S2 에만 · 링크" },
    { key: "s2state", label: "S2 에만 · 상태" },
    { key: "s2behav", label: "S2 에만 · 동작" },
  ];
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") n.className = v; else if (k === "style") n.setAttribute("style", v); else n.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return n;
  };
  const tag = (text, cls) => el("span", { class: "tag t-" + cls }, text);
  const sum = (k) => DATA.reduce((a, x) => a + x[k].length, 0);
  const tot = Object.fromEntries([...CATS, ...S2CATS, { key: "editor" }].map((c) => [c.key, sum(c.key)]));
  const compared = CATS.reduce((a, c) => a + tot[c.key], 0);
  document.getElementById("cmp-total").textContent = compared;
  document.getElementById("cmp-same").textContent = tot.same;
  document.getElementById("cmp-pct").textContent = Math.round((tot.same * 100) / compared);
  const bar = document.getElementById("sum-bar");
  const legend = document.getElementById("sum-legend");
  for (const c of CATS) {
    bar.append(el("div", { style: `width:${(tot[c.key] * 100) / compared}%;background:var(--c-${c.cls})`, title: `${c.label} ${tot[c.key]}` }));
    legend.append(el("span", {}, el("i", { class: "dot", style: `background:var(--c-${c.cls})` }), `${c.label} ${tot[c.key]}`));
  }
  const stats = document.getElementById("sum-stats");
  const noS2 = DATA.filter((x) => !x.s2).length;
  [
    [DATA.length, "비교한 type"],
    [noS2, "S2 대응 컴포넌트 없음 (부품 · 확장)"],
    [tot.s2vis, "S2 에만 있는 시각 · 내용 prop"],
    [tot.s2link + tot.s2state + tot.s2behav, "S2 에만 있는 링크 · 상태 · 동작 prop (노드 · interaction 이 대신함)"],
    [tot.editor, "편집기 축 (children · slot · dataBinding · aria-label, 비교 제외)"],
  ].forEach(([n, label]) => stats.append(el("div", { class: "stat" }, el("b", {}, n), el("small", {}, label))));

  const diffBody = document.getElementById("diff-body");
  const diffs = DATA.flatMap((x) => x.diff.map((d) => ({ type: x.type, ...d })));
  diffs.sort((a, b) => (a.prop === b.prop ? a.type.localeCompare(b.type) : a.prop === "size" ? 1 : b.prop === "size" ? -1 : a.prop.localeCompare(b.prop)));
  for (const d of diffs) {
    const s2set = new Set(d.s2), ourset = new Set(d.ours);
    diffBody.append(el("tr", {},
      el("td", { class: "k" }, d.type),
      el("td", {}, el("code", {}, d.prop)),
      el("td", {}, d.ours.map((v) => tag(v, s2set.has(v) ? "same" : "own"))),
      el("td", {}, d.s2.map((v) => tag(v, ourset.has(v) ? "same" : "s2")))));
  }

  const FILTERS = [
    { key: "all", label: "전체", test: () => true },
    { key: "diff", label: "값이 다름", test: (x) => x.diff.length },
    { key: "v3", label: "v3 근거", test: (x) => x.v3.length },
    { key: "own", label: "우리만", test: (x) => x.own.length },
    { key: "s2vis", label: "S2 에만 (시각·내용)", test: (x) => x.s2vis.length },
    { key: "nos2", label: "S2 대응 없음", test: (x) => !x.s2 },
  ];
  let active = "all";
  try { active = localStorage.getItem("s2align.filter") || "all"; } catch (e) {}
  const filters = document.getElementById("filters");
  for (const f of FILTERS) {
    const b = el("button", { class: "chip", type: "button", "aria-pressed": String(f.key === active), "data-k": f.key }, f.label);
    b.addEventListener("click", () => {
      active = f.key;
      try { localStorage.setItem("s2align.filter", active); } catch (e) {}
      filters.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.k === active)));
      render();
    });
    filters.append(b);
  }
  const rowLegend = document.getElementById("row-legend");
  for (const c of CATS) rowLegend.append(el("span", {}, el("i", { class: "dot", style: `background:var(--c-${c.cls})` }), c.label));
  rowLegend.append(el("span", {}, el("i", { class: "dot", style: "background:var(--c-s2)" }), "S2 에만"));

  const rowsEl = document.getElementById("rows");
  const q = document.getElementById("q");
  function rowFor(x) {
    const ourTotal = CATS.reduce((a, c) => a + x[c.key].length, 0);
    const s2Only = x.s2vis.length + x.s2link.length + x.s2state.length + x.s2behav.length;
    const scale = Math.max(ourTotal + x.s2vis.length, 1);
    const mini = el("div", { class: "mini", "aria-hidden": "true" },
      CATS.map((c) => el("div", { style: `width:${(x[c.key].length * 100) / scale}%;background:var(--c-${c.cls})` })),
      el("div", { style: `width:${(x.s2vis.length * 100) / scale}%;background:var(--c-s2);opacity:.45` }));
    const s2label = x.s2 ? (x.s2 === x.type ? "S2 " + x.s2 : "S2 " + x.s2 + " (이름 다름)") : "S2 대응 없음";
    const summary = el("summary", {},
      el("span", { class: "name" }, x.type),
      el("span", { class: "s2" }, s2label),
      mini);
    const dl = el("dl", {});
    const add = (label, items, cls) => { if (items.length) dl.append(el("dt", {}, `${label} (${items.length})`), el("dd", {}, items.map((i) => tag(i, cls)))); };
    add("S2 와 같음", x.same, "same");
    if (x.diff.length) dl.append(el("dt", {}, `값이 다름 (${x.diff.length})`), el("dd", {}, x.diff.map((d) => el("div", { class: "diffline" }, el("code", {}, d.prop), " — 우리 ", d.ours.join(" · "), " / S2 ", d.s2.join(" · ")))));
    add("RAC 근거", x.rac, "rac");
    add("v3 근거", x.v3, "v3");
    add("우리만", x.own, "own");
    add("편집기 축", x.editor, "editor");
    add("S2 에만 · 시각/내용", x.s2vis, "s2");
    add("S2 에만 · 링크", x.s2link, "editor");
    add("S2 에만 · 상태", x.s2state, "editor");
    add("S2 에만 · 동작", x.s2behav, "editor");
    if (!dl.children.length) dl.append(el("dt", {}, "prop"), el("dd", { class: "hint" }, "비교할 prop 없음"));
    return el("details", { class: "row", id: "t-" + x.type }, summary, el("div", { class: "detail" }, dl));
  }
  function render() {
    const f = FILTERS.find((x) => x.key === active) || FILTERS[0];
    const term = q.value.trim().toLowerCase();
    const list = DATA.filter((x) => f.test(x)).filter((x) => {
      if (!term) return true;
      if (x.type.toLowerCase().includes(term) || (x.s2 || "").toLowerCase().includes(term)) return true;
      return ["same", "rac", "v3", "own", "s2vis", "s2link", "s2state", "s2behav", "editor"].some((k) => x[k].some((p) => p.toLowerCase().includes(term))) || x.diff.some((d) => d.prop.toLowerCase().includes(term));
    });
    rowsEl.replaceChildren(...list.map(rowFor));
    document.getElementById("row-count").textContent = `${list.length} / ${DATA.length} type`;
    if (term && list.length <= 3) rowsEl.querySelectorAll("details").forEach((d) => (d.open = true));
  }
  q.addEventListener("input", render);
  render();

  const PROPTABS = [
    { key: "s2vis", label: "S2 에만 · 시각/내용", cls: "s2" },
    { key: "own", label: "우리만", cls: "own" },
    { key: "v3", label: "v3 근거", cls: "v3" },
    { key: "rac", label: "RAC 근거", cls: "rac" },
  ];
  const propTabs = document.getElementById("prop-tabs");
  const propBody = document.getElementById("prop-body");
  let propActive = "s2vis";
  function renderProps() {
    const groups = new Map();
    for (const x of DATA) for (const p of x[propActive]) (groups.get(p) || groups.set(p, []).get(p)).push(x.type);
    const cls = PROPTABS.find((t) => t.key === propActive).cls;
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    propBody.replaceChildren(...sorted.map(([p, ts]) => el("tr", {},
      el("td", {}, tag(p, cls)),
      el("td", { style: "text-align:right;font-variant-numeric:tabular-nums" }, ts.length),
      el("td", {}, ts.join(", ")))));
  }
  for (const t of PROPTABS) {
    const b = el("button", { class: "chip", type: "button", "aria-pressed": String(t.key === propActive), "data-k": t.key }, `${t.label} ${tot[t.key]}`);
    b.addEventListener("click", () => {
      propActive = t.key;
      propTabs.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.k === propActive)));
      renderProps();
    });
    propTabs.append(b);
  }
  renderProps();
  if (location.hash.startsWith("#t-")) { const d = document.getElementById(location.hash.slice(1)); if (d) { d.open = true; d.scrollIntoView(); } }
})();
</script>
"""

payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
open(out_path, "w").write(PAGE.replace("__DATA__", payload))
print("wrote", out_path)
