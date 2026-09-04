/**
 * Binary Protocol Encoder for WASM Taffy Layout
 *
 * 스타일 데이터를 JSON.stringify 대신 바이너리 포맷으로 인코딩하여
 * WASM 경계 비용을 최소화한다.
 *
 * 포맷 규격은 Rust 측 binary_protocol.rs와 1:1 매칭해야 한다.
 *
 * @see wasm/src/binary_protocol.rs
 * @since 2026-02-28
 */

// ─── 공개 타입 ────────────────────────────────────────────────────────

/**
 * 바이너리 인코딩을 위한 노드 입력.
 * fullTreeLayout.ts의 engineStyleToRecord() 출력을 직접 수신한다.
 */
export interface BinaryBatchInput {
  style: Record<string, unknown>;
  children: number[];
}

// ─── 매직 바이트 / 버전 상수 ─────────────────────────────────────────

const MAGIC = [0x54, 0x41, 0x46, 0x46] as const; // "TAFF"
const VERSION = 1;

// ─── 필드 ID 매핑 ────────────────────────────────────────────────────

/**
 * Record 키 → 필드 비트 위치 매핑.
 * Grid 배열 필드(gridTemplateColumns 등)는 JSON 사이드밴드로 처리하므로 제외.
 */
const FIELD_MAP: Record<string, number> = {
  display: 0,
  position: 1,
  overflowX: 2,
  overflowY: 3,
  flexDirection: 4,
  flexWrap: 5,
  justifyContent: 6,
  justifyItems: 7,
  alignItems: 8,
  alignContent: 9,
  alignSelf: 10,
  justifySelf: 11,
  gridAutoFlow: 12,
  flexGrow: 13,
  flexShrink: 14,
  aspectRatio: 15,
  width: 16,
  height: 17,
  minWidth: 18,
  minHeight: 19,
  maxWidth: 20,
  maxHeight: 21,
  flexBasis: 22,
  marginTop: 23,
  marginRight: 24,
  marginBottom: 25,
  marginLeft: 26,
  insetTop: 27,
  insetRight: 28,
  insetBottom: 29,
  insetLeft: 30,
  paddingTop: 31,
  paddingRight: 32,
  paddingBottom: 33,
  paddingLeft: 34,
  borderTop: 35,
  borderRight: 36,
  borderBottom: 37,
  borderLeft: 38,
  columnGap: 39,
  rowGap: 40,
  gridColumnStart: 41,
  gridColumnEnd: 42,
  gridRowStart: 43,
  gridRowEnd: 44,
  // ⚠ ADR-165 측정 스칼라(contentMinWidth/contentMaxWidth) 와 ADR-204 세로축 스칼라
  // (contentMinHeight) 는 **비등재** — 본 인코더의
  // 타입 범위(enum 0~12 / f32 13~15 / dim 16~22 / LPA 23~30 / LP 31~40 / grid 41~44)에
  // 신규 f32 범위 확장이 필요해, Rust 디코더 부재(hasBinaryProtocol=false) 상태에선
  // dead 확장이다. binary protocol 을 실구현하는 시점에 f32 범위로 반드시 편입할 것 —
  // 누락 시 스칼라가 silent drop 되어 intrinsic sizing 이 회귀한다 (JSON 경로는 무관).
};

/** JSON 사이드밴드로 처리하는 Grid 배열 필드 집합 */
const GRID_SIDEBAND_KEYS = new Set([
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridAutoColumns",
  "gridAutoRows",
]);

// ─── 필드 범위 상수 ───────────────────────────────────────────────────

/** Enum 필드: 비트 0~12 (1바이트 u8) */
const ENUM_BIT_MIN = 0;
const ENUM_BIT_MAX = 12;

/** f32 direct 필드: 비트 13~15 (4바이트 f32 LE) */
const F32_BIT_MIN = 13;
const F32_BIT_MAX = 15;

/** Dimension 필드: 비트 16~22 (5바이트: u8 type + f32 LE) */
const DIM_BIT_MIN = 16;
const DIM_BIT_MAX = 22;

