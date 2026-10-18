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
 * - ADR-272 Phase 2 — 준비 비용을 문서 크기가 아니라 화면 · 남은 자리에 묶는다:
 *   - 후보는 page root ∪ 공간 질의 (`warmupRect` — 최소 줌에서 보일 넓이의 2 배) 결과다. 인덱스가 없거나
 *     사각형 안의 기록 가능한 후보가 남은 자리보다 적으면 stream 전체를 훑는다 (`warmCandidatesLinear`). Phase 0 실측: 100 페이지 편집마다 21,746 개를 훑고
 *     17,457 개를 정렬한 뒤 캐시가 차 있어 1 개도 기록하지 않았다 (9 ms · 300 페이지 28 ms).
 *   - 남은 자리가 0 이면 후보를 모으지 않는다. 있으면 기록할 수 있는 후보만 남겨 (`isNodePictureWarmable`)
 *     가까운 k 개 (k = 남은 자리) 만 정렬하고 나머지는 뒤에 둔다 (기록이 `false` 면 보충).
 *   - 차례 키에 카메라 칸 (`warmupCameraKey`) 을 넣는다 — 같은 stream 이어도 먼 페이지로 옮기면 새 주변부터.
 * - 한 번에 idle 남은 시간만큼 (`timeRemaining() > 1 ms`) — 프레임을 막지 않는다.
 * - 하니스 `--fixed-inputs` 는 idle 시각이 카운트를 흔들지 않게 `manual` 로 두고 창 밖에서 `flush` 한다.
 */
import type { CanvasKit, FontMgr } from "canvaskit-wasm";

import {
  createCommandReader,
  isNodePictureWarmable,
  type RenderCommandStream,
  warmNodePicture,
} from "./renderCommands";
import {
  ensureNodePictureFontGeneration,
  getNodePictureWarmRoom,
  hasNodePictureWarmRoom,
  isNodePictureCacheEnabled,
} from "./nodePictureCache";
import { renderCounters, renderDebug } from "./renderCounters";
import { registerSkiaCacheDestroy } from "./disposable";
import { WASM_FLAGS } from "../wasm-bindings/featureFlags";
import * as spatialIndex from "../wasm-bindings/spatialIndex";

const CMD_ELEMENT_BEGIN = 0;

/** 빌더 최소 줌 (`CatalogCanvas` `minZoom={0.1}` · `ViewportController` 기본값). */
const WARMUP_MIN_ZOOM = 0.1;
/** 후보 사각형 = 최소 줌의 culling 넓이 × 이 배수 (가로세로 각각) — 줌 기준점이 화면 가장자리여도 덮는다. */
const WARMUP_REACH = 2;
/** 카메라 칸 = 후보 사각형 ÷ 이 수 — 중심이 칸을 넘으면 차례를 다시 세운다 (최소 줌 화면이 사각형 안에 남는다). */
const WARMUP_CAMERA_CELLS = 4;

interface WarmupSource {
  ck: CanvasKit;
  stream: RenderCommandStream;
  viewport: DOMRect;
  fontMgr: () => FontMgr | undefined;
  rootIds: readonly string[];
  cameraKey: string;
}

interface WarmupPass {
  stream: RenderCommandStream;
  revision: number;
  cameraKey: string;
  ids: string[];
  cursor: number;
}

type WarmupRect = Pick<DOMRect, "x" | "y" | "width" | "height">;

interface IdleDeadlineLike {
  timeRemaining(): number;
}

let source: WarmupSource | null = null;
let pass: WarmupPass | null = null;
let handle: number | null = null;
let manual = false;
let cameraZoom = 1;

/**
 * content full 기록 뒤 (`CatalogCanvasScene.contentNode`) — 지금 stream · 화면으로 다음 idle 에 미리 기록한다.
 * 같은 stream · revision · 카메라 칸의 차례가 이미 끝났으면 아무것도 하지 않는다.
 */
export function requestNodePictureWarmup(
  ck: CanvasKit,
  stream: RenderCommandStream,
  viewport: DOMRect,
  fontMgr: () => FontMgr | undefined,
  rootIds: readonly string[] = [],
): void {
  const cameraKey = warmupCameraKey(viewport, cameraZoom);
  source = { ck, stream, viewport, fontMgr, rootIds, cameraKey };
  if (manual || handle !== null || isPassDone(stream, cameraKey)) return;
  if (typeof requestIdleCallback !== "function") return;
  handle = requestIdleCallback(runIdle);
}

