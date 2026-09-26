// ADR-027 Phase D3 — 텍스트 편집 전환 픽셀 게이트 (headed Playwright, 실제 빌더 부팅).
//   node apps/builder/scripts/adr027-text-edit-parity.mjs [--base-url http://localhost:5173] [--out DIR] [--headless]
//
// 타입별 × 줌 (100% · 200%) 로 같은 요소를 두 번 캡처한다 — (A) 선택된 채 Skia 가 텍스트를 그린
// 상태, (B) 더블클릭으로 편집 진입해 Skia 텍스트가 숨고 DOM 오버레이가 그 자리를 채운 상태.
// 선택 상자는 Skia 오버레이라 두 캡처에 같이 들어가고 (편집 상태에 무관), 캐럿은 harness CSS 로
// 감춘다. 판정 2축 (화면 px, 줌 무관):
//   (1) shift — 두 캡처의 텍스트 지도 (텍스트 색과의 거리를 배경색 기준으로 정규화, 선택 상자 띠는
//       제외) 를 ±6px 안에서 SAD 최소로 맞춘 정수 이동량. 글리프가 통째로 밀렸는지 본다 (AA 두께
//       차에 둔감).
//   (2) bbox — 지도 반치 (half-max) 이상 픽셀의 상자 차 (좌·상·우·하). 줄 수·폭·줄바꿈 자리가
//       같은지 본다. 종전의 "색 tolerance 마스크" 는 DOM 글리프가 Skia 보다 굵어 (ink 1.3~1.9×) AA
//       가장자리 1~2px 를 잡았다.
// 둘 다 각 축 ≤ 1 CSS px (= 화면 1px × zoom) 이면 PASS. pixelmatch 총 diff 는 참고치 (래스터라이저
// AA 는 원래 다르다).
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { loadStorageState, createIsolatedProject } from "./perf-baseline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../../..");
const require = createRequire(import.meta.url);
// pngjs / pixelmatch 는 transitive 의존 — pnpm store 에서 찾는다 (adr211 하니스와 같은 방식).
const storeDir = (prefix) =>
  readdirSync(`${REPO}/node_modules/.pnpm`).find((d) => d.startsWith(prefix));
const { PNG } = require(
  `${REPO}/node_modules/.pnpm/${storeDir("pngjs@")}/node_modules/pngjs/lib/png.js`,
);
const pixelmatch = require(
  `${REPO}/node_modules/.pnpm/${storeDir("pixelmatch@")}/node_modules/pixelmatch/index.js`,
);
const matchPixels = pixelmatch.default ?? pixelmatch;

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const baseUrl = opt("--base-url", process.env.BUILDER_URL ?? "http://localhost:5173");
const outDir = opt("--out", "/private/tmp/adr027-text-edit-parity");
const headless = args.includes("--headless");
mkdirSync(outDir, { recursive: true });

