/**
 * ADR-266 Phase 4 (사용자 결정 2 「idle 미리 기록」, 2026-10-17) — 화면 밖 요소의 picture 를 쉬는 시간에 미리 기록한다.
 *
 * 처음 줌아웃하면 화면에 처음 들어오는 요소를 그 프레임에서 기록한다 (`app-pages` dev: 3 프레임 · picture
 * 148 / 629 / 721 · 글자 118 / 472 / 478 · 50 ~ 67 ms — 그 뒤 줌은 모든 프레임 16.7 ms). picture 는 위치와 무관한
 * 노드-로컬 기록이라 (키 = `dataRef` · width · height), 같은 기록을 프레임 밖 idle 에 미리 해 두면 그 프레임은
 * 재생만 한다. 화면 변화 없음 — 글자 paragraph 도 같은 기록이 만든다 (노드 소유, ADR-174).
 *
 * - 순서: 지금 화면 가운데에서 가까운 요소부터. 안 보이는 (`visible: false`) 서브트리는 건너뛴다.
 * - 상한: `MAX_WARM_NODE_PICTURES` · 바이트 상한의 90 % — 퇴거를 일으키지 않는 범위만. 상한에 닿은 차례는
 *   거기서 끝낸다 (다음 차례는 stream 이 바뀔 때 — 퇴거 ↔ 재기록 반복을 막는다).
 * - 한 번에 idle 남은 시간만큼 (`timeRemaining() > 1 ms`) — 프레임을 막지 않는다.
 * - 하니스 `--fixed-inputs` 는 idle 시각이 카운트를 흔들지 않게 `manual` 로 두고 창 밖에서 `flush` 한다.
 */
import type { CanvasKit, FontMgr } from "canvaskit-wasm";

import {
  createCommandReader,
  type RenderCommandStream,
  warmNodePicture,
} from "./renderCommands";
import {
  ensureNodePictureFontGeneration,
  hasNodePictureWarmRoom,
  isNodePictureCacheEnabled,
} from "./nodePictureCache";
import { renderCounters } from "./renderCounters";
import { registerSkiaCacheDestroy } from "./disposable";

const CMD_ELEMENT_BEGIN = 0;

interface WarmupSource {
  ck: CanvasKit;
  stream: RenderCommandStream;
  viewport: DOMRect;
  fontMgr: () => FontMgr | undefined;
}

interface WarmupPass {
  stream: RenderCommandStream;
  revision: number;
  ids: string[];
  cursor: number;
}

interface IdleDeadlineLike {
  timeRemaining(): number;
}

let source: WarmupSource | null = null;
let pass: WarmupPass | null = null;
let handle: number | null = null;
let manual = false;

/**
 * content full 기록 뒤 (`CatalogCanvasScene.contentNode`) — 지금 stream · 화면으로 다음 idle 에 미리 기록한다.
 * 같은 stream · revision 의 차례가 이미 끝났으면 아무것도 하지 않는다.
 */
export function requestNodePictureWarmup(
  ck: CanvasKit,
  stream: RenderCommandStream,
  viewport: DOMRect,
  fontMgr: () => FontMgr | undefined,
): void {
  source = { ck, stream, viewport, fontMgr };
  if (manual || handle !== null || isPassDone(stream)) return;
  if (typeof requestIdleCallback !== "function") return;
  handle = requestIdleCallback(runIdle);
}

/**
 * 미리 기록 한 묶음 — `more()` 가 false 가 되거나 차례가 끝날 때까지. true = 이 stream 의 차례가 끝났다.
 */
export function warmNodePictures(more: () => boolean): boolean {
  const input = source;
  if (!input || !isNodePictureCacheEnabled()) return true;
  const fontMgr = input.fontMgr();
  // fontMgr 전 기록은 글자가 빠진다 — 폰트가 오면 어차피 전량 폐기된다
  if (!fontMgr) return true;
  ensureNodePictureFontGeneration(fontMgr);
  if (
    !pass ||
    pass.stream !== input.stream ||
    pass.revision !== input.stream.presentationRevision
  )
    pass = {
      stream: input.stream,
      revision: input.stream.presentationRevision,
      ids: warmupOrder(input.stream, input.viewport),
      cursor: 0,
    };
  const current = pass;
  while (current.cursor < current.ids.length) {
    if (!hasNodePictureWarmRoom()) {
      current.cursor = current.ids.length;
      break;
    }
    if (!more()) return false;
    const id = current.ids[current.cursor];
    current.cursor += 1;
    if (
      warmNodePicture(input.ck, input.stream, id, fontMgr) &&
      process.env.NODE_ENV === "development"
    )
      renderCounters.pictureWarmRecorded += 1;
  }
  return true;
}

/** 하니스 (`--fixed-inputs`): idle 예약을 멈추고 (`manual`) 창 밖에서 한 번에 끝까지 기록한다. */
export function setNodePictureWarmupManual(on: boolean): void {
  manual = on;
  if (on) cancelIdle();
}

export function flushNodePictureWarmup(): void {
  warmNodePictures(() => true);
}

/** 캔버스 teardown · 테스트. */
export function resetNodePictureWarmup(): void {
  cancelIdle();
  source = null;
  pass = null;
}

function runIdle(deadline: IdleDeadlineLike): void {
  handle = null;
  if (manual) return;
  if (!warmNodePictures(() => deadline.timeRemaining() > 1))
    handle = requestIdleCallback(runIdle);
}

function cancelIdle(): void {
  if (handle !== null && typeof cancelIdleCallback === "function")
    cancelIdleCallback(handle);
  handle = null;
}

function isPassDone(stream: RenderCommandStream): boolean {
  return (
    pass !== null &&
    pass.stream === stream &&
    pass.revision === stream.presentationRevision &&
    pass.cursor >= pass.ids.length
  );
}

/**
 * picture 를 가진 (self span 이 있는) 보이는 요소 — 화면 가운데에서 가까운 순서. 안 보이는 서브트리는
 * 그 subtree 끝으로 건너뛴다 (프레임도 그 안을 기록하지 않는다).
 */
function warmupOrder(stream: RenderCommandStream, viewport: DOMRect): string[] {
  const at = createCommandReader(stream.commands);
  const cx = viewport.x + viewport.width / 2;
  const cy = viewport.y + viewport.height / 2;
  const ids: string[] = [];
  const distance = new Map<string, number>();
  for (let index = 0; index < stream.commands.length; index += 1) {
    const command = at(index);
    if (command?.type !== CMD_ELEMENT_BEGIN || !command.elementId) continue;
    if (!command.visible) {
      const end = stream.subtreeSpans.get(command.elementId)?.end;
      if (end !== undefined) index = end - 1;
      continue;
    }
    if (!stream.selfSpans.has(command.elementId)) continue;
    const box = stream.boundsMap.get(command.elementId);
    ids.push(command.elementId);
    distance.set(
      command.elementId,
      box
        ? Math.hypot(box.x + box.width / 2 - cx, box.y + box.height / 2 - cy)
        : Number.POSITIVE_INFINITY,
    );
  }
  return ids.sort((a, b) => distance.get(a)! - distance.get(b)!);
}

// 캔버스 teardown — 붙잡은 stream · CanvasKit 을 놓는다
registerSkiaCacheDestroy("nodePictureWarmup", resetNodePictureWarmup);

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  const debug = ((
    window as unknown as Record<string, unknown>
  ).__composition_RENDER_PATH_DEBUG__ ??= {}) as Record<string, unknown>;
  debug.setWarmupManual = setNodePictureWarmupManual;
  debug.flushWarmup = flushNodePictureWarmup;
}
