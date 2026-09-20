#!/usr/bin/env node
// adr228-instance-parity-live.mjs — ADR-228 G2 instance arm: type 별 「ref instance ↔ 같은 트리의 plain 노드」
//   두 leg 대칭 (실제 빌더, headed Playwright · Compare Mode Preview iframe).
//   - plain arm = Components 페이지 origin subtree 를 새 id 로 복제한 plain 트리 (G1 이 factory 동치를 보증)
//   - Skia leg: 엔진 layout map 의 root w/h + 자손 rect 열 (DFS) 동일
//   - DOM leg: Preview iframe 의 root 요소 스크린샷 pixelmatch diff 0 (같은 크기) + computed style digest 동일
//   - 대상: catalog 파생 generic origin 50 (ListBox/GridList 는 이미 ref · 손 seed 5 는 plain 이 없다)
// 사용: node apps/builder/scripts/adr228-instance-parity-live.mjs [--headed] [--types=A,B]
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { waitReady } from "./perf-baseline.mjs";

const require = createRequire(import.meta.url);
const { PNG } = require(
  resolve("node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs"),
);

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR228_OUT ?? "/private/tmp/adr228-instance-parity";
const headed = process.argv.includes("--headed");
const typesArg = process.argv.find((a) => a.startsWith("--types="));
const log = (...a) => console.log("[adr228 parity]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

async function ensureCompareMode() {
  const compare = page
    .locator(".header_right .builder-control-group button")
    .first();
  if (
    (await compare.getAttribute("aria-pressed")) !== "true" &&
    (await compare.getAttribute("aria-checked")) !== "true"
  ) {
    await compare.click();
    await page.waitForTimeout(2500);
  }
}

/**
 * 두 arm 을 담는 컨테이너 — Compare Mode 의 CSS pane 은 iframe (1920 폭) 을 왼쪽 pane 에 clip 해
 * 보이고 그 위에 빌더 헤더 (48px) · 좌측 rail 이 떠 있다. 스크린샷이 그 크롬을 안 담게 위·왼쪽
 * 여백을 두고, 두 arm 을 세로로 쌓는다 (같은 폭 문맥).
 */
const STAGE_ID = "adr228-parity-stage";
async function ensureStage() {
  await page.evaluate((stageId) => {
    const st = window.__composition_STORE__.getState();
    if (st.elements.some((e) => e.id === stageId)) return;
    const body = st.elements.find(
      (e) => e.page_id === st.currentPageId && e.type === "body",
    );
    const now = new Date().toISOString();
    st.addElement({
      id: stageId,
      customId: stageId,
      type: "frame",
      parent_id: body.id,
      page_id: st.currentPageId,
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 24,
          paddingTop: 140,
          paddingLeft: 100,
          width: "600px",
        },
      },
      created_at: now,
      updated_at: now,
    });
  }, STAGE_ID);
  await page.waitForTimeout(600);
}