/** LPA(LengthPercentageAuto) 필드: 비트 23~30 (5바이트: u8 type + f32 LE) */
const LPA_BIT_MIN = 23;
const LPA_BIT_MAX = 30;

/** LP(LengthPercentage) 필드: 비트 31~40 (5바이트: u8 type + f32 LE) */
const LP_BIT_MIN = 31;
const LP_BIT_MAX = 40;

/** Grid placement 필드: 비트 41~44 (3바이트: u8 type + i16 LE) */
const GRID_PLACE_BIT_MIN = 41;
const GRID_PLACE_BIT_MAX = 44;

// ─── Dimension/LP/LPA type 상수 ────────────────────────────────────────

const TAG_AUTO = 0;
const TAG_LENGTH = 1;
const TAG_PERCENT = 2;

// ─── Grid placement type 상수 ─────────────────────────────────────────

const GP_AUTO = 0;
const GP_LINE = 1;
const GP_SPAN = 2;

// ─── 필드 바이트 크기 ─────────────────────────────────────────────────

/**
 * 비트 위치에 해당하는 필드의 바이트 크기를 반환한다.
 *
 * - Enum  (0~12):  1바이트
 * - f32   (13~15): 4바이트
 * - Dim   (16~22): 5바이트 (type u8 + value f32)
 * - LPA   (23~30): 5바이트 (type u8 + value f32)
 * - LP    (31~40): 5바이트 (type u8 + value f32)
 * - Grid  (41~44): 3바이트 (type u8 + value i16)
 */
function fieldSizeForBit(bit: number): number {
  if (bit >= ENUM_BIT_MIN && bit <= ENUM_BIT_MAX) return 1;
  if (bit >= F32_BIT_MIN && bit <= F32_BIT_MAX) return 4;
  if (bit >= DIM_BIT_MIN && bit <= DIM_BIT_MAX) return 5;
  if (bit >= LPA_BIT_MIN && bit <= LPA_BIT_MAX) return 5;
  if (bit >= LP_BIT_MIN && bit <= LP_BIT_MAX) return 5;
  if (bit >= GRID_PLACE_BIT_MIN && bit <= GRID_PLACE_BIT_MAX) return 3;
  return 0;
}

// ─── Enum 인코딩 테이블 ───────────────────────────────────────────────

/** display 값 → u8 */
const DISPLAY_MAP: Record<string, number> = {
  flex: 0,
  grid: 1,
  block: 2,
  none: 3,
};

/** position 값 → u8 */
const POSITION_MAP: Record<string, number> = {
  relative: 0,
  absolute: 1,
};

/** overflow 값 → u8 (overflowX, overflowY 공용) */
const OVERFLOW_MAP: Record<string, number> = {
  visible: 0,
  hidden: 1,
  clip: 2,
  scroll: 3,
};

/** flexDirection 값 → u8 */
const FLEX_DIRECTION_MAP: Record<string, number> = {
  row: 0,
  column: 1,
  "row-reverse": 2,
  "column-reverse": 3,
};

/** flexWrap 값 → u8 */
const FLEX_WRAP_MAP: Record<string, number> = {
  nowrap: 0,
  wrap: 1,
  "wrap-reverse": 2,
};

/** justifyContent 값 → u8 */
const JUSTIFY_CONTENT_MAP: Record<string, number> = {
  "flex-start": 0,
  start: 0,
  "flex-end": 1,
  end: 1,
  center: 2,
  "space-between": 3,
  "space-around": 4,
  "space-evenly": 5,
  stretch: 6,
};

/** justifyItems 값 → u8 */
const JUSTIFY_ITEMS_MAP: Record<string, number> = {
  "flex-start": 0,
  start: 0,
  "flex-end": 1,
  end: 1,
  center: 2,
  stretch: 3,
  baseline: 4,
};

/** alignItems 값 → u8 (justifyItems와 동일 매핑) */
const ALIGN_ITEMS_MAP: Record<string, number> = JUSTIFY_ITEMS_MAP;

