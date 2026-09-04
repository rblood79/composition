# ADR-203: 선택 변경 fan-out 제거 — Navigator 트리·Properties 행 단위 구독

## Status

Accepted — 2026-09-03 (Proposed 2026-09-02 → breakdown §1 4 질문 lock-in 기록 + `/execute-adr 203` 착수로 승격; 2026-09-04 상위 Builder 성능 계획 Track B 연결 + RAC 실 DOM selector/LayerTree 범위 보정, Status 불변)

## Context

**Domain**: 빌더 chrome UI (Navigator · Properties 패널). 문서 컴포넌트의 D2/D3 에는 손대지 않는다. Navigator 트리는 RAC `Tree` 위에 있으므로 **D1 원칙 (RAC 컴포넌트의 DOM/ARIA 재작성 금지, `.claude/rules/ssot-hierarchy.md` §6)** 이 패널에도 그대로 적용된다.

**관계**: ADR-155 (Implemented 2026-07-17) 는 숨은 패널의 선택 fan-out 을 Activity 로 차단했고, 열린 패널의 비용은 남겼다. ADR-150 R2 는 캔버스 collection window 와 LayerTree 패널 정책을 분리하고 패널 쪽을 "별도 정책 결정 후 검증" 으로 남겼다. 본 ADR 이 그 패널 정책이며 두 ADR 과 의존 방향은 없다 (fork 아님 — breakdown §1).

**상위 Builder 성능 계획과의 관계**: `docs/explanation/research/BUILDER_PERF_BASELINE_2026-09.md` §4-1의 Track B다. 프로젝트 생성·편집기 진입 때의 Skia cold first-frame은 같은 문서의 Track A로 분리한다. Track A는 font/paragraph/GPU surface와 matching surface flush까지의 부팅 경로, 본 ADR은 ready 이후 Navigator DOM 선택 fan-out 경로이므로 원인·소비 표면·Gate를 합치지 않는다. 두 트랙은 공통 하니스와 측정 조건만 공유하며 성능 측정은 자원 경합을 피하려고 직렬 실행한다.

**문제** (2026-09 기준선 `docs/explanation/research/BUILDER_PERF_BASELINE_2026-09.md` §3): 600 요소 문서에서 선택 1회 ≈ 240 ms (3.9 fps, 할당 143 MB/s, longtask 13/3116 ms). 60 요소에서도 gap p95 43.5 ms · 드롭 16.8%. 선택은 캔버스 클릭마다 일어나는 가장 잦은 상호작용이라 체감이 가장 크다.

**원인 (Phase 0 실측, breakdown §2)**:

1. **패널 조합 A/B** — navigator 만 열어도 p50 236.6 ms (드롭 100%), properties 만 열면 16.7 ms (드롭 0.5%), 둘 다 닫으면 16.7 ms. 비용은 Navigator 트리 단독으로 재현된다. Properties 는 할당 +18 MB/s 뿐이다.
2. **가동되지 않는 가상화** — `LayerTree.tsx:214` 의 `treeNodes.length >= 300` 분기는 root 노드 개수 기준인데 모든 페이지의 root 는 body 1개다. 2026-08-29 도입 이후 실 문서에서 한 번도 켜진 적이 없다 (측정 Q4: 존재 ≠ 가동; 2026-09-03 사용자 프로젝트 live 확인 — 26 페이지 문서의 현재 페이지 root = body 1개). 따라서 RAC `Tree` 가 600 행 전부를 mount 한다 (`TreeBase.tsx:187-208`).
3. **RAC Tree 의 재렌더 단위** — `selectedKeys` 가 바뀌면 `TreeStateContext` 를 소비하는 모든 `TreeItem` 이 재렌더되고 collection 이 재구축된다. self-time 상위가 전부 React/RAC 내부 (`ReactElement` 9.2%, RAC collection 빌더 `getDirectChildren`·`getItem`·`DOMElement` 8.8%, commit 6.8%, `ShadowTreeWalker` 3.7%) 이고 앱 행 콘텐츠 (`NormalItemContent`, `getEditingSemanticsRole`) 는 각 0.3% — 행 콘텐츠 memo 로는 닿지 않고 **행 수 자체** 를 줄여야 한다.

**Hard Constraints**:

