# ADR-051 — 이모지 canvas 폭 보정 + 이모지 break 기회 (2026-09-07)

정본 판정: [EXTERNAL_PATTERN_DELTA_2026-09.md](../../explanation/research/EXTERNAL_PATTERN_DELTA_2026-09.md) §D 순서 5 (pretext ② 이모지 보정, 등급 B−, "DPR 2 헤드 환경에서 재현 확인 후").

## 1. 재현 확인 — 사용자 Chrome 152 / macOS / DPR 2 (착수 조건)

`canvas.measureText` − DOM `getBoundingClientRect` (px, 이모지 grapheme 1개):

| 크기 | 😀 | ❤️ (VS16) | 👍🏽 (modifier) | 🇰🇷 (RI 쌍) | `M` (ASCII) |
| ---: | --: | --------: | -------------: | ----------: | ----------: |
| 12px | +3 | +3 | +3 | +3 | 0 |
| 14px | +4 | +4 | +4 | +4 | 0 |
| 16px | +4 | +4 | +4 | +4 | 0 |
| 20px | +2 | +2 | +2 | +2 | 0 |
| 24 / 28 / 32px | 0 | 0 | 0 | 0 | 0 |

Arial · `Pretendard, system-ui, sans-serif` · Helvetica · system-ui 전부 같은 값 — 이모지 폰트 (Apple Color Emoji) 의 문제라 본문 폰트 무관. `Hi 😀 ok` 혼합 텍스트도 +4 (grapheme 당 선형). system-ui 24px 이상의 ASCII +0.8~1.4 는 upstream `PLATFORM_BUGS.md` 의 "system-ui 광학 변형 불일치" (별개, 미착수).

같은 probe 에서 **두 번째 결함**: Chrome 은 이모지 앞뒤를 break 기회로 본다 (UAX #14 ID/EB) — `Hello😀World` → `Hello` / `😀` / `World` 3줄, `Hi 😀 ok` 좁은 폭 → `Hi` / `😀` / `ok`. 현재 `tokenize()` 는 `Intl.Segmenter` 의 `isWordLike: false` 를 그대로 non-breakable 로 내 이모지가 이전 줄에 **부착**됐다.

## 2. 변경 — `canvas2dSegmentCache.ts`

- `getEmojiCorrection(fontString)`: 폰트 문자열당 1회 DOM span 대조 (`😀` canvas − DOM, 0.5 미만이면 0). 폰트 로드 상태에서만 캐시. `loadingdone` · `fonts.ready` · `queueFontLoad` · `clearSegmentCaches` · HMR dispose 에서 세그먼트 캐시와 함께 clear.
- `countEmojiGraphemes(text)`: regex 사전검사 (`Extended_Pictographic | Regional_Indicator | VS16`) 통과 시 grapheme segmenter 로 개수 (상한 4,096 캐시).
- `getOrMeasureWidth`: 측정 폭 − `개수 × 보정` (미로드 경로 포함). 캐시에는 보정 반영값 저장.
- `verifyLines` (Tier 2): 줄 재측정도 같은 보정 — 아니면 Tier 2 가 보정 전 폭으로 줄을 되밀어 Tier 3 결과를 되돌린다.
- `tokenize`: non-word-like 세그먼트에 이모지가 있으면 grapheme 단위 **breakable** 토큰 (국기 RI 쌍 · 피부톤 · ZWJ 시퀀스는 한 토큰).

## 3. 단위 — `canvas2dSegmentCache.test.ts` (신규 7, 파일 78/78)

DOM span mock (canvas 16 / DOM 12 → 보정 4). `countEmojiGraphemes` 8 입력 · 보정 캐시 (DOM read 1회) · 차이 0.5 미만 → 0 · 토큰 폭 차감 + 세그먼트 캐시 · `measureWithCanvas2D` 경계 (`Hi 😀 ok` 60 → 1줄 / 59 → 2줄, 보정 전 64) · tokenize 이모지 breakable + 좁은 폭 3줄 · `verifyLines` 보정 대칭 (보정 0 이면 이모지가 다음 줄로 밀림).

원복 RED: §5.

## 4. Live — 실제 모듈을 페이지에서 import, Chrome `Range.getClientRects()` 오라클 (14px Arial, DPR 2)

| 텍스트 | DOM 폭 | 엔진 폭 | 경계 3 (DOM +0.5 · −0.5 · 첫 단어 +1) 줄 대조 |
| --- | ---: | ---: | --- |
| `Hi 😀 ok` | 49.79 | 49.79 | 1 / 2 / 3 줄 — 전부 일치 (좁은 폭 `Hi` / `😀` / `ok`) |
| `Hello😀World` | 82.21 | 82.21 | 1 / 2 / 1 줄 — 일치 |
| `Rate ❤️ this 👍🏽 now 🇰🇷` | 138.49 | 138.49 | 1 / 2 / 6 줄 — 일치 |
| `no emoji here at all` (대조군) | 118.29 | 118.29 | 1 / 2 / 5 줄 — 일치 |

보정 전에는 첫 텍스트 엔진 폭 53.79 (DOM +4) 로 DOM −0.5 는 물론 DOM +0.5 폭에서도 2줄이었다.

## 5. 원복 RED

`canvas2dSegmentCache.ts` 를 HEAD 로 되돌리고 새 테스트만 얹은 상태: 이모지 describe **7/7 RED** (기존 71 GREEN 유지). 3건은 `countEmojiGraphemes` / `getEmojiCorrection` 미존재 (TypeError), `getOrMeasureWidth` 는 `😀` 16 (기대 12 — 보정 없음), `measureWithCanvas2D` 는 60 에서 2줄 (보정 전 64), `tokenize` 는 `Hello😀World` 를 `Hello` + non-breakable `😀` + `World` (이모지 앞 break 없음), `verifyLines` 는 보정 전 폭 40 > 36 으로 이모지를 다음 줄로 밀어냄. 복구 후 78/78.

## 6. 회귀

canvas utils + skia 단위 613 PASS (4 skip) · parity `intrinsicSizing` · `paddedLeafIntrinsic` · `textLeafScalarBlockParent` 34 PASS · type-check 0. `textMeasure.bench` 는 이모지 없는 텍스트라 사전검사 regex (텍스트당 ~0.5 µs) 만 추가 — §B4-13 예상 범위.