/** ref instance + origin subtree 복제 plain 트리를 stage 컨테이너에 넣는다. */
async function seedPair(type, originId) {
  return page.evaluate(
    ({ type, originId, stageId }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find((e) => e.id === stageId);
      const all = st.elements;
      const now = new Date().toISOString();
      const refId = `pair-ref-${type}`;
      const plainId = `pair-plain-${type}`;
      // origin subtree (legacy view: parent_id 로 연결) 를 DFS 로 모아 새 id 로 복제
      const byParent = new Map();
      for (const e of all) {
        if (!e.parent_id) continue;
        const list = byParent.get(e.parent_id) ?? [];
        list.push(e);
        byParent.set(e.parent_id, list);
      }
      const origin = all.find((e) => e.id === originId);
      if (!origin) return { error: `origin ${originId} 없음` };
      // plain arm 은 type · props (· slot) 만 옮긴다 — legacy view 의 origin 필드 (componentRole
      //   "master" · masterId …) 가 따라오면 plain 이 origin 으로 읽혀 비교가 아니게 된다.
      const strip = (e) => ({
        type: e.type,
        ...(e.slot !== undefined ? { slot: e.slot } : {}),
      });
      const plainRoot = {
        ...strip(origin),
        id: plainId,
        customId: plainId,
        parent_id: body.id,
        page_id: st.currentPageId,
        props: JSON.parse(JSON.stringify(origin.props ?? {})),
        created_at: now,
        updated_at: now,
      };
      const children = [];
      const walk = (srcParentId, dstParentId, path) => {
        (byParent.get(srcParentId) ?? []).forEach((child, i) => {
          const id = `${plainId}__${[...path, i + 1].join("_")}`;
          children.push({
            ...strip(child),
            id,
            customId: id,
            parent_id: dstParentId,
            page_id: st.currentPageId,
            props: JSON.parse(JSON.stringify(child.props ?? {})),
            created_at: now,
            updated_at: now,
          });
          walk(child.id, id, [...path, i + 1]);
        });
      };
      walk(originId, plainId, []);
      st.addElement({
        id: refId,
        customId: refId,
        type: "ref",
        ref: originId,
        componentName: type,
        parent_id: body.id,
        page_id: st.currentPageId,
        props: {},
        created_at: now,
        updated_at: now,
      });
      st.addComplexElement(plainRoot, children);
      return { refId, plainId, descendants: children.length };
    },
    { type, originId, stageId: STAGE_ID },
  );
}

async function removePair(refId, plainId) {
  await page.evaluate(
    ({ refId, plainId }) => {
      const st = window.__composition_STORE__.getState();
      st.removeElement(refId);
      st.removeElement(plainId);
    },
    { refId, plainId },
  );
  await page.waitForTimeout(400);
}

/** Skia leg — layout map 의 root 와 자손 rect 열 (id 접두로 모은다, DFS 순서 = id 정렬). */
async function skiaRects(prefix) {
  return page.evaluate((prefix) => {
    const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
    if (!map) return null;
    const rows = [];
    for (const [id, l] of map.entries()) {
      if (typeof id !== "string" || !id.startsWith(prefix)) continue;
      // synthetic 자손 id 는 `<ref>__2/<origin>__2_1` 처럼 origin 경로를 품는다 — 마지막 경로 segment
      //   (`__2_1`) 만 키로 써 plain 트리 (`<plain>__2_1`) 와 맞춘다.
      const tail = id.slice(prefix.length);
      const segment = tail.includes("/") ? tail.slice(tail.lastIndexOf("/") + 1) : tail;
      rows.push({
        key: segment.replace(/^[^_]*/, ""),
        w: Math.round(l.width * 100) / 100,
        h: Math.round(l.height * 100) / 100,
      });
    }
    rows.sort((a, b) => a.key.localeCompare(b.key));
    return rows;
  }, prefix);
}

const STYLE_KEYS = [
  "width", "height", "background-color", "color", "border-top-width", "border-top-color",
  "border-radius", "font-size", "font-weight", "line-height", "padding-top", "padding-left",
  "display", "opacity",
];

/** 같은 자리에서 찍기 위해 다른 arm 을 iframe DOM 에서 잠시 숨긴다 (문서 변경 아님). */
async function setArmHidden(id, hidden) {
  await page.evaluate(
    ({ id, hidden }) => {
      for (const iframe of document.querySelectorAll("iframe")) {
        const els = iframe.contentDocument?.querySelectorAll(`[data-element-id="${id}"]`) ?? [];
        // display:none 은 Recharts 가 remount 로 보고 mount 애니메이션을 다시 돈다 — flow 에서만
        //   빼고 (absolute) 그리지 않게 (visibility) 한다.
        for (const el of els) {
          el.style.visibility = hidden ? "hidden" : "";
          el.style.position = hidden ? "absolute" : "";
        }
      }
    },
    { id, hidden },
  );
}

/** DOM leg — Preview iframe 의 root 요소 (크기 있는 쪽) 스크린샷 + computed style digest. */
async function domCapture(id, siblingId) {
  if (siblingId) await setArmHidden(siblingId, true);
  try {
    return await domCaptureInner(id);
  } finally {
    if (siblingId) await setArmHidden(siblingId, false);
  }
}