1. 600 요소 · Navigator + Properties 열림 · headless 60Hz 에서 select gap p50 ≤ 33 ms (2 프레임) · longtask 0. 60 요소에서 드롭 0%.
2. RAC Tree 의 DOM/ARIA/키보드/DnD 계약 유지 — RAC 1.20 실 DOM인 `role=treegrid` + 행 `role=row`, `aria-selected/expanded/level/posinset/setsize`, ↑↓ Home/End typeahead, shift/meta 다중 선택, `dragAndDropHooks` (D1).
3. 기존 사용자 가시 동작 무손실 — 캔버스 클릭 시 조상 자동 펼침 + 선택 상태 반영 (현재 기준선처럼 강제 자동 스크롤은 하지 않음), 우클릭 메뉴, 삭제, DnD 재배치, 패널 숨김→복원 시 첫 가시 행·offset 보존 (ADR-155 G4).
4. 신규 런타임 의존 0 — `Virtualizer` / `ListLayout` 은 RAC 1.20 이 re-export (breakdown C6). 초기 번들 +0.
5. 5k 문서에서 select p50 ≤ 50 ms (persistent 프로젝트 재측정 후 ratchet).

**Soft Constraints**: headless 수치는 비교치 (절대값은 `--headed`) · dev React 오버헤드 15~20% 는 prod 에서 빠진다 · PageTree와 FramesTab이 같은 `TreeBase`를 쓰지만 scope 밖이므로 공용 `TreeBase` 자체에는 가상화 동작을 추가하지 않는다 · Properties 축은 600 에서 문제가 아니므로 조건부.

## Alternatives Considered

### 대안 A: RAC `Virtualizer` + `ListLayout` 로 RAC Tree 창 렌더 (D1 유지)

- 설명: `LayerTree`의 RAC 경로에서 `<TreeBase>`를 `<Virtualizer layout={ListLayout} layoutOptions={{ rowSize }}>`로 감싼다. 가시 행 + RAC 내부 overscan만 mount 되므로 선택 변경 시 재렌더 단위가 O(가시 행) 이 된다. `rowSize`는 LayerTree 전용 TS 상수로 고정하고 browser gate가 실제 `--control-size` 기반 행 높이와 일치를 검증한다. 공용 `TreeBase`와 그 다른 소비자(PageTree · FrameList · FrameElementTree)는 변경하지 않는다.
- 근거: RAC 공식 가상화 경로 — Virtualizer 문서는 ListBox/GridList/Table 예시를 들고, 1.20 `Tree.mjs:215` 가 같은 `CollectionRendererContext` (`isVirtualized`/`layoutDelegate`/`dropTargetDelegate`) 를 소비한다 (코드 확인). Adobe Spectrum 2 TreeView 가 이 경로 위에 있다. 자체 트리 없이 upstream 이 접근성·키보드·DnD 를 계속 소유한다.
- 위험:
  - 기술: **M** — Tree + Virtualizer + DnD 조합은 문서 예시가 없어 스파이크로 확인해야 한다 (drop indicator 위치, 화면 밖 행 포커스).
  - 성능: L — 창 렌더는 문서 크기와 무관. 고정 행 높이라 ResizeObserver 불필요.
  - 유지보수: L — LayerTree 결선 + CSS. 공용 TreeBase를 건드리지 않고 tanstack 자체 트리를 LayerTree 에서 제거할 수 있다.
  - 마이그레이션: L — 래퍼 제거로 즉시 롤백.

### 대안 B: 기존 tanstack `VirtualizedTree` 를 총 행 수 기준으로 켠다

- 설명: `LayerTree.tsx:214` 의 판정을 root 수에서 펼친 행 수로 바꿔 (1줄) 이미 있는 자체 가상 트리를 가동한다.
- 근거: FramesTab 이 같은 컴포넌트를 쓰는 선례. react-arborist 류 자체 가상 트리 (virtualized rendering + DnD + 키보드) 가 디자인 툴 레이어 패널의 흔한 구현.
- 위험:
  - 기술: L — 코드가 이미 있다.
  - 성능: L.
  - 유지보수: **H** — RAC Tree 와 자체 `role="tree"` 두 구현을 영구 병행. `selectionModel.ts` 가 RAC 선택 규칙을 복제하고 있고 키보드/typeahead/ARIA/DnD (HTML5 native) 를 손으로 유지한다.
  - 마이그레이션: M — D1 규칙 (RAC DOM/ARIA 재작성 금지) 위반 상태를 정식 경로로 굳힌다.

### 대안 C: RAC Tree 유지 + 행 콘텐츠 memo + 선택 leaf 구독

