# ADR-160 구현 상세 — collection projection 행 텍스트 측정 SSOT 단일화

> 본문: [160-collection-projection-metric-ssot.md](../160-collection-projection-metric-ssot.md)
> 원칙 계승: [ADR-907](../completed/907-collection-container-style-pipeline.md) Layer D(동일 resolver 심볼 공유) · 경계: [ADR-157](../157-collection-builder-display-policy.md)(표시 정책 불변)

## §1. 전제·관점 lock-in (fork checkpoint — 완전 신규 주제라 해당 없음 확인)

본 ADR 은 기존 ADR 의 fork/분리가 아니라 **반복 parity 버그(2026-07-22 width/gap/wrap/겹침 5건)의 근본 원인에 대한 신규 결정**이다. 다음을 확인해 fork 게이트 비대상임을 명시한다.

1. **base/응용 분류**: ADR-907(container spacing resolver 공유, Implemented)의 잔여 분리가 아님. 907 은 padding/gap 축, 본 ADR 은 텍스트 wrap 높이·스택 offset 축. 서로 직교하는 별도 측정 축이다.
2. **schema 직교성**: canonical schema 변경 0. projection 행 props 에 측정 결과(파생값)를 주입하는 것으로, 저장 스키마 무변경.
3. **선행 ADR 전제 reverse 검증**: 907 Layer D("layout `render.shapes` 와 동일 resolver 심볼 공유")를 텍스트 측정으로 확장하는 방향이며, 907 의 의존 방향(spec metric ← consumer)을 그대로 승계한다. 반전 없음.
4. **ADR-157 경계**: 157 은 가상화 stride(단일 줄 균일)로 sample/hatch 표시 정책을 정의한다. 본 ADR 은 **렌더 행(§1.55b-2 / escape) 측정만** 단일화하고 **가상화 stride 는 손대지 않는다** — 157 표시 정책 불변이 Hard Constraint.

## §2. 현재 측정 지점 인벤토리 (Phase 0 freeze 대상)

동일한 "행 텍스트 높이"를 계산하는 측정 소스가 현재 **2개**(layout-util 함수 ↔ escape 별도 함수)로 갈라져 있다. M1/M2 는 이미 layout-util 함수 하나를 공유하며, escape(M3)만 패키지 경계로 별도 함수를 쓴다.

| #   | 지점                | 파일                                                                                                        | 현재 측정 방식                                               | 소비 대상                               |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| M1  | layout 렌더 행 공식 | `apps/builder/.../layout/engines/utils.ts` §1.55b-2(ListBox) / §1.55b2(GridList)                            | `measureWrappedTextHeight`(wrapContext, 2026-07-22 추가)     | 행 노드 intrinsic height                |
| M2  | 가상화 stride       | `apps/builder/.../scene/collectionVirtualization.ts` `resolveListBoxRowHeight` / `resolveGridListRowStride` | 단일 줄(getTextLineHeight) — **의도적**(ADR-157 표시 정책)   | spacer/scroll content height            |
| M3  | escape paint 스택   | `packages/specs/.../skiaPrimitives.ts` `listBoxItem` / `gridListCard`                                       | `measureSpecWrappedTextHeight`(주입 측정기, 2026-07-22 추가) | 그리기 좌표(stackY)·카드 높이·배경 밴드 |

- **M1/M2 는 이미 layout-util 함수 공유**: `resolveListBoxItemRowHeightFromStyle`(utils.ts:351) 단일 정의를 §1.55b-2(utils.ts:2475)와 가상화 stride(collectionVirtualization.ts:274)가 함께 호출. M1 은 wrapContext 로 wrap, M2 는 wrapContext 미전달 = 단일 줄(ADR-157 표시 정책).
- **layout-util(M1/M2) ↔ escape(M3) 이중화가 핵심**: escape 는 패키지 경계(specs ← shared ← builder)로 layout-util 을 import 할 수 없어 `measureSpecWrappedTextHeight`(packages/specs)로 **재측정**. 폰트 fallback·weight·lineHeight·maxWidth 산출을 layout-util 과 별도로 재현 → 미세 어긋남이 곧 parity 버그.
- **M2(가상화 stride)는 이원화 유지 대상**: 단일 줄 균일이 ADR-157 표시 정책. 본 ADR 의 SSOT 단일화 범위에서 **제외**(경계). 본 ADR 은 **렌더 행(M1)과 escape(M3)의 측정 소스 통일**만 다룬다.