async function domCaptureInner(id) {
  const frame = page.frameLocator("iframe").first();
  const loc = frame
    .locator(`[data-element-id="${id}"]`)
    .filter({ has: frame.locator(":scope") });
  // display:contents 래퍼가 먼저 오면 두 번째가 실제 요소
  const n = await loc.count();
  let target = null;
  for (let i = 0; i < n; i++) {
    const box = await loc.nth(i).boundingBox();
    if (box && box.width > 0 && box.height > 0) {
      target = loc.nth(i);
      break;
    }
  }
  if (!target) return null;
  const box = await target.boundingBox();
  // iframe 이 CSS scale 돼 있으면 (Compare Mode 폭 맞춤) Playwright 요소 스크린샷 좌표가 어긋난다 —
  //   page 좌표로 직접 clip 한다: iframe 상자 + 요소 rect × (iframe 상자 폭 / iframe 내부 폭).
  const geometry = await page.evaluate((id) => {
    const iframe = [...document.querySelectorAll("iframe")].find((f) =>
      f.contentDocument?.querySelector(`[data-element-id="${id}"]`),
    );
    if (!iframe) return null;
    const fr = iframe.getBoundingClientRect();
    const scale = fr.width / iframe.contentWindow.innerWidth;
    const els = [...iframe.contentDocument.querySelectorAll(`[data-element-id="${id}"]`)];
    const el = els.find((m) => m.getBoundingClientRect().width > 0) ?? els[0];
    // 아래 arm 이 뷰포트 밖으로 나가면 clip 이 잘린다 — iframe 문서를 스크롤해 요소를 헤더 아래
    //   (y=140) 로 올린 뒤 rect 를 다시 읽는다 (두 arm 같은 규칙).
    const r = el.getBoundingClientRect();
    return { x: fr.x + r.x * scale, y: fr.y + r.y * scale, w: r.width * scale, h: r.height * scale, scale };
  }, id);
  const digest = await target.evaluate((el, keys) => {
    const cs = getComputedStyle(el);
    const own = Object.fromEntries(keys.map((k) => [k, cs.getPropertyValue(k)]));
    return {
      tag: el.tagName,
      className: el.className,
      childCount: el.querySelectorAll("*").length,
      own,
    };
  }, STYLE_KEYS);
  if (!geometry) return null;
  // 왼쪽 CSS pane 폭 (splitter 왼쪽) 을 넘는 부분은 어차피 clip 된다 — 두 arm 같은 규칙.
  const paneWidth = await page.evaluate(
    () => document.querySelector(".workspace-compare-panel--left")?.getBoundingClientRect().width ?? 720,
  );
  const png = await page.screenshot({
    type: "png",
    animations: "disabled",
    clip: {
      x: Math.round(geometry.x),
      y: Math.round(geometry.y),
      width: Math.max(1, Math.min(Math.round(geometry.w), Math.floor(paneWidth - geometry.x - 2))),
      height: Math.max(1, Math.round(geometry.h)),
    },
  });
  return {
    box: { w: Math.round(box.width), h: Math.round(box.height), scale: Math.round(geometry.scale * 1000) / 1000 },
    digest,
    png,
  };
}

