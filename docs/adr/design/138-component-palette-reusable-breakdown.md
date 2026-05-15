# ADR-138 구현 상세 — 컴포넌트 패널 복합 컴포넌트 reusable origin-instance 부착

> 본 문서는 [ADR-138](../138-component-palette-reusable.md) 의 구현 상세 (Phase / 파일 변경 / 시나리오 / 체크리스트). ADR 본문은 결정·위험·게이트만 담는다.

## 1. Framing checkpoint

### base / 응용 분류

- **base ADR**: ADR-116 (canonical reusable schema — `reusable: true` + `type: "ref"` + `descendants[path]` 3-mode override) + ADR-130 (frame canonical vocabulary).
- **응용 ADR (본 ADR)**: base schema 를 **검증·일반화** + 사용자 진입점/fork UX 보강. canonical schema 변경 0.
- 본 ADR 은 base schema 의 specialization 이 아니라 **검증 응용** — base schema 가 Frame 외 복합 컴포넌트 (Tabs / Card) 에서 작동하는지 end-to-end 확증한다.

### fork 여부

본 ADR 은 기존 ADR 의 잔여 영역 분리(fork)가 아니다 — brainstorming (2026-05-14~15, Google Stitch / Pencil app 벤치마크) 에서 도출된 신규 기능 ADR. `adr-writing.md` 의 fork checkpoint 4 질문은 비대상. 단 base (ADR-116/130) 의존 방향은 명시: base → 본 ADR (본 ADR 이 base schema 의 후속 검증).

### scope 추정 vs 실측

- design 추정: 신규 4 파일 + 수정 3-4 파일 = 7-8 파일. 신규 LOC ~500-700 (test 포함), 수정 ~100-150.
- Phase 0 inventory 에서 실측 확정. 추정 대비 1.5x 초과 시 `adr-writing.md` M4 절차 (사용자 confirm) 적용.

## 2. Phase 분해

### Phase 0 — inventory freeze

- `instanceActions.ts` / `instanceResolver.ts` / `ComponentSemanticsSection.tsx` 의 실제 함수 시그니처·라인 확정.
- Tabs / Card spec 의 `slot` 정의, `props.items` 직렬화 구조 (ADR-066) 확인.
- 추정 7-8 파일 대비 실측 비교. gap 1.5x 초과 시 사용자 surface.

### Phase 1 — A-1 검증 (Tabs primary + Card baseline)

- `reusableTabs.scenarios.test.ts` 신규 — 8 dynamic 시나리오 (§4).
- `reusableCard.scenarios.test.ts` 신규 — slot baseline 3 검증.
- `hasItemsOverride(instance, origin)` helper 를 `instanceActions.ts` 에 추가 (fork 감지 SSOT).
- Chrome MCP runtime 5 시나리오 통과.
- 위험: LOW (schema 변경 없음, test + helper 추가).

### Phase 2 — A-2 진입점 UX

- `AddAsComponentMenu.tsx` 신규 — layer panel / palette 우클릭 context menu. element → origin promote 1-step.
- `ComponentList.tsx` (또는 layer panel) 에 menu hook.
- 기존 `toggleComponentOrigin()` 호출만 — schema 미변경.
- 위험: LOW.

### Phase 3 — A-3 fork UX

- `InstanceForkBadge.tsx` 신규 — instance + items override 감지 시 "items forked" badge + [Reset to origin] + [Detach instance].
- `ComponentSemanticsSection.tsx` (line 110 근처) 에 badge 통합.
- `instanceActions.ts` 에 items reset action (기존 `resetInstanceOverrideField()` 활용).
- 위험: LOW-MED (UX 발견성).

### Phase 4 (후속 ADR — 본 ADR scope 외) — A-4 잔여 type sweep

- Tabs / Card 통과 후 잔여 ComponentTag 전수 검증 (`parallel-verify` skill). collection items 가진 5-7 type (Select / ComboBox / Toolbar / Menu / GridList / ListBox / Tree) 이 주위험.
- 본 ADR 은 A-1~A-3 만 land. A-4 는 검증 통과 후 별도 발의.

## 3. 파일 변경

### 신규 파일

| 경로                                                                           | 역할                               | Phase |
| ------------------------------------------------------------------------------ | ---------------------------------- | ----- |
| `apps/builder/src/adapters/canonical/__tests__/reusableTabs.scenarios.test.ts` | A-1 Tabs 8 dynamic 시나리오 vitest | 1     |
| `apps/builder/src/adapters/canonical/__tests__/reusableCard.scenarios.test.ts` | A-1 Card slot baseline             | 1     |
| `apps/builder/src/builder/panels/components/AddAsComponentMenu.tsx` (가칭)     | A-2 우클릭 context menu            | 2     |
| `apps/builder/src/builder/panels/properties/InstanceForkBadge.tsx` (가칭)      | A-3 fork 표시 + reset/detach       | 3     |

### 수정 파일