/** renderer 가 content full 기록 직전에 그 배율을 준다 (후보 사각형 · 카메라 칸이 쓴다). */
export function setNodePictureWarmupZoom(zoom: number): void {
  cameraZoom = zoom;
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
    pass.revision !== input.stream.presentationRevision ||
    pass.cameraKey !== input.cameraKey
  ) {
    pass = {
      stream: input.stream,
      revision: input.stream.presentationRevision,
      cameraKey: input.cameraKey,
      ids: warmupOrder(input),
      cursor: 0,
    };
    if (process.env.NODE_ENV === "development")
      renderCounters.warmPassRebuilt += 1;
  }
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
  cameraZoom = 1;
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

function isPassDone(stream: RenderCommandStream, cameraKey: string): boolean {
  return (
    pass !== null &&
    pass.stream === stream &&
    pass.revision === stream.presentationRevision &&
    pass.cameraKey === cameraKey &&
    pass.cursor >= pass.ids.length
  );
}

/**
 * 후보 사각형 — 화면 가운데를 중심으로 최소 줌의 culling 넓이 × `WARMUP_REACH`. culling 넓이는 배율에 반비례하므로
 * 배율과 무관한 world 넓이가 된다 (화면 크기 · 여백만 따른다) — 문서가 커져도 후보 수가 늘지 않는다.
 */
export function warmupRect(viewport: WarmupRect, zoom: number): WarmupRect {
  const scale = WARMUP_REACH * Math.max(1, zoom / WARMUP_MIN_ZOOM);
  const width = viewport.width * scale;
  const height = viewport.height * scale;
  return {
    x: viewport.x + (viewport.width - width) / 2,
    y: viewport.y + (viewport.height - height) / 2,
    width,
    height,
  };
}

/** 카메라 칸 — 화면 가운데를 후보 사각형 ÷ `WARMUP_CAMERA_CELLS` 크기의 칸으로 양자화한다. */
export function warmupCameraKey(viewport: WarmupRect, zoom: number): string {
  const rect = warmupRect(viewport, zoom);
  const cellW = rect.width / WARMUP_CAMERA_CELLS;
  const cellH = rect.height / WARMUP_CAMERA_CELLS;
  if (!(cellW > 0) || !(cellH > 0)) return "";
  const cx = viewport.x + viewport.width / 2;
  const cy = viewport.y + viewport.height / 2;
  return `${Math.floor(cx / cellW)}:${Math.floor(cy / cellH)}:${Math.round(Math.log2(cellW))}`;
}

/**
 * 이번 차례의 순서 — 기록할 수 있는 후보 중 화면 가운데에서 가까운 k 개 (k = 남은 자리) 가 앞에 정렬되고,
 * 나머지는 정렬 없이 뒤에 남는다 (기록이 `false` 면 이어서 보충).
 */
function warmupOrder(input: WarmupSource): string[] {
  const room = getNodePictureWarmRoom();
  if (room <= 0) return [];
  const { stream, viewport } = input;
  const bounded = collectBoundedCandidates(
    stream,
    warmupRect(viewport, cameraZoom),
    input.rootIds,
    room,
  )?.filter((id) => isNodePictureWarmable(stream, id));
  // 사각형이 남은 자리를 다 못 채우면 stream 전체로 보충한다 — 줌아웃은 page grid 를 다시 배치해 (auto
  // columns) 지금 배치에서 먼 페이지를 화면에 데려온다. 자리가 있는 동안의 ADR-266 보장 (처음 줌아웃 프레임은
  // 재생만) 은 전체 순회가 지킨다 (`app-pages` 줌: 사각형만이면 줌 프레임 기록 0 → 380).
  const ids =
    bounded && bounded.length >= room
      ? bounded
      : collectLinearCandidates(stream).filter((id) =>
          isNodePictureWarmable(stream, id),
        );
  const cx = viewport.x + viewport.width / 2;
  const cy = viewport.y + viewport.height / 2;
  const distance = new Map<string, number>();
  for (const id of ids) {
    const box = stream.boundsMap.get(id);
    distance.set(
      id,
      box
        ? Math.hypot(box.x + box.width / 2 - cx, box.y + box.height / 2 - cy)
        : Number.POSITIVE_INFINITY,
    );
  }
  const k = Math.min(room, ids.length);
  selectNearest(ids, distance, k);
  if (process.env.NODE_ENV === "development")
    renderCounters.warmCandidatesSorted += k;
  return ids;
}