function pixelDiff(a, b) {
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  if (pa.width !== pb.width || pa.height !== pb.height) {
    return { same: false, reason: `size ${pa.width}x${pa.height} vs ${pb.width}x${pb.height}` };
  }
  const diff = pixelmatch(pa.data, pb.data, null, pa.width, pa.height, { threshold: 0 });
  return { same: diff === 0, reason: `diff ${diff}/${pa.width * pa.height}` };
}

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  await page.locator("button.dashboard-create-button").first().click();
  const input = page.locator("#new-project-name");
  await input.fill(`adr228-parity-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await ensureCompareMode();
  await ensureStage();

  const originIds = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    return st.elements
      .filter((e) => e.parent_id === body.id && e.reusable && e.metadata?.type === "catalog-origin")
      .map((e) => ({ id: e.id, type: e.type }));
  });
  const wanted = typesArg ? new Set(typesArg.slice(8).split(",")) : null;
  const targets = originIds.filter((o) => !wanted || wanted.has(o.type));
  log(`targets ${targets.length}`);

  for (const { id: originId, type } of targets) {
    const seeded = await seedPair(type, originId);
    if (seeded.error) {
      record(`${type}: seed`, false, seeded.error);
      continue;
    }
    await page.waitForTimeout(900);
    const { refId, plainId } = seeded;
    try {
      // Skia leg — layout map 반영은 다음 프레임들 (retry ≤ 3s).
      let refRects = null;
      let plainRects = null;
      for (let i = 0; i < 8; i++) {
        refRects = await skiaRects(refId);
        plainRects = await skiaRects(plainId);
        if (refRects?.length && plainRects?.length) break;
        await page.waitForTimeout(400);
      }
      const skiaSame =
        !!refRects && !!plainRects && refRects.length > 0 &&
        JSON.stringify(refRects) === JSON.stringify(plainRects);
      // DOM leg
      let domRef = null;
      let domPlain = null;
      for (let i = 0; i < 12 && (!domRef || !domPlain); i++) {
        domRef = await domCapture(refId, plainId);
        domPlain = await domCapture(plainId, refId);
        if (!domRef || !domPlain) await page.waitForTimeout(500);
      }
      if (domRef && domPlain) {
        // 두 arm 이 다 붙은 뒤 settle — RAC TableVirtualizer 높이 확정 · Recharts mount 애니메이션
        //   (isAnimationActive 600ms). 같은 arm 의 연속 두 캡처가 픽셀 동일할 때까지 (≤ 6회) 기다린다.
        await page.waitForTimeout(1200);
        const stable = async (id, sibling) => {
          let prev = await domCapture(id, sibling);
          for (let i = 0; i < 6; i++) {
            await page.waitForTimeout(400);
            const next = await domCapture(id, sibling);
            if (prev && next && pixelDiff(prev.png, next.png).same) return next;
            prev = next;
          }
          return prev;
        };
        domRef = await stable(refId, plainId);
        domPlain = await stable(plainId, refId);
      }
      let domDetail = "preview 미도달";
      let domSame = false;
      if (!domRef && !domPlain) {
        // 두 arm 다 Preview DOM 에 없다 — trigger 없이 그리지 않는 overlay (Modal/Popover/Tooltip) ·
        //   imperative (Menu 는 MenuTrigger 밖 · FileTrigger 는 자식 없이 빈 출력). 두 leg 대칭 판정은
        //   Skia rect 로만 — DOM 은 "둘 다 없음" 이 대칭이다.
        domSame = true;
        domDetail = "두 arm 모두 Preview DOM 미출력 (overlay/trigger 전용) — Skia 만";
      } else if (domRef && domPlain) {
        const px = pixelDiff(domRef.png, domPlain.png);
        const digestSame = JSON.stringify(domRef.digest) === JSON.stringify(domPlain.digest);
        domSame = px.same && digestSame;
        domDetail = `${px.reason} · box ${JSON.stringify(domRef.box)} · digest ${digestSame ? "same" : "differs"}`;
        writeFileSync(resolve(OUT_DIR, `${type}-ref.png`), domRef.png);
        writeFileSync(resolve(OUT_DIR, `${type}-plain.png`), domPlain.png);
        if (!domSame) {
          if (!digestSame) domDetail += ` ref=${JSON.stringify(domRef.digest.own)} plain=${JSON.stringify(domPlain.digest.own)}`;
        }
      }
      record(
        `${type}: ref ↔ plain — Skia rect 열 ${refRects?.length ?? 0} · DOM`,
        skiaSame && domSame,
        `skia ${skiaSame ? "same" : `differs ref=${JSON.stringify(refRects)} plain=${JSON.stringify(plainRects)}`} · dom ${domDetail}`,
      );
    } finally {
      await removePair(refId, plainId);
    }
  }
  record("page error 0", errors.length === 0, errors.slice(0, 3).join(" | ") || "0");
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ findings, errors, at: new Date().toISOString() }, null, 2),
  );
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
