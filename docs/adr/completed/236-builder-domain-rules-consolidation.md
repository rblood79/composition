# ADR-236: 빌더 도메인 규칙 정리 — 술어 모듈 · 타입 특성 표 · store 액션 진입부 강제

## Status

Implemented — 2026-09-25 (Phase 0–4 · G0–G4 — [종결 기록](../design/236-builder-domain-rules-consolidation-breakdown.md#12-phase-4--종결-기록-2026-09-25)) · Accepted — 2026-09-24 (사용자 `/execute-adr 236`, review round 2 이슈 0) · Phase 0 완료 (G0 PASS) · Phase 1 완료 2026-09-25 (G1 PASS — [breakdown §9](../design/236-builder-domain-rules-consolidation-breakdown.md#9-phase-1-기록)) · Phase 2 완료 2026-09-25 (G2 PASS — [breakdown §10](../design/236-builder-domain-rules-consolidation-breakdown.md#10-phase-2-기록)) · Phase 3 완료 2026-09-25 (G3 · G4 PASS — [breakdown §11](../design/236-builder-domain-rules-consolidation-breakdown.md#11-phase-3-기록)) · Phase 4 종결 2026-09-25

## Context

### 문제

`apps/builder/src` 의 도메인 규칙 (무엇이 무엇을 담는가 · 누가 무엇을 편집할 수 있는가 · 타입별 특성) 에는 정해진 거처가 없다. catalog (`COMPONENT_RULES_TABLE`) 는 시각 토큰만 담고, 나머지는 손으로 쓴 집합과 `type === "X"` 분기로 흩어져 있다. 같은 판정의 헬퍼가 있어도 층마다 따로 있다. 규칙을 강제하는 곳도 store 가 아니라 각 UI 표면이라, 표면마다 판정이 갈린다.

2026-09-24 실측 (테스트 제외):

| 축                                   | 수치 · 위치                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new Set([` 로 선언한 타입 집합 상수 | 125개. 같은 사실을 다시 적은 예: 컬렉션 · 목록 — `preview/components/CanonicalNodeRenderer.tsx:170,192` · `builder/panels/properties/FrameSlotSection.tsx:86` · `adapters/canonical/canonicalRefResolution.ts:1203,1358` · shared `catalog/nesting/nestingRules.ts:78`                                                                                                                                           |
| 구조 컨테이너 집합                   | `workspace/canvas/selection/dropTargetResolver.ts:132` · `services/ai/catalog/componentCatalog.ts:57` · `workspace/canvas/skia/buildSpecNodeData.ts:209` · `presentation/editorPresentationSpacingCapability.ts:199`                                                                                                                                                                                             |
| 텍스트 호스트 집합                   | `workspace/canvas/hooks/useCanvasElementSelectionHandlers.ts:52` · `workspace/overlay/useTextEdit.ts:84` · `utils/hierarchicalSelection.ts:65` · `presentation/editorPresentationTextColor.ts:10`                                                                                                                                                                                                                |
| body 판정                            | 타입 문자열 직접 비교 78행 (`"body"` · `"Body"` · `toLowerCase()` 혼재) + 공용 헬퍼 없이 파일마다 따로 둔 로컬 헬퍼 8개 이상 — `adapters/canonical/pageFrameBinding.ts:206,210` · `projectPageFrameTree.ts:49` · `frameElementScope.ts:33` · `workspace/canvas/selection/dropTargetResolver.ts:228` · `scene/resolvePageWithFrame.ts:65` · `stores/utils/elementIndexer.ts:210` · `utils/multiElementCopy.ts:53` |
| synthetic id 파싱                    | 헬퍼 `stores/canonical/syntheticDescendantLookup.ts` 가 있는데도 `adapters/canonical/editingSemantics.ts:146` (`split("/")`) · `workspace/canvas/renderers/rendererInput.ts:295` (`indexOf("/")`) 가 직접 파싱                                                                                                                                                                                                   |
| Components 페이지 판정               | 직접 비교는 0건이지만 입력 형태별 헬퍼가 3개로 갈린다 — `builder/pages/systemComponentsPage.ts:86` `isComponentsPageMirror` · `builder/panels/properties/componentsPageFields.ts:11` `isComponentsPageNode` · shared `utils/export.utils.ts:233` `isComponentsPageMetadata` (호출 21곳)                                                                                                                          |
| catalog 에서 파생되는 구조 규칙      | 0. `nestingRules.ts` 도 손으로 쓴 표                                                                                                                                                                                                                                                                                                                                                                             |

표면별 강제의 실제 결과 — 선행 `/fix` 7건 (2026-09-23~24) 이 전부 이 구조에서 나왔다:

- Layers 이동이 중첩 규칙을 우회 (canonical 은 거부 · legacy fallback 이 `parent_id` 변경, 수리 후 `stores/elements.ts:1729-1738`) · 그룹이 중첩 검사 생략 — 결함 1 · 3.
- 삭제는 system origin 을 막는데 "컴포넌트 분리" 는 안 막음 (`elementRemoval.ts` vs `instanceActions.ts`) — B-2.
- instance 안 자식에 메뉴는 삭제 · 복제를 노출하는데 Layers 는 막음, 복제는 자식을 두 벌로 만듦 — B-3.
- origin 영향 확인이 쓰기 경로 3곳에만 있음 (Styles 패널 · batch 경로는 없음) — B-4.
- 영향 게이트가 role 우선순위 함수로 판정해 ADR-234 의 dual 노드를 놓침 — B-1.

각 수리는 표면 하나를 맞췄을 뿐이라, 다음 표면이나 다음 ADR 이 같은 사실을 또 적으면 다시 갈린다. ADR-234 는 진행 중에 집합 3개 (`DISABLING_GROUP_TYPES` · `SELECTION_FLAG_ITEM_TYPES` · `SELF_LIST_OWNER_TYPES`) 를 새로 더했다.

### SSOT 도메인

이 ADR 은 D1 · D2 · D3 어느 것도 새로 정의하지 않는다. 대상은 **편집기 도메인 규칙** (구조 · 편집 권한 · 타입 분류) 이다.

- 자식 계약 (Tabs → TabList · TabPanel 등) 은 RAC 구성 (D1) 의 **관찰값**을 적은 것이다. DOM 구조를 지정하지 않는다.
- 특성 표는 catalog (D3) 밖에 둔다 — catalog 를 시각 정본으로만 유지한다.

### Hard constraints

- Phase 1 · 2 는 동작 변경 0 — builder 패키지 스위트 실패 집합이 전후 같다.
- 문서 저장 형식 변경 0 — 재직렬화 대상 프로젝트 0% (규칙은 코드 데이터이고 canonical 노드에 필드를 더하지 않는다).
- initial 번들 상한 = ADR-201 (Builder ≤ 1,415,000 B · Preview ≤ 622,000 B, 만료 2026-10-25 — 2026-09-25 재승인).
- `canX` 는 선택 변경마다 불린다 — `canX` 자체 비용 (perf 라벨) 이 호출당 p95 ≤ 0.1 ms · 선택 변경당 합 ≤ 1 ms (선택 600 문서). 전체 선택 · 편집 lane 은 회귀 확인용 (run 편차 병기).
- ADR-184 러너 계약 (canonical → set → rebuild → history → persist) 과 기존 경로 allowlist (`adapters/canonical/__tests__/canonicalMutationRunner.static.test.ts:40`, 이관 비스코프) · ADR-234 의 ref 체인 모델은 바꾸지 않는다. 구조 변경 쓰기 대부분 (`updateElementProps` · `removeElement` · `moveElementToContainer` · `batchUpdateElementProps` · inspector `updateAndSave`) 이 이 allowlist 경로라 러너 한 곳에 가드를 두면 닿지 않는다.

### Soft constraints

- 병렬 세션이 main 에서 다른 ADR (235 저장 형식) 을 진행 중 — 파일은 겹치지 않지만 worktree 로 격리한다.
- layout · skia 의 타입 분기 (타입 이름 분기의 약 60%) 는 parity 위험이 커서 일괄로 옮길 수 없다.

### 범위 기준 — 멤버십 vs 렌더 동작

- **파생 대상 (멤버십)**: 집합이 "이 타입이 무엇인가" (필드 패밀리 · 텍스트 호스트 · 컨테이너 종류 · 목록 owner) 만 말하는 경우. 선언 파일이 skia · layout · presentation 안에 있어도 대상이다 — 멤버십 선언만 표 파생으로 바꾸고 그 집합을 쓰는 분기 코드는 그대로 둔다.
- **상시 규칙 (렌더 동작)**: 분기가 "어떻게 재고 그리는가" (측정 · 크기 주입 · shape 합성 값) 를 정하는 경우. 이 ADR 에서 옮기지 않는다.
- skia · layout 소비처의 멤버십 파생은 동등성 테스트에 더해 해당 컴포넌트의 Skia 픽셀 · layout rect 무변경을 확인한다.

## Alternatives Considered

### 대안 A: 현 구조 유지 + 재구현 금지 ratchet 만

- 설명: 표 · 술어 모듈을 새로 두지 않고, 새 집합 · 직접 비교가 늘지 않게 정적 테스트만 둔다. 결함은 지금처럼 표면별 `/fix` 로 고친다.
- 근거: 큰 코드베이스의 lint 기반 "더 나빠지지 않게" 전략 (ESLint `no-restricted-syntax` ratchet 류).
- 위험: 기술(L) / 성능(L) / 유지보수(**H**) / 마이그레이션(L)
  - 유지보수 H: 이미 있는 125개 · 78행은 그대로이고, 표면마다 강제하는 구조가 남아 B 묶음과 같은 불일치가 계속 나온다.

### 대안 B: catalog 엔트리에 비시각 facet 추가

- 설명: `COMPONENT_RULES_TABLE` 엔트리에 `domain: { container, children, families, editing }` 을 더하고 집합을 여기서 파생한다.
- 근거: 컴포넌트 하나의 사실을 한 파일에 모으는 방식 (Pencil 의 컴포넌트 정의 · Spectrum design-data 의 component 스키마가 구조와 시각을 같이 담는다).
- 위험: 기술(M) / 성능(L) / 유지보수(**H**) / 마이그레이션(M)
  - 유지보수 H: D3 SSOT 에 D3 가 아닌 정보가 섞여 `ssot-hierarchy.md §1` 경계가 바뀐다. catalog 는 ADR-912 로 freeze 뒤 직접 편집 정본이라 편집 규칙 변경이 시각 정본 편집과 같은 파일 · 같은 리뷰에 묶인다. 잔존 spec 3개 (Frame · Group · Slot) 는 catalog 밖이라 표가 두 곳으로 갈린다.

### 대안 C: builder 안에만 특성 표 · 술어 모듈

- 설명: `apps/builder/src` 안 (예: `adapters/canonical/` 옆) 에 표와 술어를 둔다.
- 위험: 기술(L) / 성능(L) / 유지보수(M) / 마이그레이션(L)
  - 유지보수 M: preview · publish · shared `nestingRules` 가 읽을 수 없다. preview 의 `CanonicalNodeRenderer.tsx:170,192` 와 shared 의 중첩 표가 계속 따로 적는다.

### 대안 D: shared domain 특성 표 + 술어 모듈 + store 액션 진입부 강제 (Phase 분할)

- 설명: Phase 1 — 술어를 모듈 하나로 (기존 `editingSemantics` 확장, 순수 타입 판정은 shared) + 재구현 ratchet. Phase 2 — `packages/shared` 에 타입 특성 표, 중복 집합과 `nestingRules` 의 겹치는 집합을 파생. Phase 3 — `canX()` 와 `resolveMoveTarget(op, policy)` 로 모든 표면 (메뉴 · 액션 바 · 단축키 · Layers · 팔레트 · 붙여넣기 · AI) 판정을 하나로. mutation 쪽은 구조 변경 store 액션 목록을 고정하고, 각 액션 진입부가 같은 `canX` 를 부르는지 정적 테스트로 막는다 (러너 이관 없음).
- 근거: 편집기 명령 모델의 "can-execute + execute 한 쌍" (VS Code command `enablement` 와 실행이 같은 when-clause 를 읽는 방식 · ProseMirror `command(state)` 가 dispatch 없이 호출되면 가능 여부만 돌려주는 방식).
- 위험: 기술(M) / 성능(M) / 유지보수(L) / 마이그레이션(**H**)
  - 마이그레이션 H: Phase 2 파생 집합이 옛 집합과 한 타입이라도 다르면 canvas · preview 동작이 조용히 바뀐다. Phase 3 은 표면마다 다른 판정 (AI 도구의 대소문자 구분 body 판정 · 붙여넣기의 가까운 조상 재배치 vs Layers 의 거부) 을 `canX` 하나로 모으므로, 어느 쪽으로 합치든 한쪽 흐름의 동작이 바뀐다.
  - 성능 M: `canX` 가 선택 변경 경로에 들어간다.

### Risk Threshold Check

| 대안 | HIGH+          | 판정                                                                                             |
| ---- | -------------- | ------------------------------------------------------------------------------------------------ |
| A    | 유지보수 H     | 구조 결함을 그대로 둔다 — 문제 정의를 풀지 못함                                                  |
| B    | 유지보수 H     | SSOT 경계 변경 — 회피 가능한 위험 (C · D 가 경계를 안 바꾼다)                                    |
| C    | 없음           | 위험은 낮지만 preview · shared 중복이 남는다                                                     |
| D    | 마이그레이션 H | 게이트로 관리 가능 — 동등성 테스트 (Phase 2) · 원복 RED + 표면별 live (Phase 3). 루프 1회로 종료 |

모든 대안이 HIGH 인 상황은 아니다 (C 는 HIGH 없음). D 의 HIGH 는 "동작이 조용히 바뀌는" 위험이고, 옛 집합과의 동등성 · 표면별 원복 RED 로 측정 가능하므로 수용한다.

## Decision

**대안 D** 를 채택한다. 특성 표는 `packages/shared` 의 별도 domain 모듈에 둔다 (catalog 에 넣지 않는다).

- 위험 수용 근거: D 의 마이그레이션 H 는 두 종류로 나뉘고 둘 다 측정 가능하다. (1) Phase 2 파생 집합 — 파생 커밋마다 "옛 리터럴 == 파생 결과" 테스트를 같이 넣어, 차이가 있으면 그 차이만 별도 커밋 + live 로 다룬다. (2) Phase 3 강제 — 표면별 기본 policy 를 Phase 0 표의 현행 동작으로 옮기고 (새 동작 도입이 아니다), 가드마다 원복 RED 1행 + live 1회를 둔다. 강제 지점은 러너가 아니라 구조 변경 store 액션의 진입부다 — ADR-184 가 기존 경로 이관을 범위 밖으로 둔 결정을 바꾸지 않고, 액션 목록 × `canX` 호출 ratchet 으로 빠진 액션을 잡는다. 문서 형식은 안 바뀌어 롤백은 커밋 되돌림으로 끝난다.
- 대안 C 대비: 위험은 한 단계 높지만 preview (`CanonicalNodeRenderer.tsx`) · shared (`nestingRules.ts`) · AI 카탈로그 (`componentCatalog.ts:57`) 가 같은 표를 읽어야 중복이 실제로 줄어든다.
- layout · skia 렌더 특수 분기는 이 ADR 에서 옮기지 않는다 — 그 코드를 고치는 커밋이 해당 분기를 표로 옮긴다 (상시 규칙).

기각 사유:

- A: 이미 쌓인 중복과 표면별 강제가 그대로 남는다. B 묶음 7건이 그 결과다.
- B: catalog 를 시각 정본으로만 두는 `ssot-hierarchy.md §1` 경계를 바꾼다. 잔존 spec 3개가 catalog 밖이라 표도 두 곳이 된다.
- C: preview · publish · shared 가 읽지 못해 이 ADR 의 목적 (같은 사실을 한 번만 적기) 을 절반만 이룬다.

특성 표 위치는 `packages/shared` 로 사용자가 확정했다 (2026-09-24, review round 1 뒤).

> 구현 상세: [236-builder-domain-rules-consolidation-breakdown.md](../design/236-builder-domain-rules-consolidation-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                 | 심각도 | 대응                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------- |
| R1  | 파생 집합이 옛 집합과 달라 canvas · preview 동작이 조용히 바뀐다 (예: `dropTargetResolver.ts:132` 구조 컨테이너 · `buildSpecNodeData.ts:339` 필드 상속 · `CanonicalNodeRenderer.tsx:192` 컬렉션 호스트)                                                                                                              |  HIGH  | G2 — 파생마다 동등성 테스트. 차이는 별도 커밋 + live             |
| R2  | 표면마다 다른 판정을 `canX` 하나로 합칠 때 한쪽 흐름이 막히거나 바뀐다 — AI 도구 body 판정 (`services/ai/tools/deleteElement.ts:48` 대소문자 구분 비교) · 붙여넣기 재배치 (`workspace/canvas/actions/canvasActions.ts:234` `resolveNestingAwareTarget`, 가까운 조상) vs Layers 거부 (`stores/elements.ts:1729-1738`) |  HIGH  | G3 — 표면별 기본 policy = 현행 동작 이관, 가드별 원복 RED + live |
| R7  | 새 구조 변경 store 액션이 `canX` 없이 추가되어 강제에서 빠진다 (러너 밖 allowlist 경로라 러너 가드로 못 잡는다)                                                                                                                                                                                                      |  MED   | G3 — 구조 변경 액션 목록 × 진입부 `canX` 호출 정적 테스트        |
| R3  | `canX` 가 선택 변경 경로 (메뉴 · 액션 바 매 렌더) 에 비용을 더한다                                                                                                                                                                                                                                                   |  MED   | G4 — `canX` perf 라벨 직접 측정                                  |
| R4  | shared 표가 Preview initial 번들을 키운다                                                                                                                                                                                                                                                                            |  MED   | G2 — ADR-201 상한 안                                             |
| R5  | ratchet 이 0 이 되어도 layout · skia 분기 (약 60%) 는 남아 "정리 끝" 으로 잘못 이해된다                                                                                                                                                                                                                              |  MED   | evidence 에 범위 밖 표를 두고 상시 규칙으로 명시                 |
| R6  | 전환 기간 `nestingRules.ts` 와 특성 표가 같은 사실을 두 번 적는다                                                                                                                                                                                                                                                    |  LOW   | Phase 2 에서 겹치는 집합을 표 파생으로 바꾼다                    |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                      | 실패 시 대안                                                 |
| ---- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| G0   | Phase 0 종료 | 인벤토리 evidence (집합 · 술어 재구현 · 강제 지점 × 표면) 고정, ratchet 시작값 기록                                                                                                                                                                            | —                                                            |
| G1   | Phase 1 종료 | 술어별 직접 구현 수 = 0 (허용 목록 제외, ratchet 테스트) · builder 스위트 실패 집합 전후 동일 · type-check 0                                                                                                                                                   | 남는 곳은 허용 목록에 사유와 함께 올린다                     |
| G2   | Phase 2 종료 | 파생 집합마다 동등성 테스트 GREEN (R1) · skia · layout 소비처는 해당 컴포넌트 Skia 픽셀 · layout rect 무변경 (R1) · Builder · Preview initial 이 ADR-201 상한 안 (R4)                                                                                          | 차이는 별도 커밋 + live 로 의도 확인, 번들 초과 시 lazy 분리 |
| G3   | Phase 3 종료 | 구조 변경 store 액션 목록 × 진입부 `canX` 호출 정적 테스트 GREEN (R7) · 가드마다 원복 RED 1행 · live (Skia · store): Layers 중첩 위반 · 원본 분리 · 변형 삭제 · instance 안 요소 메뉴 · 단축키 삭제 · 위임 sub-part resize · AI body 판정 · 붙여넣기 대상 (R2) | 막힌 흐름은 해당 표면 policy 를 `nearest-ancestor` 로 조정   |
| G4   | Phase 3 종료 | `canX` perf 라벨: 호출당 p95 ≤ 0.1 ms · 선택 변경당 합 ≤ 1 ms (선택 600 문서 · 사람이 만든 문서 1개 병행 · 대조군 = 변경 전 빌드 같은 조작 · visibilityState visible) · 전체 선택 · 편집 lane 은 변경 전 대비 run 편차 안 (R3)                                 | `canX` 결과를 선택 · 문서 버전 키로 memo                     |

G0 결과 (2026-09-24): PASS — 집합 144 (파생 대상 23) · body 직접 비교 92행 + 로컬 헬퍼 12 · synthetic 직접 파싱 8행 · 강제 지점 불일치 12건 (E1~E12). 상세는 breakdown §8.

### Live Exercise

실제 builder (headed Playwright · 새 프로젝트 · Compare Mode · Preview iframe 미개방 — 사용자 지시) 에서 Skia layout · 픽셀 · store · DOM 메뉴로 확인했다 (2026-09-25). 표 전체: [breakdown §12.3](../design/236-builder-domain-rules-consolidation-breakdown.md#123-live).

- `adr236-phase2-live.mjs` (G2): Form 안 필드 · DateField · DatePicker · Image · Avatar 의 파생 전후 layout rect 차이 0/8 · Skia 픽셀 차이 0 (감도: image family 제거 시 55,380 px).
- `adr236-phase3-live.mjs` A–E (G3): ⌥⌘K body 거부 + 토스트 · system origin Backspace 거부 + 토스트 · Layers system origin 행 삭제 · origin 해제 없음 (대조군 있음) · Layers Button → ListBox 드롭 거부 (대조군 이동) · Button instance 붙여넣기 → frame 으로 옮김 + 알림.
- `adr236-phase3-repair-live.mjs` F–H (판독 수리): origin 안 Backspace · ⌘G 가 영향 확인 대화상자 → 취소 시 변화 0 · 확인 시 frame 1 + 두 Text 이동.
- `adr236-phase3-perf.mjs` (G4): 호출당 p95 ≈ 0.0003 ms · 선택 변경당 0.4 ms.
- pageerror 0. AI 도구 판정 · 위임 sub-part resize 는 단위 테스트 (AI 는 모델 실행 필요).
- live 전 판독이 잡은 결함 (수리 `66af8347d`): 이름 영역으로 캔버스 드래그 차단 · store 진입부 영향 확인이 병렬 · 트랜잭션 호출부를 부분 반영으로 깨뜨림.

## Consequences

### Positive

- 같은 사실을 한 번만 적는다 — 새 컴포넌트 · 새 ADR 이 필드 패밀리 · 목록 owner 를 추가할 때 표 한 행이면 builder · preview · AI 가 같이 따라간다.
- 모든 표면 (메뉴 · 액션 바 · 단축키 · Layers · 팔레트 · 붙여넣기 · AI) 이 같은 판정을 쓴다 — B 묶음 형태의 불일치가 구조적으로 사라진다.
- UI 를 거치지 않는 호출 (AI · 단축키) 도 store 액션 진입부에서 막힌다.
- catalog 는 시각 정본으로만 남는다.

### Negative

- Phase 3 은 관대하던 경로의 동작을 바꾼다 — 표면별 live 가 필요하다.
- shared 에 새 모듈이 생겨 builder · preview 가 함께 의존한다 (Preview 번들 증가).
- layout · skia 렌더 분기는 남는다 — 정리는 상시 규칙으로 천천히 진행된다.