/** alignContent 값 → u8 */
const ALIGN_CONTENT_MAP: Record<string, number> = {
  "flex-start": 0,
  start: 0,
  "flex-end": 1,
  end: 1,
  center: 2,
  stretch: 3,
  "space-between": 4,
  "space-around": 5,
  "space-evenly": 6,
};

/** alignSelf 값 → u8 */
const ALIGN_SELF_MAP: Record<string, number> = {
  auto: 0,
  "flex-start": 1,
  start: 1,
  "flex-end": 2,
  end: 2,
  center: 3,
  stretch: 4,
  baseline: 5,
};

/** justifySelf 값 → u8 (alignSelf와 동일 매핑) */
const JUSTIFY_SELF_MAP: Record<string, number> = ALIGN_SELF_MAP;

/** gridAutoFlow 값 → u8 */
const GRID_AUTO_FLOW_MAP: Record<string, number> = {
  row: 0,
  column: 1,
  "row-dense": 2,
  "row dense": 2,
  "column-dense": 3,
  "column dense": 3,
};

/**
 * 비트 위치에 맞는 enum 매핑 테이블을 반환한다.
 * 해당 비트가 enum 필드가 아니거나 테이블이 없으면 null 반환.
 */
function getEnumMap(bit: number): Record<string, number> | null {
  switch (bit) {
    case 0:
      return DISPLAY_MAP;
    case 1:
      return POSITION_MAP;
    case 2:
      return OVERFLOW_MAP;
    case 3:
      return OVERFLOW_MAP;
    case 4:
      return FLEX_DIRECTION_MAP;
    case 5:
      return FLEX_WRAP_MAP;
    case 6:
      return JUSTIFY_CONTENT_MAP;
    case 7:
      return JUSTIFY_ITEMS_MAP;
    case 8:
      return ALIGN_ITEMS_MAP;
    case 9:
      return ALIGN_CONTENT_MAP;
    case 10:
      return ALIGN_SELF_MAP;
    case 11:
      return JUSTIFY_SELF_MAP;
    case 12:
      return GRID_AUTO_FLOW_MAP;
    default:
      return null;
  }
}

// ─── Dimension 파싱 ──────────────────────────────────────────────────

/**
 * Dimension 값 파싱.
 *
 * engineStyleToRecord() 출력 포맷:
 * - "100px" → type=1 (length),  value=100.0
 * - "50%"   → type=2 (percent), value=0.5   (100으로 나눔)
 * - "auto"  → type=0 (auto),    value=0.0
 * - 100 (숫자) → type=1 (length), value=100.0  (수동 호출 경우 대비)
 *
 * CRITICAL: percent는 반드시 /100 처리 (Rust 측 Dimension::percent(0.5) 와 매칭)
 */
function parseDimensionValue(value: unknown): { type: number; value: number } {
  if (typeof value === "number") {
    return { type: TAG_LENGTH, value };
  }
  if (typeof value !== "string") {
    return { type: TAG_AUTO, value: 0.0 };
  }
  const s = value.trim();
  if (s === "auto") {
    return { type: TAG_AUTO, value: 0.0 };
  }
  if (s.endsWith("px")) {
    const num = parseFloat(s.slice(0, -2));
    return { type: TAG_LENGTH, value: isNaN(num) ? 0.0 : num };
  }
  if (s.endsWith("%")) {
    const num = parseFloat(s.slice(0, -1));
    // CRITICAL: percent는 /100 처리
    return { type: TAG_PERCENT, value: isNaN(num) ? 0.0 : num / 100.0 };
  }
  // 순수 숫자 문자열 (예: "100")
  const num = parseFloat(s);
  return { type: TAG_LENGTH, value: isNaN(num) ? 0.0 : num };
}

// ─── Grid placement 파싱 ─────────────────────────────────────────────

