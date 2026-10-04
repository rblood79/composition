# ADR-248 최종 기술 검증과 상태 판정 — 2026-10-05

검증 대상: `a1926c76b` 위 Switch DOM 색상 수리. **요청 범위의 구현·기술 검증 완료, Implemented — 2026-10-05 사용자 커밋·push 지시에 따라 최종 수리와 상태 승격을 함께 main에 반영한다.**

[상태 전이 규칙](../../../.agents/rules/adr-writing.md)의 main 반영·검증 통과·Live Exercise를 충족하는 최종 수리와 문서 변경을 같은 커밋으로 전달한다. 검증 직후 미커밋 단계의 Accepted 유지는 이력이며, 현재 판정은 Implemented다. 아래 live는 자동 브라우저 관찰이다.

## Switch 색상 원인과 수정

1. catalog `Switch.structure.states.disabled`는 opacity 0.38만 규정한다. 수동 Switch CSS가 `fg-disabled`·`border-disabled`·thumb 색을 추가해 Preview에서 별도 감쇠를 만들었다. 추가 색 덮어쓰기를 제거하고 선택/미선택 기본 색에 catalog opacity를 한 번 적용한다.
2. 공용 theme/tokens의 `createAccentColorTokens`는 불투명 accent-subtle을 계산하지만 Preview CSS는 독립적인 15% overlay를 계산했다. `resolveThemeSnapshot`이 이미 해석한 light/dark 값을 CSS 변수에도 전달한다. dark의 border-hover도 독립 CSS neutral-600과 theme map neutral-500이 갈려 같은 방식으로 정렬했다. 명시 토큰은 이 seed보다 우선하며 CSS 변수 중복은 없다.

Canvas의 paint·geometry, catalog 상태 계약, 기존 G3 승인 예외·예산은 변경하지 않았다. 두 토큰은 Switch 이외에도 쓰이므로 공용 테마의 모든 소비자가 같은 해석값을 받는다. 수동 CSS를 Canvas 값으로 하드코딩하지 않았다.

## 최신 G3와 과거 미검증 처분

| 범위                  | 현재 결과                                    | 과거 기록과의 관계                                             |
| --------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| 원본 base             | 63 PASS / 1 UNVERIFIED / FAIL 0              | 원본 Icon 입력 누락은 유지                                     |
| 원본 axis             | 374 PASS / 6 UNVERIFIED / 6 NOT_RUN / FAIL 0 | Icon 입력 누락·계약 밖 variant는 유지                          |
| 원본 state            | 75/75 PASS                                   | 이전 Switch 6 FAIL은 수리 전 이력                              |
| child 보충            | 33/33 PASS                                   | 원본 PNG 부재 33행을 소급 수정하지 않음                        |
| 고정 Icon 보충        | base 1/1 + axis 6/6 PASS                     | 명시 `circle` 입력의 독립 coverage                             |
| 현재 Switch DOM 색상  | 16/16 PASS                                   | blue/red × light/dark × selected/unselected × enabled/disabled |
| 실제 Compare track L3 | 6/6 PASS                                     | 아래 실제 캡처의 국소 픽셀 검사                                |

수리 전 색상 browser 검사는 8/8 FAIL이었다. 비활성 text/border와 track이 RED였고, dark border 차이도 별도로 확인했다. 수리 후 선택 상태까지 확장한 16/16과 인접 theme/toggle 단위 검사 31/31이 통과했다. 전체 state 실행의 browser 검사 5파일 70테스트가 통과했다(75장면은 palette loop 내부 집계).