/**
 * page root (공간 인덱스는 hit bounds 라 없을 수 있다 — viewport 실행도 따로 싣는다) ∪ 사각형 질의 결과 중
 * self span 이 있고 안 보이는 조상이 없는 요소. 인덱스가 없거나 롤백 플래그면 null (전체 순회로). 질의 결과가
 * 남은 자리보다 적어도 null — 어차피 전체 순회로 보충하므로 선별을 두 번 하지 않는다.
 */
function collectBoundedCandidates(
  stream: RenderCommandStream,
  rect: WarmupRect,
  rootIds: readonly string[],
  room: number,
): string[] | null {
  if (process.env.NODE_ENV === "development" && renderDebug.warmupBoundedOff)
    return null;
  if (!WASM_FLAGS.SPATIAL_INDEX || !spatialIndex.getSpatialIndex()) return null;
  const hits = spatialIndex.queryRect(
    rect.x,
    rect.y,
    rect.x + rect.width,
    rect.y + rect.height,
  );
  if (hits.length + rootIds.length < room) return null;
  const at = createCommandReader(stream.commands);
  const hidden = new Map<string, boolean>();
  const isHidden = (id: string): boolean => {
    const known = hidden.get(id);
    if (known !== undefined) return known;
    const start = stream.subtreeSpans.get(id)?.start;
    const begin = start === undefined ? undefined : at(start);
    const parent = stream.subtreeBuildContextByElement.get(id)?.parentElementId;
    const result =
      (begin?.type === CMD_ELEMENT_BEGIN && !begin.visible) ||
      (parent ? isHidden(parent) : false);
    hidden.set(id, result);
    return result;
  };
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const list of [rootIds, hits]) {
    for (const id of list) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (process.env.NODE_ENV === "development")
        renderCounters.warmCandidatesScanned += 1;
      if (stream.selfSpans.has(id) && !isHidden(id)) ids.push(id);
    }
  }
  return ids;
}

/**
 * picture 를 가진 (self span 이 있는) 보이는 요소 — stream 순서. 안 보이는 서브트리는 그 subtree 끝으로
 * 건너뛴다 (프레임도 그 안을 기록하지 않는다).
 */
function collectLinearCandidates(stream: RenderCommandStream): string[] {
  if (process.env.NODE_ENV === "development")
    renderCounters.warmCandidatesLinear += 1;
  const at = createCommandReader(stream.commands);
  const ids: string[] = [];
  for (let index = 0; index < stream.commands.length; index += 1) {
    const command = at(index);
    if (command?.type !== CMD_ELEMENT_BEGIN || !command.elementId) continue;
    if (process.env.NODE_ENV === "development")
      renderCounters.warmCandidatesScanned += 1;
    if (!command.visible) {
      const end = stream.subtreeSpans.get(command.elementId)?.end;
      if (end !== undefined) index = end - 1;
      continue;
    }
    if (stream.selfSpans.has(command.elementId)) ids.push(command.elementId);
  }
  return ids;
}

/** 가까운 k 개를 앞으로 모아 (quickselect) 그 k 개만 정렬한다 — 나머지는 버리지 않고 뒤에 둔다. */
function selectNearest(
  ids: string[],
  distance: ReadonlyMap<string, number>,
  k: number,
): void {
  if (k <= 0) return;
  const d = (i: number) => distance.get(ids[i])!;
  const swap = (a: number, b: number) => {
    const t = ids[a];
    ids[a] = ids[b];
    ids[b] = t;
  };
  let lo = 0;
  let hi = ids.length - 1;
  while (k < ids.length && lo < hi) {
    const pivot = d((lo + hi) >>> 1);
    let i = lo;
    let j = hi;
    while (i <= j) {
      while (d(i) < pivot) i += 1;
      while (d(j) > pivot) j -= 1;
      if (i <= j) swap(i++, j--);
    }
    if (k - 1 <= j) hi = j;
    else if (k - 1 >= i) lo = i;
    else break;
  }
  const head = ids.slice(0, k).sort((a, b) => distance.get(a)! - distance.get(b)!);
  for (let i = 0; i < k; i += 1) ids[i] = head[i];
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
