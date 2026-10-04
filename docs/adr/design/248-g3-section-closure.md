# ADR-248 G3 section 종결과 승격 판정 — 2026-10-05

> **후속 수리 완료:** 아래는 수리 전 판정 이력이다. [Switch L3 대응 관계 수리](248-switch-l3-repair.md) 후 state 75/75 PASS이며, 아래 Switch 6 FAIL은 현재 결과가 아니다. 원본 미검증/보충 검증 대응표는 유지한다.

시작 HEAD: `ddc5fc60350bc267a07ac726e5c5a7af3f3da4b9`.
사용자 요청: 세 건 처리 → G3 재검증 → 기존 미검증/보충 검증 관계 정리 → Accepted → Implemented 판정.

**판정: 세 section은 종결했으나 전체 G3는 FAIL이므로 Accepted 유지.**
원본 G0·Phase 4 결과는 동결 이력으로 보존한다. 이번 결과로 과거 행을 덮어쓰지 않는다.

## 세 건의 처리

| 장면            | 원인 및 처리                                                                                                                                                                                                                           | 최종 근거                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GridListSection | 구 flex host의 폭 220과 현재 catalog GridList 2열/gap 12의 폭 104 차이. 현재 catalog 유지, 구 host 결함으로 분류. Header의 기존 ADR-238 판정과 section/item/text로 전파된 차이를 구분                                                  | Canvas↔DOM 7상자, 최대 delta 0px. 보충 scene hash와 구/신 좌표·크기 signature가 일치하고 DOM 상자가 존재할 때만 승인. L3 미귀속 차이 0    |
| ListBoxSection  | 기존 ADR-238 unloaded section CSS 판정에 따른 Header baseline 약 1.982px 차이가 section 높이와 다음 행 y에 전파                                                                                                                        | Canvas↔DOM 7상자, 최대 delta 0.00625px. 같은 보충 fixture의 확인된 상자만 승인. L3 different 0                                            |
| MenuSection     | **현재 제품 결함 3개 수리**: primitive 기본 variant `default`가 catalog variant에 없어 Canvas 트리거가 투명함 → `primary`; Menu가 자식을 누락함 → static item/section/separator 전달; MenuItem이 일반 div로 떨어짐 → RAC MenuItem 연결 | 트리거 Canvas↔DOM 1상자, delta 0px. 구/신 L3 **236,696 pixels, different 0**. 닫힘→section/항목 2개 열림→Escape 닫힘. **paint 예외 없음** |

초기 조사에서 “구 Menu의 검은 영역은 닫힌 상태 결함”이라는 가설을 세웠지만 실제 Preview의 검은 트리거와 catalog `primary` 계약이 이를 반증했다. 이 가설은 채택하지 않았다. Menu 자식이 닫혀 있는 것과 트리거가 투명한 것은 별개다.

새 geometry 예외는 `approvedSectionDifference`에 한정했다. 다른 scene hash·owner·node·구/신 상자·DOM 부재를 거부하는 negative test를 추가했다. 기존 1px geometry와 L3 예산은 변경하지 않았다. Menu의 기존 DOM pair 0을 PASS 근거로 쓰지 않도록 트리거 상자를 직접 측정하고 실제 열림/닫힘 probe를 추가했다. RAC 닫힘 animation은 조건 충족을 기다리며 고정 2-frame 대기로 판정하지 않는다.

## 기존 미검증과 보충 검증의 관계

| 기존 동결 기록                                         | 보충 검증 및 현재 처분                                                                                                                          | 집계 원칙                                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Icon base 1 + axis 6 UNVERIFIED: 무작위 icon 이름 누락 | 같은 동결 HEAD에서 명시적 `circle` 입력으로 7/7 PASS, 독립 axis PNG SHA-256 6/6 일치. 이전 Icon glyph 수리/live pixel 근거 유지                 | 원래 7행은 여전히 UNVERIFIED. 입력을 명시한 별도 coverage 7건으로 공백을 보충하며 동일 원본 복구라고 주장하지 않음 |
| child 33 UNVERIFIED: 원래 child PNG 없음               | 동결 HEAD에서 같은 origin/host 조합의 전체 root 장면과 PNG를 새로 보존. 독립 PNG 33/33 hash 일치. 보충 결과 **30 PASS/3 FAIL → 33 PASS/0 FAIL** | 원래 33행은 UNVERIFIED 이력. 새 root 장면 비교가 geometry·현재 DOM·L3를 모두 보충                                  |
| axis 6 NOT_RUN: TagGroup/Popover의 계약 밖 variant     | 공개 insertNodes가 PROP_NOT_ACCEPTED로 원자 거부                                                                                                | 시각 PASS로 합산하지 않음. 현 D2 계약 밖 입력의 거부 동작으로 처분                                                 |
| child Radio 1 NOT_RUN: body 직계 nesting 불가          | 공개 insertNodes가 NESTING_NOT_ALLOWED로 원자 거부                                                                                              | 시각 PASS로 합산하지 않음. 위 6건과 합쳐 문서/revision 불변 7/7                                                    |
| 2026-10-03 state 75/75 PASS                            | **이번 현재 코드 재검증은 69 PASS/6 FAIL**                                                                                                      | 과거 PASS는 당시 근거. 현재 전체 G3 통과 근거로 재사용할 수 없음                                                   |

보충 oracle HEAD는 `2a5c970994cb9de2f824a729b29c08cdcd647d7b`, child scene hash는 `62debe8d5c1e89649b4297e7520fb41e2142ab001e2818ea02e917ea4a922e11`이다. 하니스가 PNG 파일 hash와 동결 HEAD를 검사한다. 원본 캡처의 수치나 예산은 수정하지 않았다.