/**
 * Grid placement 값 파싱.
 *
 * 입력은 항상 문자열 (`engineStyleToRecord` · `fullTreeLayout` grid 분기 · `utils.ts` 가 `String()` 으로
 * 변환해 싣는다).
 * - "auto"   → type=0, value=0
 * - "span N" → type=2, value=N
 * - "N"      → type=1, value=N  (line number)
 */
function parseGridPlacement(value: unknown): { type: number; value: number } {
  const s = typeof value === "string" ? value.trim() : String(value).trim();
  if (s === "auto") {
    return { type: GP_AUTO, value: 0 };
  }
  if (s.startsWith("span ")) {
    const num = parseInt(s.slice(5).trim(), 10);
    return { type: GP_SPAN, value: isNaN(num) ? 1 : num };
  }
  const num = parseInt(s, 10);
  if (!isNaN(num)) {
    return { type: GP_LINE, value: num };
  }
  return { type: GP_AUTO, value: 0 };
}

// ─── Grid JSON 사이드밴드 ─────────────────────────────────────────────

/**
 * Grid 배열 필드가 존재하면 JSON 사이드밴드 바이트 배열을 생성.
 * 없으면 빈 Uint8Array 반환.
 *
 * 포함 필드: gridTemplateColumns, gridTemplateRows, gridAutoColumns, gridAutoRows
 */
function buildGridJson(style: Record<string, unknown>): Uint8Array {
  const obj: Record<string, unknown> = {};

  if (style.gridTemplateColumns !== undefined) {
    obj.gridTemplateColumns = style.gridTemplateColumns;
  }
  if (style.gridTemplateRows !== undefined) {
    obj.gridTemplateRows = style.gridTemplateRows;
  }
  if (style.gridAutoColumns !== undefined) {
    obj.gridAutoColumns = style.gridAutoColumns;
  }
  if (style.gridAutoRows !== undefined) {
    obj.gridAutoRows = style.gridAutoRows;
  }

  if (Object.keys(obj).length === 0) {
    return new Uint8Array(0);
  }

  const json = JSON.stringify(obj);
  return new TextEncoder().encode(json);
}

// ─── 노드 인코딩 계획 (Pass 1) ───────────────────────────────────────

/**
 * 단일 노드의 인코딩 계획.
 * Pass 1에서 계산하고 Pass 2에서 그대로 사용한다.
 */
interface NodePlan {
  /** presence bitmap 낮은 32비트 */
  bitmapLow: number;
  /** presence bitmap 높은 32비트 */
  bitmapHigh: number;
  /** Grid JSON 사이드밴드 바이트 (없으면 길이 0) */
  gridJsonBytes: Uint8Array;
  /** 비트 위치 순서대로 정렬된 존재 필드 목록 */
  presentBits: number[];
  /** 이 노드의 총 바이트 크기 */
  byteSize: number;
}

/**
 * Pass 1: 노드의 인코딩 계획 계산.
 *
 * 비트맵 구성 + gridJson 생성 + 총 바이트 크기 산출.
 * Pass 2는 이 계획을 그대로 따른다.
 */
function planNode(node: BinaryBatchInput): NodePlan {
  let bitmapLow = 0;
  let bitmapHigh = 0;
  const presentBits: number[] = [];

  for (const key of Object.keys(node.style)) {
    // Grid 사이드밴드 키는 비트맵 제외
    if (GRID_SIDEBAND_KEYS.has(key)) continue;

    const bit = FIELD_MAP[key];
    if (bit === undefined) continue;

    // 값이 유효한지 검증 (undefined/null 제외)
    const val = node.style[key];
    if (val === undefined || val === null) continue;

    // 비트맵 설정 (u64를 low/high 두 u32로 표현)
    if (bit < 32) {
      bitmapLow |= 1 << bit;
    } else {
      bitmapHigh |= 1 << (bit - 32);
    }
    presentBits.push(bit);
  }

  // 비트 오름차순 정렬 (Rust 디코더 순서와 동일)
  presentBits.sort((a, b) => a - b);

  // Grid JSON 사이드밴드
  const gridJsonBytes = buildGridJson(node.style);

  // 바이트 크기 계산:
  // 8 (bitmap u64) + 2 (childCount u16) + 2*N (childIndices) + 2 (gridJsonLen) + gridJson.length
  // + 각 present 필드 바이트 크기 합
  let byteSize = 8 + 2 + 2 * node.children.length + 2 + gridJsonBytes.length;
  for (const bit of presentBits) {
    byteSize += fieldSizeForBit(bit);
  }

  return { bitmapLow, bitmapHigh, gridJsonBytes, presentBits, byteSize };
}