- 설명: `NormalItemContent` 를 memo 하고 `isSelected` 를 store `selectedElementIdsSet.has(id)` 로 행마다 구독.
- 근거: 이 저장소의 panel leaf 구독 패턴 (2026-09-02 splitter/overlay 수정) 의 확장.
- 위험:
  - 기술: L.
  - 성능: **H** — 프로파일상 비용이 RAC `TreeItem` 600개 재렌더와 collection 재구축 (React/RAC 내부) 이라 앱 memo 가 닿지 않는다. 앱 행 코드는 전체의 1% 미만.
  - 유지보수: L.
  - 마이그레이션: L.

### 대안 D: 선택 반영을 transition / deferred 로 미룬다

- 설명: `selectedKeys` 를 `useDeferredValue` 로 내려 캔버스 하이라이트 뒤에 트리를 갱신.
- 근거: React 공식 패턴 (긴급/비긴급 갱신 분리).
- 위험:
  - 기술: L.
  - 성능: **H** — 총비용 240 ms 는 그대로이고 시점만 옮긴다. 측정 규칙 (`measurement-validity.md` Q3 — 횟수·시점 감소 ≠ 총비용) 상 통과 불가.
  - 유지보수: L.
  - 마이그레이션: L.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | L        | L            |     0      |
| B    | L    | L    | H        | M            |     1      |
| C    | L    | H    | L        | L            |     1      |
| D    | L    | H    | L        | L            |     1      |

루프 판정: HIGH 0 인 대안 A 가 있으므로 추가 대안 불필요. CRITICAL 없음.

## Decision

**대안 A: RAC `Virtualizer` + `ListLayout` 로 RAC Tree 창 렌더** 를 선택한다.

선택 근거:

1. **위험의 성질** — A 의 M 1건 (Tree + DnD 가상화 미검증) 은 Phase 1 스파이크 1회로 소거되는 일회성 검증 위험이고 실패 시 fallback (B 를 임시로) 이 명시돼 있다. B 의 H 는 코드가 사는 동안 계속 지불하는 이중 구현 비용이다.
2. **D1 유지** — upstream RAC 가 DOM/ARIA/키보드/DnD 를 계속 소유한다. 자체 `role="tree"` 를 정식 경로로 굳히지 않는다.
3. **원인에 맞는 처방** — 프로파일이 지목한 비용은 행 수에 비례하는 RAC/React 내부 작업이므로 행 수를 줄이는 것만이 총비용을 낮춘다 (C·D 는 총비용 불변).

기각 사유:

- **대안 B 기각**: RAC Tree 와 자체 트리의 영구 병행 — D1 규칙 위반을 정식화한다. 단 A 의 G1 실패 시 **임시** fallback 으로 보존하며 그 경우 D1 debt 를 Risks 에 HIGH 로 등재한다.
- **대안 C 기각**: 프로파일이 앱 행 코드 비중 1% 미만을 보여 memo 가 총비용에 닿지 않는다.
- **대안 D 기각**: 지연은 총비용을 감추는 것이지 줄이는 것이 아니다.

**Properties 축**: 제목의 "Properties 행 단위 구독" 은 A/B 에서 600 요소 기준 비용이 측정 오차 안 (p50 16.7 ms, 드롭 0.5%) 으로 확인돼 **조건부 Phase 4** 로 둔다 — Styles/Properties/Navigator 전부 열린 5k 재측정에서 gap p95 > 25 ms 또는 할당 > 60 MB/s 일 때만 착수 (G6). 조건 미달이면 "측정상 불필요" 로 종결한다.

**부수 정정**: 가동된 적 없는 `>= 300` 분기는 A 채택과 함께 LayerTree 에서 제거한다. FramesTab 의 같은 분기는 scope 밖 (후속 fix 단위).

**가상화 범위 경계**: `Virtualizer`는 `LayerTree`에서만 opt-in 한다. `TreeBase.tsx`를 무조건 감싸면 같은 공용 컴포넌트를 쓰는 PageTree · FrameList · FrameElementTree까지 계획 밖에서 동작이 바뀌므로 금지한다. G1에서 세 소비자의 `TreeBase` 호출부가 RAC `Virtualizer`로 감싸지지 않았고, FrameElementTree의 기존 tanstack `VirtualizedTree` 조건 분기도 그대로임을 정적·browser 대조로 고정한다.

> 구현 상세: [203-selection-fanout-layer-tree-virtualized-rows-breakdown.md](design/203-selection-fanout-layer-tree-virtualized-rows-breakdown.md) — §2 Phase 0 inventory (A/B 표 · 프로파일 · 코드 사실 C1~C10 · 구독자 32 파일) / §3 Phase 1 스파이크 / §4 parity·정리 / §5 재측정·ratchet / §6 Phase 4 조건부 / §8 측정 조건.

