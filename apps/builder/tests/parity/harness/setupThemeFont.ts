/**
 * ADR-156 parity 하니스 — DOM leg 페이지에 **production 과 같은 root 폰트 문맥**을 싣는다.
 *
 * DOM leg (`harness.ts` domLeg) 는 폰트를 지정하지 않고 페이지 root 를 상속하고, TS 측정기
 * (`getRootComputedStyle().fontFamily`) 도 같은 root 를 읽는다 — 두 leg 이 같은 체인을 봐야
 * 텍스트 폭이 대조된다. 이 페이지는 2026-09-16 (`4150fbabf`, CSS 단일 채널) 까지
 * `@composition/shared/components` 배럴의 `foundation.css` 부작용 import 로 theme
 * `shared-tokens.css` 의 `:root { font-family: Pretendard, … }` 를 우연히 실어 왔다. 배럴에서
 * 그 import 가 빠지자 DOM leg 만 브라우저 기본 serif (Times) 로 떨어졌고 (실측 2026-09-19:
 * "Inbox unread messages" 16px — DOM 149.3 / TS 172), 9 케이스가 폭·줄바꿈으로 갈렸다.
 *
 * 폰트 문맥은 하니스가 명시적으로 고정한다 — 앱 배럴의 부작용에 기대지 않는다.
 * Pretendard face 파일 (`pretendard.css`) 은 종전에도 이 페이지에 없었다 (앱 index.css 가 싣는다) —
 * 체인 첫 항목이 없어 두 leg 모두 `-apple-system` 으로 떨어지는 것이 2026-09-04 oracle
 * (adr923CapabilityMatrixSeed) 이 잰 문맥이다. 실제 face 를 싣는 것은 별도 판정 (실측 2026-09-19:
 * 실으면 gridTrackContribution 6 이 줄 수 Δ1 로 갈린다 — TS 측정기 ↔ DOM 의 Pretendard 폭 차).
 */
import "@composition/shared/components/styles/theme/shared-tokens.css";