const TOLERANCE_PX = 1;
const ZOOMS = [1, 2];
const CASES = [
  {
    key: "text-wrap",
    palette: "text",
    props: {
      children:
        "캔버스에서 텍스트를 직접 편집할 때 오버레이와 Skia 렌더링이 얼마나 일치하는지 확인하는 긴 문장입니다. The quick brown fox jumps over the lazy dog.",
      style: { width: "300px" },
    },
  },
  {
    key: "text-center-padded",
    palette: "text",
    props: {
      children: "가운데 정렬 Centered label",
      style: {
        width: "300px",
        textAlign: "center",
        padding: "12px",
        border: "2px solid #d64545",
      },
    },
  },
  {
    // 팔레트에 heading 항목이 없어 text 를 제목 크기로 — 큰 글리프의 baseline 차를 본다.
    key: "text-heading-28",
    palette: "text",
    props: {
      children: "Heading 제목 28",
      style: { width: "400px", fontSize: "28px", fontWeight: 600 },
    },
  },
  {
    // 한글 단일행 — Skia 가 ideographic baseline 원점으로 descent 만큼 위에 그리던 회귀 (D3 에서 수리).
    key: "text-korean-single",
    palette: "text",
    props: { children: "가운데 정렬 라벨", style: { width: "300px" } },
  },
  {
    // pre-wrap + 명시 줄바꿈 — Enter = 줄바꿈 경로의 시각 (Skia 는 \n 을 항상 그린다).
    key: "text-pre-wrap-newline",
    palette: "text",
    props: {
      children: "첫째 줄 first line\n둘째 줄 second line\n셋째",
      style: { width: "320px", whiteSpace: "pre-wrap" },
    },
  },
  {
    // ADR-027 후속 — normal + `\n` (import · AI 생성 데이터). CSS segment break transformation:
    //   DOM 은 공백으로 접어 폭이 줄을 정한다. Skia 도 같이 접고 (종전 8줄), 편집기 초기값도 접는다.
    key: "text-normal-newline",
    palette: "text",
    props: {
      children: Array.from({ length: 8 }, (_, i) => `줄 ${i + 1} line`).join(
        "\n",
      ),
      style: { width: "320px" },
    },
  },
  {
    // ADR-027 후속 6 — Wrap "Truncate": nowrap + ellipsis + overflow hidden. Skia 가 nowrap 을
    //   intrinsic 폭으로 다시 layout 하며 "…" 을 잃었다 (Preview "ABCDEFG AB…" ↔ Canvas 678px 전부).
    key: "text-truncate",
    palette: "text",
    truncate: true,
    props: {
      children:
        "ABCDEFG ABCDEFG ABCDEFG 12345 가나다라마바사 098763 BGTRFV bye bye",
      style: {
        width: "200px",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        overflow: "hidden",
      },
    },
  },
  // TextArea 는 TEXT_EDITABLE_TAGS 밖 (오버레이 편집 없음 — RAC textarea 자식) 이라 케이스 없음.
  { key: "button", palette: "button", props: { children: "Save" } },
  { key: "badge", palette: "badge", props: { children: "New" } },
  { key: "link", palette: "link", props: { children: "Learn more 자세히" } },
];

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  process.stderr.write(
    `${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + JSON.stringify(detail) : ""}\n`,
  );
};

const settle = (page, ms = 400) => page.waitForTimeout(ms);
const applyViewport = (page, s) =>
  page.evaluate(async (s) => {
    window.__composition_APPLY_VIEWPORT__(s);
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  }, s);

/**
 * production 형태로 심는다 — 팔레트 클릭 (useElementCreator 경로) 뒤 updateElementProps.
 * store addComplexElement 시드는 Text 높이가 한 줄로 고정돼 3줄이 상자 밖으로 넘쳤다.
 */
async function seed(page) {
  await page
    .locator('.panel-toggle-rail button[aria-label="Components"]')
    .click();
  await page.waitForSelector("button.list-item", { timeout: 10_000 });
  const ids = {};
  for (const c of CASES) {
    const before = await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.page_id === st.currentPageId && e.type === "body",
      );
      st.setSelectedElement(body.id);
      return body.id;
    });
    await page.waitForTimeout(150);
    await page
      .locator(`button.list-item[title="Add ${c.palette} element"]`)
      .first()
      .click();
    await page.waitForFunction(
      (bodyId) => {
        const st = window.__composition_STORE__.getState();
        return st.selectedElementId && st.selectedElementId !== bodyId;
      },
      before,
      { timeout: 10_000 },
    );
    // 팔레트 추가는 (0,0) 절대 배치 — 겹치지 않게 절대 배치 케이스끼리 top 을 준다 (Text 는 흐름).
    const index = CASES.filter((k) => k.palette !== "text").indexOf(c);
    const id = await page.evaluate(
      ({ props, index }) => {
        const st = window.__composition_STORE__.getState();
        const id = st.selectedElementId;
        const el = st.elementsMap.get(id);
        st.updateElementProps(id, {
          ...el.props,
          ...props,
          // Text 는 흐름에 둔다 (여러 케이스가 세로로 쌓인다). 나머지는 절대 배치.
          // (D3 에서 발견·수리: 고정 px 폭 텍스트 leaf 의 줄바꿈 높이를 부모 폭으로 재던 엔진 결함 —
          //   `enrichWithIntrinsicSize` · textLeafExplicitWidthWrapHeight.test.)
          style: {
            ...(el.props?.style ?? {}),
            ...(el.type === "Text"
              ? { position: "static", marginTop: "24px" }
              : {
                  position: "absolute",
                  left: "40px",
                  top: `${360 + index * 110}px`,
                }),
            ...(props.style ?? {}),
          },
        });
        return id;
      },
      { props: c.props, index },
    );
    ids[c.key] = id;
    await page.waitForTimeout(400);
  }
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  // 떠 있는 Components 패널이 캔버스 왼쪽을 덮는다 — 닫는다.
  await page
    .locator('.panel-toggle-rail button[aria-label="Components"]')
    .click();
  await page.waitForTimeout(300);
  return ids;
}

