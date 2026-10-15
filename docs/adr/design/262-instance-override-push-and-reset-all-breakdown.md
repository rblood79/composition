# ADR-262 design breakdown — 원본에 반영 · 전부 되돌리기

> 본문: [../completed/262-instance-override-push-and-reset-all.md](../completed/262-instance-override-push-and-reset-all.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 는 로컬 전용이라 실측 결론은 여기에 둔다.

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: ADR-260 (원본 참조 모델) 이 base 다. 이 ADR 은 그 위에서 override 를 옮기거나 지우는 응용이다. [ADR-261](261-component-api-breakdown.md) 과는 직교한다 — 261 의 속성 값 반영 행만 261 Phase 4 뒤에 더한다 (본문 Decision 4).
2. **schema**: 문서 schema 변경 0. 새 shared 명령 둘 (`pushInstanceOverrides` · `resetInstance`).
3. **선행 전제 reverse 검증**: 2026-10-14 「Reset all changes 는 우선 그냥 놔둬」 는 2026-10-15 분리 답 「Reset all changes 포함」 으로 범위 안이 됐다. Restore origin 은 그대로다.
4. **판독**: Codex 1차는 사용자가 요청할 때 (`/review-adr 262`).

## 1. Phase 0 — 전수 표 · oracle (G0)

- **override 전수 표**: 행 = 원본 모양 (`originRef: true` page 원본 · 숨은 template `false` · 옛 소유 template · 기본 원본 `lib:`). 열 = 루트 own 필드 전부 (`props` · `visual` · `fills` · `fillSizing` · `stateRules` · `responsive` · `visibility` · `sizing` · `layout`) · 자리 `patch` 필드 10종 (`types.ts:462-475`) · `fillSlot` 필드 · 중첩 주소 (`instances` 2+) · `enabled: false` · breakpoint 층. 칸마다 「반영 쓰기 대상 (노드 · 필드 · 층 · 원본 층에서 지울 키)」, 「Reset all 제거 여부」, **손계산 기대 표시값** (반영 뒤 · 되돌리기 뒤 — 독립 기준) 을 적는다. 리뷰 Round 1 · 2 의 재현 4건을 칸으로 넣는다 (Round 2: 원본 mobile + instance tablet 만): 원본 mobile 층 + instance 기본값 · 중첩 N tablet + I mobile (통째 교체) · 루트 `fills` / mobile / hover.
- **원본 노드 쓰기 경로 확인**:
  - `setFields` (`commands/fields.ts`) 가 page 원본 · 숨은 template 노드에 쓸 수 있는지.
  - 숨은 template 노드에 직접 쓰면 `VIEW_ENTRY_READ_ONLY` 나 정의 view 판정에 걸리는지.
  - 기본 원본은 `setLibraryDefault` (`commands/components.ts:53-105`, 루트만).
- **중첩 주소 재기준**: `resolution/address.ts` · `resolution/templateOwners.ts` 의 주소 투영으로 「바깥 instance 주소 `[I, N, …]` → 원본의 중첩 instance 노드 N 의 주소 `[N, …]`」 가 같은 자리를 가리키는지 unit 으로 확정한다.
- **Figma 실물 확인**: Reset all changes 가 instance 크기 (resize) 를 되돌리는지 (사용자 결정 3 재료). 반영이 숨긴 레이어 · 글자 · 채움을 어떻게 옮기는지.
- **자리별 Reset 목록 누락 종류** (`CatalogComponentSection.tsx:39` `PATCH_FIELDS` · `:107-160`): `enabled` · `fills` · `fillSizing` · `stateRules` · `responsive` · `visibility`.

### Phase 0 결과

**코드 판독 (2026-10-15, main `108306c71`)** — 투영 순서는 `resolver.ts` 가 정본이다 (visual · layout · sizing 세 축 모두 같은 모양).

| 축 (직접 자리 — 원본 노드 T 가 `templatePath` 끝)                                                      | 순서 (뒤가 이긴다)                                                                                                                                                                                     | 근거                            |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| visual                                                                                                 | 정의 · 프로젝트 기본값 → T.visual → T.responsive 층 → 원본 project override → library patch → instance 루트 own (`root.visual`, 루트 자리만) → I patch.visual → I patch.responsive 층                | `resolver.ts:1794-1810`         |
| layout                                                                                                 | T.layout → T 층 → `root.layout` (루트 자리만) → I patch.layout → I patch 층                                                                                                                            | `resolver.ts:1770-1792`         |
| sizing                                                                                                 | `root.sizing` → T.sizing → T 층 → I patch.sizing → I patch 층                                                                                                                                          | `resolver.ts:1726-1745`         |
| props                                                                                                  | 정의 · override → T.props → library patch → `{binding}` → 속성 쓰기 (ADR-261) → `root.props` (accepts 안 키 · composite) → I patch.props                                                               | `resolver.ts:1653-1690`         |
| fills · fillSizing                                                                                     | `patch.fills ?? root.fills ?? T.fills` — 통째. fillSizing 은 patch 가 있으면 patch + patch 층 cascade, 없으면 root ?? T + T 층                                                                        | `resolver.ts:1811-1826`         |
| visibility                                                                                             | `patch.visibility` 가 있으면 그 객체로만, 없으면 T 의 객체로 판정 (`VISIBILITY_FALLBACK` 안 fallback)                                                                                                  | `resolver.ts:1627-1634`         |
| enabled                                                                                                | `layeredPatch.enabled ?? libraryPatch ?? 속성 ?? T.enabled ?? true`                                                                                                                                    | `resolver.ts:1616-1622`         |
| stateRules                                                                                             | 정의 → override → T.stateRules → (루트 자리) 원본 정의 · override · `root.stateRules`[I 루트 own] → patch.stateRules — 상태별 키 단위                                                                  | `resolver.ts:1827-1833 · 2136-2148` |
| 중첩 자리 (`instances` 2+, N = `instances[1]` 원본 안 중첩 instance 노드)                                | `layeredOverride`: owner 들 (N … I) 의 override 를 안쪽부터 `layerPatchFields` 로 병합 — props · visual · sizing · layout 키 단위, stateRules 상태별 키 단위, `fills · fillSizing · responsive · visibility · enabled` 통째 (바깥이 이김). 병합 결과가 위 표의 「I patch」 자리에 들어간다 | `templateOwners.ts:60-115`      |

**결론 2 (설계 확정)**:

1. **직접 자리는 「키별 breakpoint 맞추기」** — I 의 모든 층이 T 의 모든 층 뒤라 (Round 2 h1), I 가 쓴 키 k 마다 I 가 처음 쓴 층 f 부터: `T[f][k] = I[f][k]`, 그 뒤 층 l 은 I 의 cascade 값 (`I[l][k] ?? desired(l−1)`) 이 바로 위 층 값과 다르면 쓰고 같으면 T 의 그 층 k 를 지운다. f 앞의 T 층은 건드리지 않는다 (그 breakpoint 의 표시는 T 쪽 값이라 변하지 않는다). 작성값 (WriteValue) 그대로 옮기므로 토큰 참조가 보존되고, I 의 층이 T 의 층을 전부 이긴다는 순서가 「resolver 로 계산한 표시값」 과 같은 값을 준다 — 검증은 G1 이 resolver 로 한다.
2. **중첩 자리는 `layerPatchFields(N 의 override, I 의 필드)` 를 N 에 쓰는 것으로 끝난다** — 투영이 이미 그 병합을 하므로 (바깥 I 의 `responsive` 가 N 의 것을 통째로 가리는 것 포함) 병합 결과를 N 에 두고 I 의 override 를 지우면 표시가 같다. 3단 중첩도 결합법칙으로 같다. 주소는 `{instances: address.instances.slice(1), templatePath}` (N 자신부터 — `overridesAt` 가 owner 마다 `instancePath.lastIndexOf(owner)` 로 자르는 모양과 같다, `templateOwners.ts:74-90`). `lib:` 단계는 owner 가 아니므로 (`:76`) `instances[1]` 이 `lib:` 면 중첩 owner 가 없다 — 그 자리는 I 의 정의 template 이 library 인 경우 (= 기본 원본 instance, 사용자 결정 1).

**전수 표 — 반영 쓰기 대상 · Reset all · 손계산 기대 표시값** (칸 = 원본 모양 공통. 세 모양 `originRef: true` · `false` · 없음 모두 `project:node:` 노드라 쓰기 경로가 같다 — `setFields` · `setWholeField` · `put` 은 소유 사슬을 보지 않고 `graph.getEntry` 로 노드를 읽는다 (`fields.ts:115 · 230`). 숨은 template (`false`) 의 노드도 정의가 소유한 보통 노드라 같은 op 가 통한다. 기본 원본 `lib:` 은 쓸 수 없어 결정 1.)

| #   | override                                                     | 반영 쓰기 (원본 노드 T / 중첩 N)                                                    | 뒤에 지우는 것 (I)                          | Reset all | 손계산 기대 표시값 (반영 뒤 = 반영 전 / Reset 뒤 = 새 instance)                                                                                                                                 |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 루트 own `props[k]` (accepts 키)                             | R.props[k] (`patchNodeProp`)                                                        | I.props[k]                                  | 지움      | R 자리 props[k] = I 값 · 다른 instance (override 없음) 도 I 값                                                                                                                                  |
| 2   | 루트 own `props[p]` (ADR-261 속성 키)                        | 속성 대상마다: text → 대상 노드 `props[target.prop]` · boolean → 대상 노드 `enabled` | I.props[p]                                  | 지움      | 대상 노드 표시 = I 값 · 패널 속성 값 = 기본값 (원본 값이 됐으므로)                                                                                                                              |
| 3   | 루트 own `visual[k]` (기본 층)                               | 결론 1 — R.visual[k] = I 값 · R 층 k 는 I 층 cascade 로 set/remove                  | I.visual[k] · I 층 k                        | 지움      | desktop · tablet · mobile 각각 반영 전 값 (리뷰 Round 1 h1 재현: R mobile=blue · I base=red → mobile red 유지 — R.mobile.color 지워짐)                                                        |
| 4   | 루트 own `responsive[bp].visual[k]` 만 (기본 층 없음)        | 결론 1 — f = bp. R[bp][k] = I 값, 그 뒤 층 cascade                                   | I 층 k                                      | 지움      | Round 2 h1 재현: R mobile=blue · I tablet=red → 반영 전 black/red/red → R.tablet=red · R.mobile 지움 → black/red/red                                                                            |
| 5   | 루트 own `responsive[bp].layout` · `sizing`                  | 사용자 결정 3 — 기본안: 반영 · Reset 모두 하지 않음 (놓은 instance 의 배치)        | —                                           | 남김      | 변화 없음                                                                                                                                                                                       |
| 6   | 루트 own `fills`                                             | R.fills (`setNodeField`)                                                            | I.fills                                     | 지움      | 루트 자리 fills = I 값 (`root.fills` → `T.fills` 로 자리만 바뀜)                                                                                                                                |
| 7   | 루트 own `fillSizing` (+ 층 fillSizing)                      | R.fillSizing = I.fillSizing · R 층 fillSizing = I 층 것 (없는 층은 지움)            | I.fillSizing · I 층 fillSizing              | 지움      | 각 bp cascade 값 동일                                                                                                                                                                           |
| 8   | 루트 own `stateRules[state][k]`                              | R.stateRules[state][k] (`put`)                                                      | I.stateRules[state][k]                      | 지움      | hover 등 상태에서 같은 값 (Round 1 h2 재현: hover stateRules 가 Reset 뒤 남지 않음)                                                                                                             |
| 9   | 루트 own `visibility`                                        | R.visibility := bp 마다 `visibleAt(I) && visibleAt(R)` 를 명시한 뒤 fallback 과 같은 항목은 생략 | I.visibility                                | 지움      | 각 bp 에서 그려지는지 동일 (루트 own 은 I 와 R 두 판정의 AND 라 통째 복사가 아니다)                                                                                                             |
| 10  | 루트 own `sizing` · `layout`                                 | 결정 3 (기본안 하지 않음)                                                           | —                                           | 남김      | —                                                                                                                                                                                               |
| 11  | `patch.props[k]` (직접 자리 T)                               | T.props[k]                                                                          | patch.props[k]                              | 지움      | 자리 props[k] 동일                                                                                                                                                                              |
| 12  | `patch.visual` · `layout` · `sizing` (기본 층 · 층)          | 결론 1 (T 에 키별 breakpoint 맞추기)                                                | patch 의 그 키 · patch.responsive 층의 키   | 지움      | 각 bp 동일 (3 · 4 와 같은 재현 칸을 자리에서도 센다)                                                                                                                                            |
| 13  | `patch.stateRules`                                           | T.stateRules 병합                                                                   | patch.stateRules                            | 지움      | 상태별 동일                                                                                                                                                                                     |
| 14  | `patch.enabled: false` (자리 숨김)                           | T.enabled = false (`put`)                                                           | patch.enabled                               | 지움      | 자리 없음 유지 · 다른 instance 도 숨겨짐 (Figma: 숨긴 레이어 반영)                                                                                                                              |
| 15  | `patch.fills` · `fillSizing`                                 | T.fills · T.fillSizing (+ 7 과 같은 층 처리)                                        | patch 의 것                                 | 지움      | 동일                                                                                                                                                                                            |
| 16  | `patch.visibility`                                           | T.visibility := patch.visibility (통째 — 자리 판정은 patch 객체만 본다)             | patch.visibility                            | 지움      | 동일                                                                                                                                                                                            |
| 17  | `fillSlot` 의 필드 (patch 필드 10종)                          | 11~16 과 같다                                                                        | 필드만 — `childIds` 유지                    | 필드만    | slot 내용은 그대로 (사용자 결정 2 기본안)                                                                                                                                                       |
| 18  | 중첩 주소 (`instances` 2+) 의 patch · fillSlot 필드          | N (= `instances[1]`) 의 override at `{instances.slice(1), templatePath}` := `layerPatchFields(N 것, I 것)` (`fillSlot` 이면 childIds 유지) | I 의 그 override (fillSlot 이면 필드만)     | 지움      | Round 1 h1 재현 2: N tablet=blue · I mobile=red (통째 교체로 I 가 N 의 tablet 을 가림) → 반영 전 I tablet black · mobile red → N.responsive := I 것 → 그대로. N 의 다른 instance 는 N 값 (N 이 바뀌었으니 같이 바뀜 — 원본 편집) |
| 19  | `replace` (ADR-261 Phase 5 — 교체 · instance 속성 값)        | 반영하지 않음 (범위 밖 — 261 교체. instance 에 남는다, slot 내용과 같은 취급)       | —                                           | 되접기    | Reset all = 새 instance 이려면 교체도 풀려야 한다 — `resetReplacement` 와 같은 길 (swap 뒤 되접기) 을 한 transaction 에 포함. 설계 당시 「만드는 명령이 없다」 였던 종류가 생겨 G2 가 요구한다 |

**원본 노드 쓰기 경로 확인**: `setFields` · `setWholeField` 는 `reader.getEntry(id)?.kind === "node"` 만 본다 — page 원본 · 숨은 template 노드 모두 통과. Builder 의 정의 view 판정 (`VIEW_ENTRY_READ_ONLY`) 은 Components page 의 **기본 원본 샘플** (`isViewEntry`) 에만 걸린다 (`originView.ts:120-166`) — 프로젝트 정의의 노드는 해당 없음. 기본 원본은 `setLibraryDefault` 가 `defaults` · `visual` · `stateRules` 세 scope 만 받고 자리 (patch) 가 없다 → 결정 1 기본안 「루트 own props · visual 만」 과 일치. 노드 `stateRules` 를 쓰는 op 는 없다 (`put` 으로 노드 전체) — 반영 명령은 `CommandDraft.write` 를 쓴다.

**중첩 주소 재기준 (unit 으로 확정 — Phase 1 테스트 `nested address rebases to the inner owner`)**: `overridesAt` 는 owner 마다 `instancePath.slice(lastIndexOf(owner.id))` 를 그 owner 의 `instances` 로 보고 `templatePath` 는 공유한다 — 바깥 I 의 `[I, N, …]` 와 N 자신의 `[N, …]` 는 같은 자리다 (`templateOwners.ts:84-90`).

**Figma 실물 확인 (help.figma.com 「Apply overrides to instances」, 2026-10-15 조회)**: 「Reset the instance to restore the properties of the main component」 · 「Reset > Reset all changes to reset all properties for that layer」 · 「Figma only lists properties that have changes applied」. **크기 (resize) 를 되돌리는지는 문서에 없다** — Figma 앱의 instance 메뉴에는 「Reset all changes」 와 별도로 「Reset size」 가 있다 (실물 UI). 반영에 대해 숨긴 레이어 · 글자 · 채움 · 중첩 override 를 어떻게 옮기는지도 문서에 없다 — 「It's not possible to push changes to a component that's nested within another component」 만 있다. → 사용자 결정 3 의 재료: 기본안 (크기 · 배치는 남긴다) 은 Figma 「Reset size」 가 별도 항목인 것과 맞다.

**자리별 Reset 목록 누락 종류** (`CatalogComponentSection.tsx:46 PATCH_FIELDS`): `enabled` (숨김) · `fills` · `fillSizing` · `stateRules` · `responsive` · `visibility` — 6종. 루트 own 도 `props` · `visual` 만 (`useCatalogOwnFields`) → 루트 own `fills` · `stateRules` · `responsive` · `visibility` · `fillSizing` 도 목록에 없다. Phase 2 가 둘 다 넓힌다.

**ADR-261 속성 (Decision 4)**: 261 Phase 4 · 5 는 2026-10-15 main 에 있다 (`e09a78030` · `b4e64d41f`). text · boolean 값은 instance 루트 `props[key]` 에 있고 (`componentPropertyAccepts` — `withoutPropertyKeys` 가 template 루트 props 에서 뺀다) 쓰기 대상은 `componentPropertyWrites` 가 준다 → 표 2 행. instance 속성 (swap) 값은 `replace` → 표 19 행.

**사용자 결정 1~4 (2026-10-15 AskUserQuestion)**: 전부 기본안 — 1 루트 props · visual 만 (`setLibraryDefault`) · 2 slot 내용 반영 안 함 · 3 루트 sizing · layout 은 Reset · 반영 모두 건너뜀 · 4 다른 instance 1+ 면 「N개 영향」 확인.

## 2. Phase 1 — shared 명령 (G1 · G2)

- `commands/components.ts` 에 두 명령을 둔다:
  - `pushInstanceOverrides({id, newId})`
    - 대상 검사: instance 가 아니면 `NOT_AN_INSTANCE`, 사용자 결정 1 이 「불가」 면 기본 원본은 `LIBRARY_ORIGIN_READ_ONLY`.
    - 매핑 함수 `originTargetOf(address)` 가 주소를 원본 노드 (또는 중첩 instance 노드 + 줄인 주소) 로 바꾼다.
    - 맞추기 함수 하나 (리뷰 h1 · Round 2 개정): instance 가 쓴 키 k 마다 반영 전 표시값을 breakpoint 마다 resolver 로 계산하고, 원본 노드 (또는 중첩 N 의 override — 축 규칙은 `layeredOverride` `resolution/templateOwners.ts:100-115`) 의 k 를 그 값들이 나오도록 다시 쓴다 — 기본값 = 기본 표시값, 층은 cascade 로 같으면 지우고 다르면 쓴다. 「같은 층으로 옮기기」 는 쓰지 않는다 (instance 의 모든 층이 원본의 모든 층 뒤에 덮인다 — `resolver.ts:1734-1750`).
    - 그 뒤 instance 의 같은 키를 지운다.
    - `fillSlot` 의 `childIds` 는 건드리지 않는다 (사용자 결정 2 기본안).
  - `resetInstance({id})`
    - 루트 own `props` · `visual` · `fills` · `fillSizing` · `stateRules` · `responsive` · `visibility` 를 지운다 (리뷰 h2).
    - 모든 `patch` 를 지운다.
    - `fillSlot` 은 필드만 지운다 — `resetDescendant` (`fields.ts:460-516`) 규칙을 재사용한다.
    - 루트 `sizing` · `layout` 은 사용자 결정 3 답대로.
- 테스트:
  - 전수 표의 칸마다 반영 불변식과 되돌리기 불변식을 단언하고, 손계산 기대값과도 대조한다.
    - 반영 불변식: 반영 instance 의 표시 결과 (그리는 template 루트와 자손 — 노드 id · 래퍼 record 제외) 가 전후 같다.
    - 되돌리기 불변식: 새 instance 와 같다 (slot 내용 · 남기는 배치 필드 제외).
  - override 가 없는 다른 instance 는 원본 값을 보이고, override 가 있는 다른 instance 는 자기 값을 보인다.
  - undo 한 번에 원상으로 돌아간다.
  - 원복 RED: 매핑에서 중첩 처리 · `enabled` 를 빼거나, 원본 층의 키 지우기를 빼거나, 통째 교체 축을 키 병합으로 바꾸면 실패해야 한다.
  - 무작위 명령 500 단계 하니스 (ADR-248 4b) 에 두 명령을 추가한다.

### Phase 1 결과 (2026-10-15)

- 구현: `packages/shared/src/catalog/commands/instanceOverrides.ts` — `pushInstanceOverrides({id, newId})` · `resetInstance({id})` (export `commands/index.ts`). 직접 자리 = `pushFieldsOntoNode` (`matchAxis` 키별 breakpoint 맞추기 · `matchFillSizing` · `mergeStateRules` · `enabled` · `visibility` 통째) · 루트 own = `rootFields` (sizing · layout 제외) + `andVisibility` (I 와 R 두 판정의 AND) · 속성 값 = `componentPropertyWrites` 대상 노드 쓰기 · 중첩 자리 = `instances[1]` 의 override 에 `layerPatchFields` 병합 (주소 `instances.slice(1)`) · 기본 원본 = `pushLibraryDefaults` (루트 props · visual → `patchDefinitionOverride`). Reset all = `replace` 먼저 `resetReplacement` 로 되접고 (stage 위에서 한 transaction) `clearedRoot` + `withoutFields`.
- 검증 (G1 · G2): `__tests__/instanceOverrides.test.ts` 19 — 세 원본 모양 × 전수 표 칸 (3 · 4 · 6 ~ 9 · 11 ~ 18) 반영 불변식 (desktop · tablet · mobile × 기본 · hover) · 손계산 칸 (Round 1 h1 — R.mobile.color 삭제 · Round 2 h1 — black/red/red · Round 1 h1-2 — N.responsive := I 것 · tablet 가림 유지) · 다른 instance J (원본 값) · K (자기 값) · undo 원상 · 행 1 · 2 (root prop · 속성 값) · 행 7 (가려진 원본 층 fillSizing 삭제) · 행 17 (slot 내용 유지) · 결정 1 (library 기본값) · 중첩 주소 재기준 · Reset = 새 instance (slot 내용 · 루트 sizing · layout 제외) · swap 되접기. 원복 RED 4/4 — 중첩 처리 제거 5 fail · `enabled` 제거 6 fail · 「같은 층으로 옮기기」 4 fail · fillSizing 층 교체 제거 1 fail. 무작위 500 단계 하니스에 `push` · `resetAll` 추가 (`randomUndo.test.ts`) PASS. `pnpm type-check` PASS.
- 설계에서 바뀐 것: (1) 「resolver 로 표시값 계산」 대신 **작성값 cascade** 로 맞춘다 — I 의 모든 층이 T 의 모든 층 뒤라는 투영 순서 (Phase 0 표) 가 같은 값을 보장하고 토큰 참조가 보존된다. 검증은 resolver 로 한다. (2) 중첩 자리는 맞추기가 아니라 `layerPatchFields` 병합 — 투영이 하는 병합과 같아 구성상 동일. (3) Reset all 이 `replace` (ADR-261 Phase 5 교체 · instance 속성 값) 도 되접는다 — G2 「= 새 instance」 가 요구. 반영은 `replace` 를 옮기지 않는다 (교체는 261 범위 · slot 내용과 같은 취급).
- 기록: 다른 세션 (ADR-261 종결 세션) 이 08:00 `2d67bc542` 「Implemented ADR-262」 메시지로 이 작업 트리의 Phase 0 · 1 WIP (문서 2 · `index.ts` · `instanceOverrides.ts`) 를 커밋했다가 바로 되돌렸다 (`git add -A` 가 병렬 세션 WIP 를 삼김 — 메모리 `feedback-git-add-all-swallows-parallel-session-wip` 세 번째 사례). 최종 main 에는 남지 않았다.

## 3. Phase 2 — Builder (G3)

- `catalogRuntime/componentActions.ts` 에 `catalogComponentCommands.push` · `.resetAll` 을 둔다.
  - 사용 가능 판정: instance 자신만, 원본 안 중첩 자리는 제외 (Figma).
- `CatalogComponentSection.tsx`:
  - Overrides legend 옆 또는 아래 줄에 「Reset all changes」 와 「Push changes to component」 (`.control-button`) 를 둔다.
  - `PATCH_FIELDS` 를 누락 종류까지 넓힌다. 숨김 행 이름은 「Hidden」, fills 는 「Fill」.
- Canvas 오른쪽 클릭 (`catalogRuntime/canvasMenu.ts`) 의 instance 항목에 두 동작을 넣는다. i18n ko/en 도 같이 넣는다.
- 확인: 반영은 `componentConfirm.ts` 의 「N개 instance 영향」 대화상자를 재사용한다 (사용자 결정 4). Reset all 은 토스트 + undo.
- live 스크립트: `apps/builder/scripts/adr262-override-push-reset-live.mjs`.
  - 중첩 컴포넌트와 instance 3개로 반영 · 되돌리기를 하고, 다른 instance 값 · undo 를 확인한다.
  - Compare Mode 에서 Canvas = Preview 인지 본다.

### Phase 2 결과 (2026-10-15)

- 구현: `catalogRuntime/componentActions.ts` — `catalogComponentCommands.push` · `.resetAll` + `catalogOverrideCleanupTarget` (instance 자신만 — `descendant` 자리 · 원본은 제외) · `componentConfirm.ts` — `confirmCatalogPush` (다른 instance 1+ 면 「N개 영향」, 결정 4) 와 **감시자 확인 집합 공유** (`confirmedKeys` — 반영의 사전 확인을 `watchCatalogComponentEdits` 의 키에 등록) · `canvasMenu.ts` — `push-changes` · `reset-all-changes` (instance 단일 선택 · 원본 아님) · `actionIcons.ts` `pushChanges` (`ArrowUpToLine`) · `CatalogComponentSection.tsx` — Overrides legend 아래 「Reset all changes」 · 「Push changes to component」 (`.component-semantics-strip`), 행 종류 확장 `extraRows` (루트 own · 자리: Hidden · Fill · Fill sizing · Visibility · `hover.color` · `tablet.color` · `tablet.Fill sizing`) 과 행별 되돌리기 `resetOverrideField` (shared, 새 명령 — 루트 · 자리 양쪽) · i18n ko/en 8 키.
- 검증 (G3 · G4): Builder unit `adr262OverrideCleanup.test.ts` 3 (메뉴 노출 · 확인 count · Cancel 무변경 · 원본 쓰기 · 감시자 재질문 0 · undo · Reset all 한 step) · 기존 `phase4eCanvasMenu` · `phase4eComponentConfirm` · `actionIcons.static` · `labelKeyCatalog.static` PASS · shared 159 파일 1712 PASS · `pnpm type-check` PASS. **live (headed Chrome · dev 5173 · Compare Mode · `apps/builder/scripts/adr262-override-push-reset-live.mjs`) 13/13 PASS** — Overrides 목록 opacity · Fill · Text.color 행 → Push 버튼 → 「N개 영향」 대화상자 → 원본 T.color · F.opacity · F.fills 쓰기 · I 비움 · I 의 Text 그대로 빨강 (Canvas record `#ff0000` = Preview DOM `rgb(255, 0, 0)`) · J 도 빨강 (Canvas = Preview) → 토스트 undo 원상 → Reset all 버튼 → I override 0 · Text 색 원본 (Canvas = Preview) · 대화상자 없음 → 토스트 undo → Canvas 오른쪽 클릭 메뉴 Push · Reset all → 메뉴 Reset all → 자리 숨김 행 「Text.Hidden」 · console/page error 0.
- live 가 잡은 결함 1 (수리): 반영 step 이 원본 노드를 바꾸므로 기존 원본 편집 감시자 (`watchCatalogComponentEdits`) 가 사전 확인 뒤 **두 번째 대화상자** 를 띄웠다 (overlay 가 토스트 undo 를 가림) → 확인 집합을 graph 별 `WeakMap` 으로 공유해 반영의 확인 키를 미리 등록. unit 단언 추가 (감시자 재질문 0).
- live 스크립트 함정 2 (제품 결함 아님): 「Design」 rail 버튼은 토글이라 재선택 때 패널을 닫는다 → 패널이 닫혀 있을 때만 누른다 · 글자를 숨긴 frame 은 높이 0 이라 오른쪽 클릭이 빈 캔버스 메뉴를 연다 → 숨기기 전에 메뉴를 확인한다.

## 4. 종료 (G4 · G5)

- 문서: 본문 Live Exercise · README · CHANGELOG · 메모리 `project-origin-instance-slot-reference-pen-figma`.
- ADR-261 Phase 4 가 먼저 끝났으면 속성 값 반영 행을 Phase 1 에 포함한다 (본문 Decision 4).

## 5. 기록

- 2026-10-15 Proposed — 코드 판독. 근거 위치:
  - override 타입: `types.ts:454-496 · 734-747`.
  - 자리별 Reset: `CatalogComponentSection.tsx:60-260 · 320-370`.
  - 쓰이지 않는 `resetDescendant`: `fields.ts:460`.
  - 기본 원본 루트만 편집: `originView.ts:120-166`.
  - Figma · pen.dev 문서는 2026-10-15 조회.
- 2026-10-15 Codex 설계 리뷰 Round 1 — HIGH 2 · MEDIUM 1, 셋 다 실제 `CatalogGraph` 실행 재현. 실행자 코드 대조: `resolver.ts:1725-1750` (원본 층이 instance 기본값 아래) · `templateOwners.ts:100-115` (통째 교체 축) · `types.ts:755-763` (루트 own 필드). r1 수리 — 본문 Decision 1 · 2 · 제약 · Gates, 이 문서 §1 · §2. 수리 검증 (Round 2) 대기.
- 2026-10-15 Codex 수리 검증 Round 2 — h2 · m1 닫힘 · h1 남음 (instance tablet → 원본 tablet 이면 원본 mobile 이 이김, 세 모양 실행 재현). r2 — 쓰기 규칙을 breakpoint 마다 결과값 맞추기로 개정. 판독 상한 도달 — 확인은 Phase 1 G1.
- 2026-10-15 **Implemented** — 사용자 G5 Builder 확인 (「Push changes to component > origin 컴퍼넌트에도 반영된다」 → 「확인했어 Implemented 로 올려」). 본문을 `completed/` 로 옮겼다. 남은 LOW: 없음 (판독 루프는 설계 Round 1 · 2 로 상한 도달 — 수리 확인은 G1 손계산 칸 · 원복 RED 가 맡았다).