## 현재 G3 재검증

| 범위       | PASS |  FAIL | UNVERIFIED | NOT_RUN |
| ---------- | ---: | ----: | ---------: | ------: |
| 원본 base  |   63 |     0 |          1 |       0 |
| 원본 axis  |  374 |     0 |          6 |       6 |
| 원본 state |   69 | **6** |          0 |       0 |
| child 보충 |   33 |     0 |          0 |       0 |

새 FAIL은 Switch의 selected, unselected, disabled, hover, pressed, focus-visible 6건이다. geometry와 현재 Canvas↔DOM은 PASS이지만 L3 귀속 밖 ratio는 0.008415–0.014786, maxByte는 36–232로 한도를 넘었다. 선택 실행에서도 FAIL exit 1을 확인했다.

원인 범위를 분리하기 위해 이번에 바뀐 제품 파일 3개(Menu binding, delegatedDom, domBinding)를 Vite pre-load에서 시작 HEAD 내용으로 치환하고 같은 6건을 재실행했다. 나머지 제품 파일은 시작 HEAD와 동일하다. **시작 HEAD도 6 FAIL이며 각 행의 L3 객체가 수정본과 완전히 동일**했다. 따라서 이번 Menu/section 수정의 회귀는 아니지만, 현재 gate를 막는 기존 제품/하니스 문제다. 이 실행은 원인 확정이나 면제 근거가 아니다. 다음 작업은 Switch indicator·text 영역과 동결 픽셀의 차이 원인을 구분해 수리하고 state 75건을 재검증하는 것이다.

원표본은 로컬 `apps/builder/test-results/adr248-g3-{closure-base,closure-axis,closure-state,section-closure,switch-start-head}.json`에 보존했다. 시작 HEAD 비교 설정도 같은 test-results에 있다. 이 문서는 커밋 금지인 raw evidence 대신 저장소에서 판정 관계를 확인할 수 있는 요약이다.

## Live Exercise

2026-10-05, headed Chrome / Playwright CLI, 실제 Builder `ADR248 section closure` 프로젝트의 공개 insertNodes 경로로 GridList/ListBox/Menu host와 각 section을 넣고 Desktop Compare Mode를 열었다.

- GridList/ListBox section과 항목을 두 소비자에서 확인했다. 실제 상자 수치의 엄밀 비교는 동일 fixture G3 결과를 사용한다.
- Menu 트리거는 Preview에서 `primary`, rgb(23,23,23), 220×130이며 Canvas에서도 검은 트리거를 확인했다.
- Preview 클릭 시 Section 및 Item 1/Item 2가 나타남, Escape 닫힘·trigger focus 복귀·Item 1 클릭 후 닫힘을 확인했다. Canvas는 선언된 닫힌 상태를 유지한다.
- reload 뒤 다시 열어 같은 항목과 Escape 닫힘을 확인했다. 최종 reload 이후 console error 0. 기존 GridList/ListBox textValue 경고 4개는 남아 있으며 이번 시각 gate PASS를 접근성 전수 PASS로 확대하지 않는다.
- 캡처: `/private/tmp/adr248-section-final-closed.png`, `adr248-section-final-open.png`. 사용자 직접 확인이 아니라 자동 브라우저 관찰이다. Compare 화면은 스크롤/축척이 달라 full-image pixel parity 근거로 사용하지 않는다.

## 다른 gate 및 최종 상태

Menu 인접 회귀·presence·계약 밖 입력 테스트, Publish 회귀, typecheck/preflight 및 G6 검사 결과는 아래 최종 검사 기록을 따른다. 새 production 정적 initial gzip은 Builder **1,220,319B / 1,421,000B**, Preview **290,045B / 623,000B**로 통과했다.

기존 G5 paired p95 36/36, heap 9/9, 저장 byte 5/5 근거는 보존한다. 이번 변경은 Menu 렌더와 G3 하니스이며 그 Text/frame workload를 바꾸지 않아 재측정하지 않았다. Preview 실제 boot JS 636,473B 기록과 구조 이동/삭제 비용의 한계도 유지한다. 새 정적 initial 측정을 실제 boot 측정으로 부르지 않는다.

**Accepted → Implemented 보류.** 세 section 및 미검증 처분 정리는 완료했으나 state Switch 6건이 남아 “검증 통과” 조건을 충족하지 않는다. 위 판정 시점의 수정은 로컬 working tree였다. 이후 사용자 commit/push 지시에 따라 이번 수리를 main에 전달하며, Switch 6건으로 인한 승격 보류 판정은 유지한다. Workflow overlay·구 데이터 migration/호환은 기존 범위 결정을 유지하며 이번 G3 실패와 섞지 않는다.

## 최종 검사 기록

- 인접 Vitest: MenuSection·presence·계약 밖 입력 **3파일 22/22 PASS**. Publish **4파일 11/11 PASS**.
- G3 browser: child 보충 **33/33 PASS**, 공통 prop-axis 51건 및 section 예외 negative guard PASS. 원본 base/axis 실행은 성공, state 및 시작 HEAD Switch 선택 실행은 FAIL exit 1.
- `pnpm run codex:preflight` PASS: typecheck 6 tasks, Builder baseline 0; guard·registration·agent-catalog PASS. `git diff --check` PASS.
- Production build PASS. `pnpm run gate:catalog-runtime` Builder/Publish 모두 PASS: specs·legacy resolver·spec registry 진입 0.
- 전체 G3 FAIL은 위 성공 검사로 상쇄하지 않는다. 재현 가능한 현재 Switch L3 6건이 유일한 이번 승격 판정의 기술적 차단 사유다.