## §3. Decision(D+C) 구현 — Phase 분해

### Phase 0 — 인벤토리 freeze + 계약 테스트 baseline

- §2 표를 코드 실측으로 확정(심볼·라인 고정). layout-util(M1/M2)과 escape(M3)가 각자 호출하는 측정 함수 인자(fontSize/weight/family/maxWidth/lineHeight) 대조표 작성.
- 현재 라이브 실측값(70da5ae3 ListBox 인스턴스 ba6a3aec) 을 baseline 으로 기록 — Phase 3 후 무변경(BC) 대조 기준.

### Phase 1 — layout-util 측정 함수 metric 객체화 (측정 로직 SSOT 유지)

- `resolveListBoxItemRowHeightFromStyle`(utils.ts:351)가 현재 **행 높이(number)만** 반환한다. 이를 **행 metric 객체**로 확장:
  ```
  { rowHeight, slotBlocks: { label: {height, y}, description?: {height, y} }, contentTop }
  ```
  (`y` = 행 좌표계 내 각 slot 텍스트 top; escape 스택 offset SSOT)
- GridList §1.55b2 인라인 공식도 동일 metric 반환 헬퍼로 추출(현재 인라인 → 공용 함수).
- 측정 로직 SSOT 는 이 함수 하나(폰트 fallback/weight/lineHeight/maxWidth 산출 집약). **주의**: 측정 로직은 이미 M1/M2 가 공유 중이며, 본 Phase 는 반환 형태만 metric 객체로 넓힌다 — 새 SSOT 를 만드는 게 아니다.

### Phase 2 — buildSpecNodeData 산출 + projection 행 props 주입 (측정 주체 확정)

- **측정 주체 = `buildSpecNodeData`**(layout 이후, escape 직전). scene projection 시점(layout 前)엔 `style.width` 가 `%`/`calc` 라 정확한 wrap 폭(px)을 모른다 — 반면 `buildSpecNodeData` 는 width injection(layout `w` → `style.width`, `buildSpecNodeData.ts:1514`)이 **이미 실제 카드 폭을 확정한 시점**이다.
- 따라서 `buildSpecNodeData` 가 확정된 `style.width` 로 Phase 1 layout-util metric 함수를 호출해 `_slotMetrics` 를 산출하고 escape props 에 주입한다. `_slots` / `_projectedRowsContentHeight` 주입 선례와 동일 props 경로, 단 **주입 시점은 scene 이 아니라 buildSpecNodeData**(폭 확정 보장).
- **주의(측정 주체 재검토 사항)**: `appendListBoxRowProjection`(canvasSceneNode, scene 시점)에서 주입하는 대안은 폭 미정으로 배제. Phase 0 에서 buildSpecNodeData 시점에 카드 폭·slot 구성·텍스트가 모두 확정돼 있는지 실측 확인 후 진입.

### Phase 3 — M1·escape 소비 전환 (재측정 제거)

- escape(`listBoxItem` / `gridListCard`, skiaPrimitives.ts)가 `props._slotMetrics` 존재 시 **자체 `measureSpecWrappedTextHeight` 호출을 skip** 하고 주입값(slotBlocks.height / y)으로 stackY·카드 높이·배경 밴드를 그린다.
- layout 렌더 행(M1 §1.55b-2, utils.ts:2475)도 `_slotMetrics` 존재 시 이를 소비하도록 전환 — **렌더 행당 측정 1회**(buildSpecNodeData 산출) 수렴 성립. 미전환 시 scene 신규 측정 + M1 자체 측정 = 2회 유지(성능 개선 무효).
- `_slotMetrics` 부재(legacy/비-projection) → escape 자체 측정 fallback(BC — 주입 측정기 경로 유지, escape 에 `measureSpecWrappedTextHeight` 잔존).
- 결과: 측정 산출 주체 = `buildSpecNodeData`, M1·escape = 소비자.