## Risks

| ID  | 위험                                                                                                                                                                                                                                                               |  심각도  | 대응                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 가상화된 Tree 의 DnD 회귀 — drop indicator 위치 · 무효 drop 판정 · 컨테이너 안으로 이동. 경로: `TreeBase.tsx:187` (`dragAndDropHooks`), `LayerTree.tsx:119-155` (`handleIsValidDrop`/`handleMove`/`canDrag`), `useLayerTreeData.ts:190` (`moveElementToContainer`) | **HIGH** | G1 스파이크에서 DnD 3 케이스 포함, G2 live 확인. 실패 시 대안 B 임시 fallback + D1 debt 등재                                                                                                                            |
| R2  | 행 높이 불일치 — CSS `min-height: var(--control-size)` (현재 28px) vs ListLayout 고정 `rowSize` → 행 겹침/스크롤바 오차                                                                                                                                            |   MED    | LayerTree 전용 `LAYER_TREE_ROW_SIZE_PX = 28`을 layout 입력으로 쓰고 browser 테스트가 `.react-aria-TreeItem`과 `.elementItem`의 계산 높이 === 상수를 검증. deprecated `rowHeight`와 per-row ResizeObserver는 쓰지 않는다 |
| R3  | RAC `Virtualizer`가 Tree root에 inline `overflow`를 부여하는데 기존 `.section-content`도 scroll owner라 이중 스크롤 또는 숨김→복원 위치 소실                                                                                                                       |   MED    | Layers section에서 외부 scroll을 끄고 `.layer-tree--rac-virtualized`를 단일 scroll owner로 둔다. G3는 DOM 노드의 과거 `scrollTop`이 아니라 첫 가시 key + offset 보존을 live 비교한다                                    |
| R4  | 화면 밖 행으로의 키보드 Home/End · typeahead 포커스와 DnD 후 포커스 유지                                                                                                                                                                                           |   MED    | RAC `layoutDelegate`와 focused-key persistence 경로를 G2에서 live 확인. 캔버스 선택은 §2-5 기준선대로 조상/선택 상태만 동기화하고 강제 자동 스크롤을 새 계약으로 추가하지 않는다                                        |
| R5  | 패널 레이아웃이 트리에 높이를 주지 않아 Virtualizer 가 0 행을 그림 (`LayersSection.tsx:288` Section 래퍼)                                                                                                                                                          |   MED    | Phase 1 첫 렌더에서 확인, `height: 100%; min-height: 0` 명시                                                                                                                                                            |
| R6  | 측정 leakage — 하니스 select 는 store 경로 (hit-test 없음), headless 는 비교치                                                                                                                                                                                     |   LOW    | G4 에 실 포인터 클릭 1회 + `--headed` 1회                                                                                                                                                                               |
| R7  | 기준선 문서 stale — 전/후 표 미갱신                                                                                                                                                                                                                                |   LOW    | G5 종결 조건                                                                                                                                                                                                            |
| R8  | 공용 `TreeBase`에 가상화를 무조건 결선하면 scope 밖 PageTree · FrameList · FrameElementTree의 DOM/포커스/DnD/스크롤 계약까지 함께 바뀜                                                                                                                             |   MED    | `LayerTree`에서만 `Virtualizer`를 감싸고 G1에서 공용 `TreeBase`의 `Virtualizer` 참조 0건 + 비대상 호출부 3종 무변경 + FrameElementTree 기존 tanstack 조건 분기를 고정                                                   |

## Gates

측정 조건 (모든 Gate 공통): 격리 프로젝트 · 시드 600 (body 아래 Text/frame) · Navigator + Properties 열림 · headless 60Hz · select 부류 100 ms 간격 3 s · 하니스 `pnpm perf:baseline -- --lane frame --classes idle,select`. 대조군 = 2026-09-02 A/B (both 234.8 ms). 불리 케이스 = 5k persistent 문서 + 실 포인터 클릭. live 확인은 DevTools CPU throttle 상태를 함께 기록한다 (사용자 환경은 4x slowdown — 하니스 수치와 직접 비교 금지, breakdown §8).