// ─── Pass 2: 바이너리 쓰기 헬퍼 ──────────────────────────────────────

/**
 * 단일 enum 필드 값을 DataView에 u8로 쓴다.
 * 매핑에 없는 값은 0을 기본으로 쓴다.
 */
function writeEnumField(
  view: DataView,
  offset: number,
  bit: number,
  value: unknown,
): void {
  const map = getEnumMap(bit);
  if (map === null) {
    view.setUint8(offset, 0);
    return;
  }
  const str = typeof value === "string" ? value : String(value);
  const encoded = map[str] ?? 0;
  view.setUint8(offset, encoded);
}

/**
 * f32 direct 필드를 DataView에 f32 LE로 쓴다.
 */
function writeF32Field(view: DataView, offset: number, value: unknown): void {
  const num = typeof value === "number" ? value : parseFloat(String(value));
  view.setFloat32(offset, isNaN(num) ? 0.0 : num, true);
}

/**
 * Dimension/LPA 필드를 DataView에 5바이트(type u8 + value f32 LE)로 쓴다.
 */
function writeDimField(view: DataView, offset: number, value: unknown): void {
  const parsed = parseDimensionValue(value);
  view.setUint8(offset, parsed.type);
  view.setFloat32(offset + 1, parsed.value, true);
}

/**
 * LP 필드를 DataView에 5바이트(type u8 + value f32 LE)로 쓴다.
 * LP는 auto 없음 — "auto" 입력은 type=1(length), value=0으로 처리.
 */
function writeLpField(view: DataView, offset: number, value: unknown): void {
  const parsed = parseDimensionValue(value);
  // LP는 TAG_AUTO가 없으므로 auto를 length(0)으로 변환
  const type = parsed.type === TAG_AUTO ? TAG_LENGTH : parsed.type;
  view.setUint8(offset, type);
  view.setFloat32(offset + 1, parsed.value, true);
}

/**
 * Grid placement 필드를 DataView에 3바이트(type u8 + value i16 LE)로 쓴다.
 */
function writeGridPlacementField(
  view: DataView,
  offset: number,
  value: unknown,
): void {
  const parsed = parseGridPlacement(value);
  view.setUint8(offset, parsed.type);
  // i16 범위 클램프: -32768 ~ 32767
  const clamped = Math.max(-32768, Math.min(32767, parsed.value));
  view.setInt16(offset + 1, clamped, true);
}

/**
 * 비트 위치와 값을 받아 올바른 쓰기 함수로 디스패치한다.
 * offset을 소비한 바이트만큼 증가시켜 반환한다.
 */
function writeField(
  view: DataView,
  offset: number,
  bit: number,
  value: unknown,
): number {
  if (bit >= ENUM_BIT_MIN && bit <= ENUM_BIT_MAX) {
    writeEnumField(view, offset, bit, value);
    return offset + 1;
  }
  if (bit >= F32_BIT_MIN && bit <= F32_BIT_MAX) {
    writeF32Field(view, offset, value);
    return offset + 4;
  }
  if (bit >= DIM_BIT_MIN && bit <= DIM_BIT_MAX) {
    writeDimField(view, offset, value);
    return offset + 5;
  }
  if (bit >= LPA_BIT_MIN && bit <= LPA_BIT_MAX) {
    writeDimField(view, offset, value);
    return offset + 5;
  }
  if (bit >= LP_BIT_MIN && bit <= LP_BIT_MAX) {
    writeLpField(view, offset, value);
    return offset + 5;
  }
  if (bit >= GRID_PLACE_BIT_MIN && bit <= GRID_PLACE_BIT_MAX) {
    writeGridPlacementField(view, offset, value);
    return offset + 3;
  }
  return offset;
}