/** scene 좌표 layout rect → 화면 rect (canvas bbox + camera). */
async function screenRect(page, id) {
  return page.evaluate((id) => {
    // 오버레이와 같은 원천 — 마지막 프레임 boundsMap (layout map 은 페이지 병합 캐시가 늦을 수 있다).
    const r = window.__composition_RENDER_DEBUG__.getSceneBounds(id);
    if (!r) return null;
    const cam = window.__composition_VIEWPORT__();
    const canvas = document
      .querySelector('[data-testid="skia-canvas-unified"]')
      .getBoundingClientRect();
    const z = cam.zoom;
    return {
      x: canvas.left + r.x * z + cam.panOffset.x,
      y: canvas.top + r.y * z + cam.panOffset.y,
      w: r.width * z,
      h: r.height * z,
      zoom: z,
    };
  }, id);
}

async function textColor(page, id) {
  return page.evaluate((id) => {
    const find = (n) => {
      if (!n) return null;
      if (n.text) return n.text;
      for (const c of n.children ?? []) {
        const f = find(c);
        if (f) return f;
      }
      return null;
    };
    const t = find(window.__composition_SKIA_DEBUG__.getSkiaNode(id));
    if (!t) return null;
    const c = t.presentationColor ?? t.color;
    return [c[0], c[1], c[2]].map((v) => Math.round(v * 255));
  }, id);
}

/** 요소 rect 안 (clip 의 `band` inset 안쪽) 에서 가장 많은 색 (= 요소 배경). 텍스트 색과의 거리 정규화에 쓴다. */
function dominantColor(png, band) {
  const { data, width, height } = png;
  const counts = new Map();
  for (let y = band + 3; y < height - band - 3; y += 1)
    for (let x = band + 3; x < width - band - 3; x += 1) {
      const i = (y * width + x) * 4;
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  let best = 0,
    bestN = -1;
  for (const [k, n] of counts) if (n > bestN) ((best = k), (bestN = n));
  return [(best >> 16) & 255, (best >> 8) & 255, best & 255];
}

/**
 * 텍스트 색과의 거리로 만든 지도 (배경 0 · 텍스트 색 1). 선택 상자 (요소 rect 위 1px stroke +
 * 모서리 핸들) 는 두 캡처에 똑같이 들어가지만 텍스트 색과 가까울 수 있어 (Link 파랑) rect 가장자리
 * 띠 (`band` ± 2) 안에서는 stroke 색 (rect 왼쪽 변 중앙에서 샘플) 에 더 가까운 픽셀을 0 으로,
 * 모서리 핸들 상자는 통째로 0 으로 둔다. 띠 안의 글리프 픽셀 (padding 상자 위에 그려진 텍스트) 은
 * 남긴다 — 종전의 띠 전체 0 은 그 행을 지워 bbox 위를 6px 어긋나게 했다.
 */
function textMap(png, rgb, bg, band) {
  const { width, height, data } = png;
  const out = new Float32Array(width * height);
  const span =
    Math.abs(bg[0] - rgb[0]) +
    Math.abs(bg[1] - rgb[1]) +
    Math.abs(bg[2] - rgb[2]);
  if (span <= 0) return out;
  const edge = 2,
    handle = 10;
  const si = (Math.floor(height / 2) * width + band) * 4;
  const sel = [data[si], data[si + 1], data[si + 2]];
  const dist = (i, c) =>
    Math.abs(data[i] - c[0]) +
    Math.abs(data[i + 1] - c[1]) +
    Math.abs(data[i + 2] - c[2]);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const inBand =
        Math.abs(x - band) <= edge ||
        Math.abs(x - (width - 1 - band)) <= edge ||
        Math.abs(y - band) <= edge ||
        Math.abs(y - (height - 1 - band)) <= edge;
      if (inBand && dist(i, sel) < dist(i, rgb)) continue;
      const cornerX = x < band + handle || x > width - 1 - band - handle;
      const cornerY = y < band + handle || y > height - 1 - band - handle;
      if (cornerX && cornerY) continue;
      out[y * width + x] = Math.max(0, 1 - dist(i, rgb) / span);
    }
  return out;
}

