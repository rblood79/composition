/**
 * ADR-305 — 문서 하나의 computed style 스냅샷 · 비교 (G0 ~ G3 의 oracle = 분리 직전 화면).
 *
 * `captureInPage` 는 page/frame.evaluate 로 넘기는 자기완결 함수다.
 * - 모든 요소 (iframe 안 제외 — 다른 문서) 의 computed style 전 속성. 화면 안에서 가장 흔한 값 (mode) 과
 *   다른 속성만 적고 같은 diff 는 한 번만 저장한다. `::before` · `::after` (content 가 있을 때) · `::placeholder`
 *   (placeholder 속성이 있을 때) 도 같은 방식.
 * - 상태 합성: RAC 요소 (`data-rac` · `react-aria-*` class) 에 상태 속성 (`data-hovered` …) 을 하나씩 붙여
 *   그 요소와 자손 `maxDesc` 개의 시각 속성을 다시 읽는다 — CSS cascade 만 보는 oracle 이라 RAC 동작은 무관.
 *   쉬는 상태와 다를 때만 적는다.
 * - 선택자 계수: `selectors` = `[id, [상위집합 선택자…]]` — 맞는 요소 수와 portal (`[data-context]` 조상 없음)
 *   · catalog 노드 (`[data-catalog-id]` 조상 포함) 수, 표본 key 3 개.
 */
export function captureInPage({
  selectors = [],
  statePass = true,
  maxDesc = 24,
  stateAttrs = [],
  stateProps = [],
}) {
  for (const a of document.getAnimations()) {
    try {
      a.finish();
    } catch {
      // 무한 반복 — 첫 프레임에 멈춘다 (실행마다 같은 값)
      a.pause();
      a.currentTime = 0;
    }
  }
  const keyOf = new Map();
  const elements = [];
  const walk = (el, parentKey, idx) => {
    const raw =
      typeof el.className === "string"
        ? el.className
        : (el.getAttribute("class") ?? "");
    const cls = raw.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    const key = `${parentKey}>${idx}:${el.localName}${cls ? `.${cls}` : ""}`;
    keyOf.set(el, key);
    elements.push(el);
    if (el.localName === "iframe") return;
    let i = 0;
    for (const c of el.children) walk(c, key, i++);
  };
  walk(document.documentElement, "", 0);

  const allProps = [...getComputedStyle(document.documentElement)].filter(
    (p) => !p.startsWith("--"),
  );
  const vec = (cs, props) => props.map((p) => cs.getPropertyValue(p));
  const records = [];
  for (const el of elements) {
    const key = keyOf.get(el);
    records.push([key, vec(getComputedStyle(el), allProps)]);
    for (const pseudo of ["::before", "::after"]) {
      const cs = getComputedStyle(el, pseudo);
      if (cs.content !== "none" && cs.content !== "normal")
        records.push([`${key}${pseudo}`, vec(cs, allProps)]);
    }
    if (el.hasAttribute?.("placeholder"))
      records.push([
        `${key}::placeholder`,
        vec(getComputedStyle(el, "::placeholder"), allProps),
      ]);
  }
  const mode = allProps.map((_, i) => {
    const counts = new Map();
    for (const [, v] of records) counts.set(v[i], (counts.get(v[i]) ?? 0) + 1);
    let best = null;
    let n = -1;
    for (const [val, c] of counts)
      if (c > n) {
        best = val;
        n = c;
      }
    return best;
  });
  const styleIds = new Map();
  const styles = [];
  const idOf = (diff) => {
    const s = JSON.stringify(diff);
    let id = styleIds.get(s);
    if (id === undefined) {
      id = styles.length;
      styles.push(diff);
      styleIds.set(s, id);
    }
    return id;
  };
  const diffOf = (v, props, base) => {
    const d = {};
    props.forEach((p, i) => {
      if (v[i] !== base[i]) d[p] = v[i];
    });
    return d;
  };
  const restIds = {};
  for (const [key, v] of records)
    restIds[key] = idOf(diffOf(v, allProps, mode));

  // 선택자 계수
  const counts = {};
  for (const [id, list] of selectors) {
    const hit = new Set();
    for (const sel of list) {
      try {
        for (const el of document.querySelectorAll(sel)) hit.add(el);
      } catch {
        counts[id] = { invalid: true };
      }
    }
    if (!hit.size) continue;
    let portal = 0;
    let catalog = 0;
    for (const el of hit) {
      if (!el.closest("[data-context]")) portal++;
      if (el.closest("[data-catalog-id]")) catalog++;
    }
    counts[id] = {
      n: hit.size,
      portal,
      catalog,
      sample: [...hit].slice(0, 3).map((el) => keyOf.get(el)),
    };
  }

  // 상태 합성
  const states = {};
  if (statePass) {
    const modeOf = new Map(allProps.map((p, i) => [p, mode[i]]));
    const stateMode = stateProps.map((p) => modeOf.get(p) ?? "");
    const restCache = new Map();
    const readTargets = (el) => {
      const out = [el];
      const it = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
      it.nextNode();
      while (out.length <= maxDesc && it.nextNode()) out.push(it.currentNode);
      return out;
    };
    const vecWithPseudo = (el) => {
      const r = [[keyOf.get(el), vec(getComputedStyle(el), stateProps)]];
      for (const pseudo of ["::before", "::after"]) {
        const cs = getComputedStyle(el, pseudo);
        if (cs.content !== "none" && cs.content !== "normal")
          r.push([`${keyOf.get(el)}${pseudo}`, vec(cs, stateProps)]);
      }
      return r;
    };
    const candidates = elements.filter(
      (el) =>
        (el.hasAttribute("data-rac") ||
          /(^|\s)react-aria-/.test(
            typeof el.className === "string" ? el.className : "",
          )) &&
        el.getClientRects().length > 0,
    );
    for (const el of candidates) {
      const targets = readTargets(el);
      for (const t of targets)
        if (!restCache.has(t))
          restCache.set(t, new Map(vecWithPseudo(t).map(([k, v]) => [k, v])));
      for (const attr of stateAttrs) {
        if (el.hasAttribute(attr)) continue;
        el.setAttribute(attr, "true");
        for (const t of targets) {
          const rest = restCache.get(t);
          for (const [k, v] of vecWithPseudo(t)) {
            const r = rest.get(k);
            if (r && r.every((x, i) => x === v[i])) continue;
            (states[attr] ??= {})[`${keyOf.get(el)}|${k}`] = idOf(
              diffOf(v, stateProps, stateMode),
            );
          }
        }
        el.removeAttribute(attr);
      }
    }
  }
  return {
    url: location.href,
    elementCount: elements.length,
    props: allProps,
    mode: Object.fromEntries(allProps.map((p, i) => [p, mode[i]])),
    stateProps,
    rest: restIds,
    states,
    styles,
    counts,
  };
}

