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

동일한 "행 텍스트 높이"를 계산하는 지점이 현재 **3곳**에 분산되어 있다. 이 중복이 근본 원인이다.

| #   | 지점                | 파일                                                                                                        | 현재 측정 방식                                               | 소비 대상                               |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| M1  | layout 렌더 행 공식 | `apps/builder/.../layout/engines/utils.ts` §1.55b-2(ListBox) / §1.55b2(GridList)                            | `measureWrappedTextHeight`(wrapContext, 2026-07-22 추가)     | 행 노드 intrinsic height                |
| M2  | 가상화 stride       | `apps/builder/.../scene/collectionVirtualization.ts` `resolveListBoxRowHeight` / `resolveGridListRowStride` | 단일 줄(getTextLineHeight) — **의도적**(ADR-157 표시 정책)   | spacer/scroll content height            |
| M3  | escape paint 스택   | `packages/specs/.../skiaPrimitives.ts` `listBoxItem` / `gridListCard`                                       | `measureSpecWrappedTextHeight`(주입 측정기, 2026-07-22 추가) | 그리기 좌표(stackY)·카드 높이·배경 밴드 |

- **M1 ↔ M3 중복이 핵심**: 둘 다 wrap 높이를 각자 측정(measureWrappedTextHeight ↔ measureSpecWrappedTextHeight). 폰트 fallback·weight·lineHeight·maxWidth 산출을 각각 재현 → 미세 어긋남이 곧 parity 버그.
- **M2 는 이원화 유지 대상**: 가상화 stride 는 단일 줄 균일이 ADR-157 표시 정책. 본 ADR 의 SSOT 단일화 범위에서 **제외**(경계).

## §3. Decision(D+C) 구현 — Phase 분해

### Phase 0 — 인벤토리 freeze + 계약 테스트 baseline

- §2 표를 코드 실측으로 확정(심볼·라인 고정). M1/M3 이 각자 호출하는 측정 함수 인자(fontSize/weight/family/maxWidth/lineHeight) 대조표 작성.
- 현재 라이브 실측값(70da5ae3 ListBox 인스턴스 ba6a3aec) 을 baseline 으로 기록 — Phase 3 후 무변경(BC) 대조 기준.

### Phase 1 — layout 측정 SSOT 확립 (M1 확장)

- `resolveListBoxItemRowHeightFromStyle`(utils.ts)가 현재 **행 높이(number)만** 반환한다. 이를 **행 metric 객체**로 확장:
  ```
  { rowHeight, slotBlocks: { label: {height, y}, description?: {height, y} }, contentTop }
  ```
  (`y` = 행 좌표계 내 각 slot 텍스트 top; escape 스택 offset SSOT)
- GridList §1.55b2 인라인 공식도 동일 metric 반환 헬퍼로 추출(현재 인라인 → 공용 함수).
- **측정 1회**: 폰트 fallback/weight/lineHeight/maxWidth 산출을 이 함수 안으로 집약. M3 는 재산출하지 않는다.

### Phase 2 — projection 행 props 주입 (배선)

- `appendListBoxRowProjection` / `appendGridListRowProjection`(canvasSceneNode.ts)이 Phase 1 metric 을 계산해 행 props `_slotMetrics` 로 주입.
- 기존 `_slots` / `_projectedRowsContentHeight` 주입 선례와 동일 경로 — 주입 타이밍(scene 빌드)·소비 타이밍(buildSpecNodeData → escape) 보장.
- 카드 폭(maxWidth) 은 buildSpecNodeData width injection(layout `w` → style.width)과 동일 값 사용 — 측정 폭 정합.

### Phase 3 — escape 소비 (M3 재측정 제거)

- `listBoxItem` / `gridListCard`(skiaPrimitives.ts)가 `props._slotMetrics` 존재 시 **자체 `measureSpecWrappedTextHeight` 호출을 skip** 하고 주입값(slotBlocks.height / y)으로 stackY·카드 높이·배경 밴드를 그린다.
- `_slotMetrics` 부재(legacy/비-projection) → 기존 자체 측정 fallback(BC — 주입 측정기 경로 유지).
- 결과: 측정 SSOT = M1(layout), M3 = 소비자.

### Phase 4 — differential 계약 테스트 (C)

- `layout 행 height == escape 카드/행 height == CSS DOM 행 height` 3자 일치를 검증하는 계약 테스트.
- ADR-156 engine-css-parity differential oracle 선례(실 Chrome `getBoundingClientRect` ground truth) 준용 — 가능하면 브라우저 하니스, 최소는 M1/M3 동일 입력 → 동일 출력 단위 검증.
- **가상화 stride(M2)는 검증 대상 제외**(단일 줄 유지가 정상 계약, 157).

### Phase 5 — 회귀 검증 + closure

- 2026-07-22 5건(width `1506f237b` / gap `fc69a3c1e` / 행높이 `bc2c0ebd2` / 컨테이너동결 `0821da280` / 겹침 `a52a91905` + GridList `cb04c922c`) 재현 안 됨 라이브 확인.
- ListBox(라이브 재현 가능) + GridList(컨테이너 배치 후) 각 1회 exercise.

## §4. 파일 변경 예상

| 파일                                        | Phase | 변경                                                                              |
| ------------------------------------------- | ----- | --------------------------------------------------------------------------------- |
| `apps/builder/.../layout/engines/utils.ts`  | 1     | `resolveListBoxItemRowHeightFromStyle` metric 객체 반환 + GridList 공용 헬퍼 추출 |
| `apps/builder/.../scene/canvasSceneNode.ts` | 2     | `appendListBoxRowProjection`/`appendGridListRowProjection` `_slotMetrics` 주입    |
| `packages/specs/.../skiaPrimitives.ts`      | 3     | `listBoxItem`/`gridListCard` `_slotMetrics` 소비 + 재측정 skip                    |
| `apps/builder/.../__tests__/*`              | 4     | differential 계약 테스트 신규                                                     |
| (회귀 테스트)                               | 5     | 기존 5건 재현 가드 유지                                                           |

## §5. 체크리스트

- [ ] Phase 0: M1/M3 측정 인자 대조표 + baseline 라이브값 기록
- [ ] Phase 1: layout metric 객체 반환 + GridList 헬퍼 추출, 단위 테스트
- [ ] Phase 2: projection `_slotMetrics` 주입, 주입 타이밍 테스트
- [ ] Phase 3: escape 소비 + 재측정 skip, `_slotMetrics` 부재 fallback(BC) 테스트
- [ ] Phase 4: differential 계약 테스트(layout==escape==CSS)
- [ ] Phase 5: 5건 회귀 재현 안 됨 라이브 + type-check baseline + cross-check
- [ ] ADR-157 표시 정책(가상화 stride 단일 줄) 무변경 확인
- [ ] BC: Phase 0 baseline 대비 렌더값 무변경(측정 SSOT 경유만, 값 동일)