/** 어둡기 반치 이상 픽셀의 bbox. */
function halfMaxBBox(map, width, height) {
  let max = 0;
  for (let i = 0; i < map.length; i += 1) if (map[i] > max) max = map[i];
  if (max <= 0) return null;
  const thr = max / 2;
  let l = Infinity,
    t = Infinity,
    r = -Infinity,
    b = -Infinity,
    n = 0;
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      if (map[y * width + x] < thr) continue;
      n += 1;
      if (x < l) l = x;
      if (x > r) r = x;
      if (y < t) t = y;
      if (y > b) b = y;
    }
  return n ? { l, t, r, b, n } : null;
}

/** B 를 (dx, dy) 옮겼을 때 A 와 가장 잘 겹치는 정수 이동량 (±range, SAD 최소). */
function bestShift(a, b, width, height, range = 6) {
  let best = { dx: 0, dy: 0, sad: Infinity };
  for (let dy = -range; dy <= range; dy += 1)
    for (let dx = -range; dx <= range; dx += 1) {
      let sad = 0;
      for (let y = range; y < height - range; y += 1)
        for (let x = range; x < width - range; x += 1) {
          sad += Math.abs(a[y * width + x] - b[(y + dy) * width + (x + dx)]);
        }
      if (sad < best.sad) best = { dx, dy, sad };
    }
  return best;
}

async function captureClip(page, clip, file) {
  const buf = await page.screenshot({ clip });
  writeFileSync(file, buf);
  return PNG.sync.read(buf);
}