| 경로                                                                              | 변경                                                             | Phase |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----- |
| `apps/builder/src/builder/stores/utils/instanceActions.ts`                        | `hasItemsOverride(instance, origin)` helper + items reset action | 1·3   |
| `apps/builder/src/builder/panels/components/ComponentList.tsx` (또는 layer panel) | 우클릭 → `AddAsComponentMenu` hook                               | 2     |
| `apps/builder/src/builder/panels/properties/ComponentSemanticsSection.tsx`        | `InstanceForkBadge` 통합 (line 110 근처)                         | 3     |
| `docs/superpowers/specs/2026-05-15-component-palette-reusable-design.md`          | brainstorming design 결과 보존 (선택)                            | —     |

### 변경 없음 (기존 모듈 활용)

| 모듈                                                                                                   | 활용 형태                                    |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `instanceResolver.ts` + `mergePropsWithStyleDeep()`                                                    | origin → instance prop merge 로직 그대로     |
| `instanceActions.createInstance / detachInstance / resetInstanceOverrideField / toggleComponentOrigin` | 함수 호출만 — UX layer 만 신규               |
| `canonicalMutations.ts`                                                                                | schema 변경 없음 — set/upsert primitive 호출 |
| 시각 마커 layer (Skia overlay)                                                                         | ADR-112 G4-A 그대로                          |
| `Cmd+Opt+K` / `Cmd+Opt+X` 단축키                                                                       | 그대로                                       |
| `packages/specs` Tabs.spec / Card.spec                                                                 | 변경 없음                                    |
| `packages/shared` canonical schema (`CompositionDocument` / `RefNode` / `DescendantOverride`)          | 변경 없음                                    |

## 4. 8 dynamic 시나리오 (`reusableTabs.scenarios.test.ts`)

각 test 는 **canonical document fixture → mutation → `resolveCanonicalRefProps` 결과 검증** 구조.

| #   | setup                                                   | act                                                     | assert                                                        |
| --- | ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | origin Tabs (items 3) + instance ref ×2 (override 없음) | origin `props.items` 에 tab push                        | 두 instance resolved items 모두 4개                           |
| 2   | origin + instance ref ×2                                | instance A `props.items` 1개 label override             | A 만 forked, B + origin 무영향. `hasItemsOverride(A)` true    |
| 3   | origin + instance ref                                   | instance `props.items` 에 tab 추가 (배열 전체 override) | shallow fork — origin 변경 미반영 (시나리오 2 와 동일 경로)   |
| 4   | origin (items 4) + fork instance + 미-fork instance     | origin items 에서 tab 1개 삭제                          | fork instance 4개 유지 / 미-fork instance 3개                 |
| 5   | origin + instance ref ×N (일부 fork)                    | origin items 변경                                       | impact 계산이 fork / 미-fork 정확 분류                        |
| 6   | origin + instance ref ×2                                | origin items 변경 → `undo()`                            | 모든 instance resolved items 변경 전 복원, `redo()` 시 재반영 |
| 7   | origin + instance 생성                                  | IndexedDB persist → canonical re-hydrate                | `reusable: true` / `type: "ref"` / `descendants` 전부 복원    |
| 8   | Card origin 안에 Tabs origin 중첩                       | 바깥 Card instance 생성                                 | 내부 Tabs origin 관계가 instance 에서도 resolve               |

`reusableCard.scenarios.test.ts` — slot baseline 3:

| 검증               | 내용                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ |
| slot 인식          | Card 의 `slot: string[]` (header / body / footer) origin 등록 시 보존                      |
| slot fill          | instance 가 특정 slot 에만 `descendants[slotPath].children` 추가 → 다른 slot origin 그대로 |
| slot override 격리 | instance A 의 header slot 변경이 instance B 무영향                                         |

## 5. fork 감지 helper (신규)

```ts
// instanceActions.ts 에 추가
function hasItemsOverride(
  instance: CanonicalRefNode,
  origin: CanonicalNode,
): boolean {
  if (!instance.props || instance.props.items === undefined) return false;
  return !deepEqual(instance.props.items, origin.props?.items);
}
```

`InstanceForkBadge` 표시 조건의 SSOT. v1 은 `items` 만 (Tabs 핵심) — 다른 prop fork 는 후속 ADR.

## 6. Verification gate (A-1~A-3 land 조건)

| Gate        | 통과 조건                                                         |
| ----------- | ----------------------------------------------------------------- |
| vitest      | `reusableTabs.scenarios` 8 + `reusableCard.scenarios` 3 전부 PASS |
| type-check  | baseline 유지, new violation 0                                    |
| Chrome MCP  | 5 dynamic 시나리오 runtime 통과                                   |
| cross-check | Tabs / Card origin-instance Skia↔CSS 시각 대칭                    |

## 7. 체크리스트

- [ ] Phase 0 inventory — 추정 7-8 파일 vs 실측 비교 (1.5x 초과 시 사용자 surface)
- [ ] Phase 1 — 8+3 시나리오 vitest 작성 + `hasItemsOverride` helper
- [ ] Phase 1 — Chrome MCP runtime 5 시나리오
- [ ] Phase 2 — `AddAsComponentMenu` + ComponentList hook
- [ ] Phase 3 — `InstanceForkBadge` + ComponentSemanticsSection 통합 + items reset action
- [ ] Verification gate 4종 통과
- [ ] CHANGELOG `### Features` 반영 (Phase 3 최종 커밋)
- [ ] README.md ADR-138 Status 갱신