// ─── 비트 → 키 역매핑 (내부용) ──────────────────────────────────────

/**
 * FIELD_MAP의 역방향 조회.
 * 비트 위치 → Record 키 매핑.
 * Pass 2에서 비트 순서 순회 시 키를 O(1)로 찾기 위해 사용.
 */
const BIT_TO_KEY: Record<number, string> = Object.fromEntries(
  Object.entries(FIELD_MAP).map(([key, bit]) => [bit, key]),
);

// ─── 공개 API ────────────────────────────────────────────────────────

/**
 * 스타일 노드 배치를 WASM 소비용 바이너리 포맷으로 인코딩한다.
 *
 * JSON.stringify를 대체하며 build_tree_batch_binary() WASM 함수에 전달한다.
 *
 * 2-Pass 인코딩:
 * - Pass 1: 각 노드의 비트맵·필드 계획 + 총 바이트 크기 산출
 * - Pass 2: ArrayBuffer 단일 할당 후 DataView로 순차 기록
 *
 * @param batch - engineStyleToRecord() 출력 배열
 * @returns 헤더 + 노드 직렬화 바이트
 */
export function encodeBatchBinary(batch: BinaryBatchInput[]): Uint8Array {
  const nodeCount = batch.length;

  // ── Pass 1: 각 노드 계획 수립 + 총 크기 계산 ──────────────────────
  const plans: NodePlan[] = new Array<NodePlan>(nodeCount);
  let totalSize =
    4 + // magic "TAFF"
    1 + // version u8
    4; // nodeCount u32 LE

  for (let i = 0; i < nodeCount; i++) {
    const plan = planNode(batch[i]);
    plans[i] = plan;
    totalSize += plan.byteSize;
  }

  // ── Pass 2: ArrayBuffer 할당 + DataView 기록 ──────────────────────
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let pos = 0;

  // --- 글로벌 헤더 ---
  // magic: [0x54, 0x41, 0x46, 0x46]
  view.setUint8(pos++, MAGIC[0]);
  view.setUint8(pos++, MAGIC[1]);
  view.setUint8(pos++, MAGIC[2]);
  view.setUint8(pos++, MAGIC[3]);
  // version
  view.setUint8(pos++, VERSION);
  // nodeCount (u32 LE)
  view.setUint32(pos, nodeCount, true);
  pos += 4;

  // --- 노드별 인코딩 ---
  for (let i = 0; i < nodeCount; i++) {
    const node = batch[i];
    const plan = plans[i];

    // presence bitmap: u64 LE = low u32 + high u32
    view.setUint32(pos, plan.bitmapLow >>> 0, true);
    pos += 4;
    view.setUint32(pos, plan.bitmapHigh >>> 0, true);
    pos += 4;

    // childCount: u16 LE
    const childCount = node.children.length;
    view.setUint16(pos, childCount, true);
    pos += 2;

    // childIndices: u16 LE × childCount
    for (let j = 0; j < childCount; j++) {
      view.setUint16(pos, node.children[j], true);
      pos += 2;
    }

    // gridJsonLen: u16 LE
    view.setUint16(pos, plan.gridJsonBytes.length, true);
    pos += 2;

    // gridJson: UTF-8 bytes
    if (plan.gridJsonBytes.length > 0) {
      u8.set(plan.gridJsonBytes, pos);
      pos += plan.gridJsonBytes.length;
    }

    // 필드: 비트 오름차순 (낮은 비트 → 높은 비트)
    for (const bit of plan.presentBits) {
      // 비트 위치에 대응하는 Record 키를 역매핑으로 찾는다
      const key = BIT_TO_KEY[bit];
      if (key === undefined) continue;
      const value = node.style[key];
      if (value === undefined || value === null) continue;
      pos = writeField(view, pos, bit, value);
    }
  }

  return u8;
}