async function main() {
  const storageState = loadStorageState(resolve(here, ".auth-session.json"));
  const browser = await chromium.launch({ channel: "chrome", headless });
  try {
    const context = await browser.newContext({
      storageState,
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => process.stderr.write(`[pageerror] ${e}\n`));
    const project = await createIsolatedProject(page, baseUrl);
    process.stderr.write(`[boot] ${project.projectUrl}\n`);
    const ids = await seed(page);
    await page.waitForTimeout(1500);
    // 캐럿은 깜빡여 비결정적 — harness 에서만 감춘다. 더블클릭의 단어 선택은 End 로 접는다.
    await page.addStyleTag({
      content: ".ql-editor{caret-color:transparent !important}",
    });

    // 시드한 페이지가 뷰포트 밖이면 layout·bounds 가 없다 (컬링) — 먼저 페이지 원점을 화면에
    // 두고 scene bounds 를 읽은 뒤, 케이스마다 요소 좌상단을 화면 (480, 300) 에 놓는다.
    const pageOrigin = await page.evaluate((id) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elementsMap.get(id);
      return st.pagePositions[el.page_id] ?? { x: 0, y: 0 };
    }, ids["text-wrap"]);
    await applyViewport(page, {
      scale: 1,
      x: 260 - pageOrigin.x,
      y: 60 - pageOrigin.y,
    });
    await settle(page, 1000);
    const sceneBounds = {};
    for (const c of CASES) {
      sceneBounds[c.key] = await page.evaluate(
        (id) => window.__composition_RENDER_DEBUG__.getSceneBounds(id) ?? null,
        ids[c.key],
      );
    }
    for (const zoom of ZOOMS) {
      for (const c of CASES) {
        const id = ids[c.key];
        const name = `${c.key} @${zoom * 100}%`;
        const sb = sceneBounds[c.key];
        if (sb) {
          await applyViewport(page, {
            scale: zoom,
            x: 480 - sb.x * zoom,
            y: 300 - sb.y * zoom,
          });
          await settle(page, 600);
        }
        const rect = await screenRect(page, id);
        const rgb = await textColor(page, id);
        if (!rect || !rgb) {
          const probe = await page.evaluate((id) => {
            const st = window.__composition_STORE__.getState();
            const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
            return {
              inStore: st.elementsMap.has(id),
              el: st.elementsMap.get(id)?.type ?? null,
              layoutSize: lm?.size ?? null,
              layoutSample: lm ? [...lm.keys()].slice(0, 5) : null,
              skia: !!window.__composition_SKIA_DEBUG__.getSkiaNode(id),
            };
          }, id);
          check(name, false, {
            reason: "layout/skia node 없음",
            rect,
            rgb,
            probe,
          });
          continue;
        }
        // 문단이 상자 안에 드는가 — Skia 줄 수 × 줄 높이 ≤ 상자 높이 (normal + `\n` 이 8줄로
        //   상자 밖으로 넘치던 결함의 게이트; 편집기 비교는 clip 이 상자라 넘침을 못 본다).
        const lines = await page.evaluate(
          (id) =>
            window.__composition_RENDER_DEBUG__.resolveTextLineMetrics(id),
          id,
        );
        if (lines && c.truncate) {
          // 줄임: 한 줄 · 줄 폭 ≤ 상자 폭 (ellipsis 가 살아 있으면 paragraph 가 maxWidth 안에서 끝난다).
          const lineW = Math.max(...lines.map((m) => m.width)) * zoom;
          check(
            `${name} truncated within box`,
            lines.length === 1 && lineW <= rect.w,
            {
              lines: lines.length,
              lineW: +lineW.toFixed(1),
              boxW: +rect.w.toFixed(1),
            },
          );
        }
        if (lines) {
          const paraH = lines.reduce((acc, m) => acc + m.height, 0) * zoom;
          check(`${name} paragraph fits box`, paraH <= rect.h + 1 * zoom, {
            lines: lines.length,
            paraH: +paraH.toFixed(2),
            boxH: +rect.h.toFixed(2),
          });
        }
        // 선택 상자 (Skia 오버레이) 를 두 캡처에 똑같이 넣는다 — 먼저 클릭으로 선택.
        // 넓은 요소는 중심이 뷰포트 밖일 수 있다 — 왼쪽 300px 안에서 클릭.
        const cx = rect.x + Math.min(rect.w, 300) / 2;
        const cy = rect.y + rect.h / 2;
        await page.mouse.click(cx, cy);
        await settle(page, 500);
        const pad = 6;
        const clip = {
          x: Math.max(0, Math.floor(rect.x - pad)),
          y: Math.max(0, Math.floor(rect.y - pad)),
          width: Math.ceil(rect.w + pad * 2),
          height: Math.ceil(rect.h + pad * 2),
        };
        const stale = await page.evaluate(
          () => !!document.querySelector("[data-text-edit-overlay]"),
        );
        if (stale)
          process.stderr.write(`[warn] ${name}: 이전 편집 오버레이 잔존\n`);
        const a = await captureClip(
          page,
          clip,
          `${outDir}/${c.key}-z${zoom}-skia.png`,
        );
        await page.mouse.dblclick(cx, cy);
        const entered = await page
          .waitForSelector("[data-text-edit-overlay]", { timeout: 4000 })
          .then(() => true)
          .catch(() => false);
        if (!entered) {
          const state = await page.evaluate((id) => {
            const st = window.__composition_STORE__.getState();
            return {
              selected: st.selectedElementId,
              overlayBefore: !!document.querySelector(
                "[data-text-edit-overlay]",
              ),
              type: st.elementsMap.get(id)?.type,
              parent: st.elementsMap.get(id)?.parent_id,
            };
          }, id);
          await page.screenshot({
            path: `${outDir}/${c.key}-z${zoom}-fail.png`,
          });
          check(name, false, { reason: "편집 진입 실패", id, rect, state });
          continue;
        }
        await page.keyboard.press("End");
        await page.mouse.move(5, 5);
        await settle(page, 500);
        const { nudge, nudgeSrc } = await page.evaluate(() => {
          const ds =
            document.querySelector("[data-text-edit-overlay]")
              ?.firstElementChild?.dataset ?? {};
          return {
            nudge: ds.textEditNudge ?? null,
            nudgeSrc: ds.textEditNudgeSrc ?? null,
          };
        });
        const b = await captureClip(
          page,
          clip,
          `${outDir}/${c.key}-z${zoom}-dom.png`,
        );
        await page.keyboard.press("Escape");
        await settle(page, 300);

        if (c.truncate) {
          // 편집기는 줄임 없이 전문을 보인다 (Figma 도 편집 중엔 줄임 해제) — ink 비교는 하지 않는다.
          process.stderr.write(
            `SKIP ${name} — 편집기는 줄임 해제 (ink 비교 대상 아님)\n`,
          );
          continue;
        }
        const bg = dominantColor(a, pad);
        const mapA = textMap(a, rgb, bg, pad);
        const mapB = textMap(b, rgb, bg, pad);
        const boxA = halfMaxBBox(mapA, a.width, a.height);
        const boxB = halfMaxBBox(mapB, b.width, b.height);
        const shift = bestShift(mapA, mapB, a.width, a.height);
        const diffPng = new PNG({ width: a.width, height: a.height });
        const diffCount = matchPixels(
          a.data,
          b.data,
          diffPng.data,
          a.width,
          a.height,
          { threshold: 0.2 },
        );
        writeFileSync(
          `${outDir}/${c.key}-z${zoom}-diff.png`,
          PNG.sync.write(diffPng),
        );
        if (!boxA || !boxB) {
          check(name, false, {
            reason: "ink 마스크 비어 있음",
            boxA,
            boxB,
            rgb,
          });
          continue;
        }
        const delta = {
          l: boxB.l - boxA.l,
          t: boxB.t - boxA.t,
          r: boxB.r - boxA.r,
          b: boxB.b - boxA.b,
        };
        const worst = Math.max(
          ...Object.values(delta).map(Math.abs),
          Math.abs(shift.dx),
          Math.abs(shift.dy),
        );
        // 허용치는 CSS px — 200% 캡처에서는 화면 2px. DOM 은 글리프 baseline 을 device px 로 스냅해
        //   (transform scale 안에서도) 0.5 CSS px 의 양자화가 남는다.
        check(name, worst <= TOLERANCE_PX * zoom, {
          shift: { dx: shift.dx, dy: shift.dy },
          delta,
          inkA: boxA.n,
          inkB: boxB.n,
          diffPx: diffCount,
          area: a.width * a.height,
          nudge,
          nudgeSrc,
        });
      }
      await page.evaluate(() =>
        window.__composition_STORE__.getState().setSelectedElement(null),
      );
    }
  } finally {
    await browser.close();
  }
  const pass = results.filter((r) => r.ok).length;
  writeFileSync(
    `${outDir}/results.json`,
    JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
  );
  process.stderr.write(`\n${pass}/${results.length} PASS — ${outDir}\n`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`[fatal] ${e?.stack ?? e}\n`);
  process.exit(2);
});