| Gate | 시점              | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 실패 시 대안                                                                  |
| ---- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| G0   | 코드 변경 전      | breakdown §2-5 보강 — 실 문서 root 수 (**2026-09-03 확인: 사용자 프로젝트 26 페이지, 현재 페이지 root = body 1개**) · 실제 행 role/수 + 현재 동작 체크리스트 기록. **2026-09-03 통과** — breakdown §2-5: 실 DOM 은 `role="treegrid"` + 행 `role="row"`, 초기 행 1 → body 펼침 후 12 (Components 페이지), `.layer-tree--virtualized` 없음, 체크리스트 11 항목 기록 (shift 구간 선택이 2 행 · 캔버스 선택 행 자동 스크롤 없음 = 현재 값)                                    | 기록 없이 착수 금지                                                           |
| G1   | Phase 1 종료      | browser 테스트 (600·5k 노드, 320px)가 `.layer-tree--rac-virtualized [role="row"]` idle 행 수 ≤ 18(320px + RAC 내부 1/3 viewport overscan + focused/boundary 여유)이며 두 규모 차이 ≤ 1 · 선택 10회 후 `renderContent` 증가량 ≤ 180 · 실제 행 높이 === `LAYER_TREE_ROW_SIZE_PX` · Tree 단일 scroll owner · 하니스 select gap p50 ≤ 33ms/드롭 ≤ 5%/longtask 0 · 60요소 드롭 0 · DnD 3케이스 · `TreeBase`의 `Virtualizer` 참조 0건 · 비대상 호출부/기존 tanstack 분기 무변경 | 대안 B 임시 fallback + D1 debt HIGH 등재 + 후속 ADR 없이 본 ADR 안에서 재시도 |
| G2   | Phase 2           | 가상화 전/후 같은 행 ARIA 속성 diff 0 · 키보드 ↑↓ Home/End typeahead · shift/meta 다중 선택 · 화면 밖 키보드 포커스 자동 스크롤 · DnD 후 포커스 유지 (Chrome MCP live)                                                                                                                                                                                                                                                                                                    | 해당 축 RAC 설정 수정 후 재확인 — D1 계약 미달이면 승격 금지                  |
| G3   | Phase 2           | 패널 숨김→복원 전후 첫 가시 row key + viewport offset 차이 ≤ 1px · 캔버스 클릭 시 조상 자동 펼침 + 선택 상태 반영 · 강제 자동 스크롤 없음 = §2-5 기준선                                                                                                                                                                                                                                                                                                                   | 단일 scroll owner와 scroll memory 대상 수정 후 재확인                         |
| G4   | Phase 3           | 5k persistent 문서 select p50 ≤ 50 ms · `--headed` 1회 · 실 포인터 클릭 1회 · 하니스에 `.layer-tree--rac-virtualized [role="row"]` 수 기록 추가                                                                                                                                                                                                                                                                                                                           | ratchet 값을 실측으로 재설정하고 사유 기록                                    |
| G5   | Implemented 전    | CHANGELOG · 기준선 문서 §3-2/§4 전/후 표 · `### Live Exercise` 절 · README                                                                                                                                                                                                                                                                                                                                                                                                | 승격 보류                                                                     |
| G6   | Phase 4 착수 판정 | Styles + Properties + Navigator 열림 5k 에서 select gap p95 > 25 ms 또는 할당 > 60 MB/s → Phase 4 착수. 미달 → "측정상 불필요" 로 종결 기록                                                                                                                                                                                                                                                                                                                               | (판정 게이트 — 실패 개념 없음)                                                |

### Live Exercise

(Implemented 승격 시 기재 — G2/G3 시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분.)

## Consequences

### Positive

- 선택 1회 비용이 문서 크기와 무관해진다 — `LayerTree`의 RAC 경로만 창 렌더해 모든 Builder 페이지의 Layers 섹션에 적용하고, 공용 `TreeBase`의 다른 소비자는 유지한다. 600 요소 240 ms → 2 프레임 이내 (G1).
- RAC 가 접근성·키보드·DnD 를 계속 소유한다 (D1). `LayerTree.tsx` 의 자체 가상 트리 분기가 사라져 경로가 하나가 된다.
- 하니스 select 결과에 LayerTree로 scope된 `[role="row"]` 수가 남아 다른 treegrid 행과 섞이지 않고 창 렌더 회귀를 잡는다.

### Negative

- 행 높이가 LayerTree 고정 `rowSize`에 묶인다 — 행 콘텐츠나 `--control-size`가 바뀌면 browser 동등성 gate와 상수를 함께 갱신해야 한다 (R2).
- FramesTab 은 여전히 tanstack `VirtualizedTree` 를 쓴다 — 두 트리 구현의 병행은 FramesTab 후속 정리까지 남는다.
- Properties 필드 단위 구독은 조건부라, 5k 재측정 전까지 Properties 축 개선은 없다.