### Phase 4 — differential 계약 테스트 (C)

- `layout 행 height == escape 카드/행 height == CSS DOM 행 height` 3자 일치를 검증하는 계약 테스트.
- ADR-156 engine-css-parity differential oracle 선례(실 Chrome `getBoundingClientRect` ground truth) 준용 — 가능하면 브라우저 하니스, 최소는 M1/M3 동일 입력 → 동일 출력 단위 검증.
- **가상화 stride(M2)는 검증 대상 제외**(단일 줄 유지가 정상 계약, 157).

### Phase 5 — 회귀 검증 + closure

- 2026-07-22 5건(width `1506f237b` / gap `fc69a3c1e` / 행높이 `bc2c0ebd2` / 컨테이너동결 `0821da280` / 겹침 `a52a91905` + GridList `cb04c922c`) 재현 안 됨 라이브 확인.
- ListBox(라이브 재현 가능) + GridList(컨테이너 배치 후) 각 1회 exercise.

## §4. 파일 변경 예상

| 파일                                         | Phase | 변경                                                                                  |
| -------------------------------------------- | ----- | ------------------------------------------------------------------------------------- |
| `apps/builder/.../layout/engines/utils.ts`   | 1     | `resolveListBoxItemRowHeightFromStyle` metric 객체 반환 + GridList 공용 헬퍼 추출     |
| `apps/builder/.../skia/buildSpecNodeData.ts` | 2     | 확정 `style.width` 로 metric 산출 → `_slotMetrics` 주입 (측정 주체, 폭 확정 시점)     |
| `packages/specs/.../skiaPrimitives.ts`       | 3     | `listBoxItem`/`gridListCard` `_slotMetrics` 소비 + 재측정 skip (fallback 분기만 잔존) |
| `apps/builder/.../layout/engines/utils.ts`   | 3     | §1.55b-2 가 `_slotMetrics` 소비 전환 (측정 1회 수렴 — 미전환 시 2회 유지)             |
| `apps/builder/.../__tests__/*`               | 4     | differential 계약 테스트 신규                                                         |
| (회귀 테스트)                                | 5     | 기존 5건 재현 가드 유지                                                               |

## §5. 체크리스트

- [ ] Phase 0: layout-util(M1/M2) ↔ escape(M3) 측정 인자 대조표 + baseline 라이브값 기록 + buildSpecNodeData 시점 폭·slot·텍스트 확정 여부 실측
- [ ] Phase 1: layout-util metric 객체 반환 + GridList 헬퍼 추출, 단위 테스트
- [ ] Phase 2: buildSpecNodeData 가 확정 `style.width` 로 metric 산출 → `_slotMetrics` 주입, 폭 정확성 테스트
- [ ] Phase 3: escape 소비 + 재측정 skip(fallback 분기만 잔존) + M1 §1.55b-2 소비 전환, `_slotMetrics` 부재 fallback(BC) 테스트
- [ ] Phase 4: differential 계약 테스트(layout==escape==CSS)
- [ ] Phase 5: 5건 회귀 재현 안 됨 라이브 + type-check baseline + cross-check
- [ ] ADR-157 표시 정책(가상화 stride M2 단일 줄) 무변경 확인
- [ ] 측정 1회 수렴 확인 (buildSpecNodeData 산출, M1·escape 소비 — 2회 유지 아님)
- [ ] BC: Phase 0 baseline 대비 렌더값 무변경(측정 경로만 통일, 값 동일)