원본 Icon 7·child 33의 UNVERIFIED와 보충 oracle의 관계, 계약 밖 axis 6·Radio child 1의 원자 거부 7/7은 [대응표](248-g3-section-closure.md#기존-미검증과-보충-검증의-관계)를 유지한다. 원자 거부를 시각 PASS에 더하지 않는다. 보충 child replay는 전체 root 장면이므로 `ADR248_SCENARIO=base`로 실행한다. 최초 child-mode 실행의 입력 형식 오류는 제품 실패가 아니며 올바른 모드로 다시 검사했다.

## G4/G5/G6 근거와 변경 영향

| Gate      | 판정 근거                                                                                                                                                                                                                                  | 이번 변경의 영향·재검증                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G4        | [Phase 4 live 15/15](248-phase4-g4-live.json): undo/redo, IDB/JSON/폴더 저장·교환, 실패·충돌·refresh. [Publish 후속](../evidence/248-publish-followup.md): catalog JSON/v2, 2페이지 이동·뒤로가기, 구 JSON 원자 거부, 실제 Builder→Publish | 문서 스키마·mutation·history·storage·교환 코드는 변경 없음. 과거 R9의 Preview 명시 실패와 R12의 publish diff 0은 당시 전환 경계 기록이며, 현재 요구는 후속 Publish 성공 근거로 대체함      |
| G5        | [2026-10-04~05 paired p95 36/36, heap 9/9, 저장 byte 5/5](../evidence/248-g5-followup.md)                                                                                                                                                  | 이번 변경은 테마 해석 때 CSS 변수 두 키 전달과 Switch CSS. 편집·layout·저장 알고리즘/직렬화/상시 구독 변경 없음. 기존 paired·heap 결과를 유지하며 이번 실행에서 재측정했다고 주장하지 않음 |
| G5 bundle | 현재 production 정적 initial gzip: Builder **1,220,345B ≤ 1,421,000B**, Preview **290,043B ≤ 623,000B**                                                                                                                                    | 실제 minified build와 정적 closure 계산 새로 PASS. Preview 실제 boot JS 636,473B는 기존 측정·별도 한계이며 이번 정적 수치로 대체하지 않음                                                  |
| G6        | 현재 Builder/Publish production rendered module graph **PASS**                                                                                                                                                                             | specs·legacy resolver·spec registry 0, Publish→Builder module 0. `pnpm run gate:catalog-runtime` 새로 실행                                                                                 |

기존 G0/G1/G2 종결 근거는 [ADR Gates](../completed/248-unified-catalog-document.md#gates)에 연결돼 있다. 이번 변경은 모델·reducer 경계를 변경하지 않는다. Workflow overlay, 대규모 구조 이동/삭제의 형제 목록·geometry 비용은 기존 별도 후속 범위이며 이번 색상 수리로 완료됐다고 주장하지 않는다. 구 프로젝트 migration/호환은 명시적 제외다.

## Live Exercise

2026-10-05 headed Chrome, Playwright CLI, 실제 Builder `/builder/32e4d8d7-139a-48b7-9615-38ca632db9b4`, Desktop Compare Mode, zoom 100%, 캡처 scale CSS pixel. 기존 6개 Switch origin을 reload 후 확인했다. DOM indicator 상자는 모두 `(0,4,36,20)`이다.

- 미선택 track: DOM/Canvas 내부 실측 RGB **218,238,255**. disabled의 흰 배경 합성값 **241,249,255**. thumb도 미선택 **229,229,229**, disabled **245,245,245**로 일치한다.
- 비활성 DOM text는 기본 neutral **23,23,23**, border **161,161,161**, owner opacity **0.38**이며 catalog/Canvas와 같은 계약이다.
- 실제 스크린샷에서 Canvas 위치 차이 `(632,40)`을 보정하고 36×20 track의 바깥 3px band를 제외한 30×14 영역을 대조했다. 각 장면 420pixel, pixelmatch threshold 0.1에서 **different 0 / ratio 0**. maxByte는 selected 11, disabled 5, 나머지 14이다. 기존 L3의 두 상한 동시 초과 규칙에 따라 PASS이며 raw RGB exact 일치라고 부르지 않는다.
- 실제 Preview label 클릭과 Space 키로 on→off→on을 확인하고 disabled 입력이 유지되는 것도 확인했다. RAC의 숨겨진 input 직접 클릭은 hit target이 아니므로 label로 exercise했다.
- origin 이름 hover/pressed/focus-visible은 이 캡처에서 실제 pointer/keyboard pseudo-state가 활성됐다는 뜻이 아니다. 이 검사는 확인된 정적 6개 origin의 track이며 현재 DOM 모든 interaction/state의 전수 pixel parity로 확대하지 않는다. 텍스트 glyph와 외곽 band도 이 국소 L3 검사 범위가 아니다.

로컬 산출물: `apps/builder/test-results/adr248-switch-color-{state,base,axis,child}-final.json`, `*-icon-{base,axis}.json`, `*-bundle-{builder,preview}.json`, `*-live.png`, `*-live-l3.json`. 원본 oracle·PNG·G3 예산은 보존한다.

## 최종 검사

- `pnpm run codex:preflight` PASS: typecheck 6 tasks, Builder baseline 0, guard·registration·agent-catalog PASS.
- `git diff --check` PASS.
- 생성 입력 변경이 없어 CSS 재생성은 불필요하다. 보호 파일·raw oracle·PNG·생성물을 편집하지 않았다.

## 최종 상태

기술적 차단 사유는 해소됐다. 기존 문서의 “Publish 미완료”, “section 3건 대기”, “Switch 6 FAIL”, “현재 Switch 색상 차이”를 현재 잔여 구현으로 읽지 않는다. 최종 제품 수리와 함께 **Implemented 상태·archive·인덱스 동기화**를 main에 반영한다. 원본 미검증 이력과 명시적 제외 후속을 보존하며, 배포는 이 완료 판정에 포함하지 않는다.
