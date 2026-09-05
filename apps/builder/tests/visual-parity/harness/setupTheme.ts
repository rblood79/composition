/**
 * ADR-198 하니스 — Skia leg 에 **production 과 같은 theme 파생**을 적용한다.
 *
 * `lightColors`/`darkColors` 의 accent 는 빌드 시점 tailwind 리터럴이고, CSS 테마는 같은
 * 색을 `--tint` 에서 oklch 로 파생한다. production 에서는 `initThemeConfig` 가 부팅 때
 * 그 파생을 적용해 둘을 맞추는데, 하니스의 Skia leg 은 store 를 부팅하지 않으므로
 * 리터럴이 그대로 남아 **Preview leg 과 다른 accent** 로 그렸다 (실측 2026-09-05:
 * Skia rgb(21,93,252) vs Preview rgb(54,96,240)).
 *
 * Preview leg 은 실 번들 CSS 를 실은 iframe 이라 이미 파생된 값을 쓴다 — 하니스가 맞춰야
 * 하는 쪽은 Skia leg 이고, 그 방법은 production 초기화를 그대로 재현하는 것이다.
 */
import { applyThemeDerivations } from "@/stores/themeConfigStore";

applyThemeDerivations();