export const STATE_ATTRS = [
  "data-hovered",
  "data-pressed",
  "data-focus-visible",
  "data-focused",
  "data-focus-within",
  "data-selected",
  "data-disabled",
  "data-invalid",
  "data-open",
  "data-indeterminate",
  "data-readonly",
  "data-required",
  "data-placeholder",
  "data-current",
  "data-empty",
  "data-expanded",
  "data-dragging",
  "data-drop-target",
];

export const STATE_PROPS = [
  "display",
  "visibility",
  "opacity",
  "color",
  "background-color",
  "background-image",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "outline-color",
  "outline-style",
  "outline-width",
  "outline-offset",
  "box-shadow",
  "text-decoration-line",
  "text-decoration-color",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "gap",
  "row-gap",
  "column-gap",
  "flex-direction",
  "align-items",
  "justify-content",
  "position",
  "top",
  "left",
  "right",
  "bottom",
  "z-index",
  "transform",
  "translate",
  "scale",
  "rotate",
  "filter",
  "backdrop-filter",
  "cursor",
  "pointer-events",
  "fill",
  "stroke",
  "stroke-width",
  "content",
  "overflow-x",
  "overflow-y",
  "white-space",
  "text-overflow",
  "transition-property",
  "transition-duration",
  "animation-name",
  "forced-color-adjust",
  "accent-color",
  "caret-color",
  "mask-image",
  "clip-path",
];

