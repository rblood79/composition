# ADR-142 Inc3 인수인계 — skiaLegacy family Skia 발효 (render.shapes 제거)

> 생성: 2026-06-01. 이전 세션에서 Inc1(①variant 색상 swap) + Inc1-B2(skiaPrimitive draw fn
> spec-free) 완료 후 Inc3 inventory 까지 실측 완료. 이 문서로 다음 세션 즉시 이어받기.

## 현재 위치 (main HEAD = `e43f4dbf0`)

ADR-142 theme re-home 진행 상태 (plan: `~/.claude/plans/zippy-wibbling-origami.md`):

| 축              | 작업                        | 상태                                                                       |
| --------------- | --------------------------- | -------------------------------------------------------------------------- |
| ① variant 색상  | rule.variants swap          | ✅ Inc1-B1 (`251594132`) + Inc1-B2 (`e43f4dbf0`) 완료                      |
| ② size          | spec.sizes 유지             | 사용자 confirm — 작업 없음 (ADR-907 Layer B 충돌로 rule 이전 안 함)        |
| ④ layout 판정   | `_hasChildren`              | **폐기** — ③의 부산물로 흡수 (사용자 confirm 2026-06-01, task #19 deleted) |
| ③ render.shapes | skiaLegacy family Skia 발효 | ⬜ **Inc3 — 다음 작업** (task #20)                                         |

**확정 실행 순서 (정정)**: 시각(①) ✅ → skiaLegacy(③). layout(④) 독립 작업 없음.

## Inc3 정확한 대상 — 17 type / 4 family (런타임 실측)

게이트: `isCatalogSkiaCutover(type) = cutover==="catalog" && !skiaLegacy`
(`packages/shared/src/catalog/cutover.ts:34`). **`skiaLegacy: true` entry 만 아직
`spec.render.shapes()` 사용** (buildSpecNodeData.ts:1089 분기).

런타임 추출 명령 (재확인용):

```bash
npx tsx --eval 'import { componentCatalog } from "./packages/shared/src/catalog/componentCatalog.ts";
const l = componentCatalog.filter(e => e.kind!=="native" && e.cutover==="catalog" && e.skiaLegacy===true);
const m={}; for(const e of l)(m[e.family]??=[]).push(e.type);
for(const[f,t]of Object.entries(m))console.log(f+": "+t.join(", ")); console.log("총 "+l.length);'
```

| family          | type (수)                                                     | render.shapes 가 하는 일                             | Skia generic 발효 난이도                                                                |
| --------------- | ------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **collections** | ListBox, Menu, Select, ComboBox, Tabs, TagGroup, GridList (7) | items 배열 순회 multi-item 렌더                      | MED-HIGH — items→element 전환(ListBox row projection 패턴 확장)                         |
| **tree-table**  | Table (1)                                                     | props.rows/columns 2D grid cell 직접 렌더            | HIGH — 2D grid generic 또는 cell element 분해                                           |
| **overlays**    | Dialog, Modal, Popover, Tooltip, DropZone (5)                 | portal/overlay (OverlayArrow svg / dashed drop 영역) | MED — shadow/dashed 는 G2(b)에서 buildCatalogShapes 통합됨. Modal=변경 무의미 제외 후보 |
| **date-color**  | Calendar, RangeCalendar, DatePicker, DateRangePicker (4)      | 날짜 grid(6주×7일 cell) + Popover portal             | MED-HIGH — 날짜 grid → ComponentState 변환 레이어                                       |

## Inc3 작업 방식 (breakdown #5 seam, ADR-142 본문 line 263/269)

- **핵심 통찰**: `specShapesToSkia`(specShapeConverter.ts)는 **이미 generic** shape→Skia 변환기.
  per-component 인 부분은 오직 `spec.render.shapes()`(shape descriptor 생성)뿐.
  → Inc3 = render.shapes 를 generic shape-descriptor 생성기로 교체 → 동일 specShapesToSkia 재사용.
- collection items / Table 2D / Calendar date grid 는 box+text generic 으로 안 되는 multi-item /
  2D / cell 구조 → **items→element 전환** (canonical children projection) 이 본질.
- ③ 완료 시 `getSpecForTag` runtime 호출 0 → spec 폐기 → `_hasChildren` 판정 입력(spec)도 자연 소멸
  (④ 흡수) → ADR-142 #5/#6/#8 충족 → **Implemented 승격** (task #14).

## ⚠️ Inc3 진입 전 필수 — 전제·관점 점검 (R4 HIGH)

Inc3 는 ADR-142 의 **R4 HIGH** (Skia generic 재구현, breakdown #5, G2 최대 무게). 진입 전:

1. **family별 atomic** (HC#10) — 한 family 만 전환, 실패 family 격리. 전역 단일 스위치 금지.
2. **legacy fallback 유지** — render.shapes 즉시 삭제 금지. `isCatalogSkiaCutover` 게이트로
   family 발효, 검증(/cross-check DOM↔Skia 대칭) 통과 후 skiaLegacy:false 전환.
3. **items→element 전환은 ADR scope 재확인 필요** — collection items generic 메커니즘이
   "전 family 후 일괄"로 plan 에 적혀 있음. family별 진행 vs 일괄 메커니즘 우선 — 진입 시
   AskUserQuestion (M4 sub-group N≥3 / scope inflation 점검). 차단 메모리
   feedback-no-derived-adr-mid-execution / feedback-execute-adr-surface-minimization 선행 평가.
4. Inc2 폐기 선례처럼 — plan 추론 ≠ ADR 결정. breakdown #5 텍스트가 SSOT.

## 검증 게이트 (각 family)

- type-check baseline 110 유지
- specs + builder parity 테스트 PASS
- `/cross-check` family fixture DOM↔Skia 시각 대칭 (Chrome MCP — dev 서버 localhost:5173)
- render.shapes 제거 후 grep `spec.render.shapes` 해당 family 0건

## 표준 제약 (verbatim)

- web PR 금지. `git add -A`(단 session-external 제외) → commit → **push 는 명시 요청 시에만**.
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 한국어 응답, 코드/용어 영어. type-check baseline 110.
- session-external (`.claude/stats/.last-drift-snapshot-sha`) staging 제외.
- 의회적/영어 은어 어휘 회피 (별/발의/land/framing → 대체어).
- 본질 사고 (ADR fork/분리/SSOT 경계) 시 깊은 사고 진입 + AskUserQuestion + 차단 메모리 인용.