/** 내용 (CSS 아님) — Icon 노드의 기본 아이콘은 삽입마다 무작위라 svg 안 도형 수 · 경로 데이터가 다르다. */
const CONTENT_KEY = /react-aria-Icon>\d+:svg>|^>0:html>0:head/; // <head> 의 style · script 태그 수는 시트 구성 (화면 아님)
const CONTENT_PROPS = new Set(["d"]);
/** 포인터를 따라가는 값 — Canvas 배경 glow 의 mask 중심은 마지막 pointermove 좌표다. */
const POINTER_PROP = (key, prop) =>
  prop === "mask-image" && key.includes("dot-background--glow");

/**
 * 기준 요소 아래만 남기고 key 를 그 요소부터로 바꾼다 — 다른 문서 (옛 Publish route · 새 Publish 진입 ·
 * Preview iframe) 의 같은 사용자 DOM 을 대조할 때. `anchor` = key 안 문자열 (예 `div.react-aria-Body`).
 */
export function anchorCapture(cap, anchor) {
  const cut = (key) => {
    const i = key.indexOf(anchor);
    return i < 0 ? null : key.slice(i);
  };
  const rest = {};
  for (const [k, v] of Object.entries(cap.rest)) {
    const c = cut(k);
    if (c) rest[c] = v;
  }
  const states = {};
  for (const [attr, m] of Object.entries(cap.states)) {
    states[attr] = {};
    for (const [k, v] of Object.entries(m)) {
      const [el, target] = k.split("|");
      const ce = cut(el);
      const ct = cut(target);
      if (ce && ct) states[attr][`${ce}|${ct}`] = v;
    }
  }
  return { ...cap, rest, states };
}

/** 두 스냅샷 (같은 화면) 비교 → `{ missing, added, delta: [{ key, prop, a, b, state? }] }`. */
export function compareCaptures(a, b) {
  const resolve = (cap, id, props) => {
    const diff = cap.styles[id] ?? {};
    const out = {};
    for (const p of props) out[p] = p in diff ? diff[p] : cap.mode[p];
    return out;
  };
  // 시각 숨김 상자 (RAC live announcer 등 — 1px · clip-path inset(50%)) 의 자손은 안내 문구 (타이밍) 라 뺀다
  const hiddenRoots = new Set();
  for (const cap of [a, b])
    for (const [key, id] of Object.entries(cap.rest)) {
      const s = cap.styles[id] ?? {};
      const v = (p) => (p in s ? s[p] : cap.mode[p]);
      if (
        v("clip-path") === "inset(50%)" &&
        v("width") === "1px" &&
        v("position") === "absolute"
      )
        hiddenRoots.add(`${key}>`);
    }
  const inHidden = (key) => {
    for (const r of hiddenRoots) if (key.startsWith(r)) return true;
    return false;
  };
  const props = [...new Set([...a.props, ...b.props])].filter(
    (p) => !CONTENT_PROPS.has(p),
  );
  const delta = [];
  const missing = [];
  const added = [];
  for (const key of Object.keys(a.rest)) {
    if (/^>0:html>0:head/.test(key) || inHidden(key)) continue;
    if (!(key in b.rest)) {
      if (!CONTENT_KEY.test(key)) missing.push(key);
      continue;
    }
    const sa = resolve(a, a.rest[key], props);
    const sb = resolve(b, b.rest[key], props);
    for (const p of props)
      if (sa[p] !== sb[p] && !POINTER_PROP(key, p))
        delta.push({ key, prop: p, a: sa[p], b: sb[p] });
  }
  for (const key of Object.keys(b.rest))
    if (!(key in a.rest) && !CONTENT_KEY.test(key) && !inHidden(key))
      added.push(key);
  const sprops = a.stateProps.filter((p) => !CONTENT_PROPS.has(p));
  const attrs = new Set([...Object.keys(a.states), ...Object.keys(b.states)]);
  for (const attr of attrs) {
    const ka = a.states[attr] ?? {};
    const kb = b.states[attr] ?? {};
    for (const k of new Set([...Object.keys(ka), ...Object.keys(kb)])) {
      const target = k.split("|")[1];
      if (!(target in a.rest) || !(target in b.rest)) continue;
      const sa = resolve(a, k in ka ? ka[k] : a.rest[target], sprops);
      const sb = resolve(b, k in kb ? kb[k] : b.rest[target], sprops);
      for (const p of sprops)
        if (sa[p] !== sb[p])
          delta.push({ key: k, prop: p, a: sa[p], b: sb[p], state: attr });
    }
  }
  return { missing, added, delta };
}
