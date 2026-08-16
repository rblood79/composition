// @vitest-environment node
/**
 * `ACTION_ICONS` 정본 계약의 정적 가드.
 *
 * **Why (2026-08-16 실측)**: 빌더 크롬 아이콘은 106개 파일이 `lucide-react` 를
 * 각자 import 한다 (고유 220심볼 / import 지점 537). 대부분은 1회성이라 그대로
 * 두는 것이 맞지만, 여러 화면에 나오는 액션은 한쪽만 바꾸면 갈린다 — 실제로
 * 삭제(`Trash2` vs `Trash`)와 눈금자 토글(`Ruler` vs `RulerDimensionLine`,
 * **같은 `setShowRulers`**) 두 건이 갈려 있었다.
 *
 * registry 만 두면 새 코드가 안 쓰면 그만이라 반쪽이 된다. 그래서 두 조항을
 * 기계로 집행한다:
 *
 * 1. **등재 심볼의 registry 밖 직접 import 0건** — 우회 경로 차단.
 * 2. **등재 항목별 소비처 ≥1** — 죽은 항목이 "고를 수 있는 것" 으로 남지 않게.
 *    (ADR-900 잔재 게이트가 소비자 0건인 채 수개월 남았던 것과 같은 형태 —
 *    memory `project-pixijs-removal-residue-gates-always-false`.)
 *
 * 테스트 파일은 양쪽 판정에서 제외한다. 단언용으로 lucide 심볼을 직접 집는 것은
 * 정당하고, 테스트만 참조하는 항목을 살아 있다고 세면 조항 2가 무의미해진다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const BUILDER_SRC = resolve(__dirname, "../..");
const REGISTRY_REL = "builder/config/actionIcons.ts";

/**
 * 파생 맵이 덮는 키 — 이 키들은 `ACTION_ICONS.<key>` 직접 참조가 registry 안에만
 * 있고, 바깥 소비는 맵을 통해 일어난다. 맵 자신이 소비처를 가지면 덮인 키도
 * 살아 있는 것으로 센다.
 */
const DERIVED_COVERAGE: Record<string, readonly string[]> = {
  ALIGNMENT_ICONS: [
    "alignLeft",
    "alignCenter",
    "alignRight",
    "alignTop",
    "alignMiddle",
    "alignBottom",
  ],
  DISTRIBUTION_ICONS: ["distributeHorizontal", "distributeVertical"],
};

/**
 * **같은 심볼, 다른 액션** — 의도된 예외.
 *
 * 정본 기준은 "같은 그림" 이 아니라 **같은 사용자 액션** 이다. 아래는 registry 가
 * 소유한 심볼을 쓰지만 가리키는 동작이 달라, 정본에 묶으면 오히려 한쪽을 따라
 * 잘못 바뀐다. 새 항목을 넣으려면 "그래서 이건 무슨 액션인가" 를 사유에 적는다 —
 * 적을 수 없으면 예외가 아니라 배선 대상이다.
 */
const INTENTIONAL_DIVERGENCE: ReadonlyArray<{
  file: string;
  symbols: readonly string[];
  reason: string;
}> = [
  {
    file: "builder/panels/styles/sections/TypographySection.tsx",
    symbols: [
      "AlignLeft",
      "AlignCenter",
      "AlignRight",
      "AlignVerticalJustifyStart",
      "AlignVerticalJustifyCenter",
      "AlignVerticalJustifyEnd",
    ],
    reason:
      "`textAlign` 스타일 값 선택 — 요소를 서로 정렬하는 액션이 아니라 텍스트 " +
      "정렬 속성이다. 두 축이 같이 움직일 이유가 없다.",
  },
  {
    file: "builder/panels/styles/sections/ModifiedStylesSection.tsx",
    symbols: ["RulerDimensionLine"],
    reason:
      "치수 입력 필드(`PropertyUnitInput`) 아이콘 — 눈금자 토글이 아니다.",
  },
  {
    file: "builder/panels/styles/sections/TransformSection.tsx",
    symbols: ["RulerDimensionLine"],
    reason: "치수 입력 필드 아이콘 — 눈금자 토글이 아니다.",
  },
  {
    file: "App.tsx",
    symbols: ["CirclePlus"],
    reason:
      "랜딩 히어로의 장식 아이콘 (`ParticleButton` 안, onPress 없음) — 액션 " +
      "어포던스가 아니라 마케팅 표면의 그래픽이다. 제품 크롬 규칙 대상 밖.",
  },
  {
    file: "builder/components/property/PropertyNumberInput.tsx",
    symbols: ["Plus"],
    reason:
      '스테퍼 증가("Increase") — `Minus`("Decrease")와 한 쌍인 산술 기호이지 ' +
      '"추가" 어포던스가 아니다. `add` 정본을 따라가면 짝이 깨진다.',
  },
  // `builder/panels/events/data/eventCategories.ts` 의 `Component` 예외는
  // ADR-158 Phase 4 (2026-08-16) 에서 그 디렉터리가 통째로 은퇴하며 함께 사라졌다.
];

/**
 * **금지 변종** — 정본이 다른 그림으로 소유한 액션의 대체 심볼.
 *
 * 조항 ①은 registry 가 **import 하는** 심볼만 본다. 그래서 정본이 `Trash2` 인데
 * 누가 `Trash` 를 집는 것은 못 잡는다 — 그런데 그게 정확히 2026-08-16 에 고친
 * 두 발산의 형태다 (삭제 `Trash`, 눈금자 `Ruler`). 고쳐 놓고 재도입을 막지
 * 않으면 같은 자리로 돌아온다.
 *
 * 새 항목은 "이 액션의 정본은 무엇이고 왜 이 변종이 아닌가" 가 답해질 때만.
 */
const BANNED_VARIANTS: Record<string, { canonicalKey: string; why: string }> = {
  Trash: {
    canonicalKey: "delete",
    why: "삭제 정본은 `Trash2`. 2026-08-16 이전 FramesTab 2파일이 `Trash` 였다.",
  },
  Ruler: {
    canonicalKey: "toggleRulers",
    why: "눈금자 토글 정본은 `RulerDimensionLine` (Settings 패널·History 정합).",
  },
  CirclePlus: {
    canonicalKey: "add",
    why:
      "추가 어포던스 정본은 `Plus` 하나 — 아이콘 단독 버튼이라고 원형 변종을 " +
      "쓰지 않는다. 그 자리의 다른 아이콘(gear/trash)이 전부 선화 단독이다.",
  },
  PlusCircle: {
    canonicalKey: "add",
    why: "`CirclePlus` 의 구 lucide 별칭 — 같은 이유로 금지.",
  },
};

function isIntentionalDivergence(file: string, symbol: string): boolean {
  return INTENTIONAL_DIVERGENCE.some(
    (entry) => entry.file === file && entry.symbols.includes(symbol),
  );
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      collectSourceFiles(full, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.(test|spec)\.tsx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

const SOURCE_FILES = collectSourceFiles(BUILDER_SRC).map((full) => ({
  rel: relative(BUILDER_SRC, full).split("\\").join("/"),
  text: readFileSync(full, "utf8"),
}));

const registry = SOURCE_FILES.find((f) => f.rel === REGISTRY_REL);
if (!registry) throw new Error(`registry 를 못 찾음: ${REGISTRY_REL}`);

/** registry 가 `lucide-react` 에서 가져오는 심볼 = 정본이 소유한 심볼 집합. */
const OWNED_SYMBOLS = new Set(
  (
    registry.text.match(
      /import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/,
    )?.[1] ?? ""
  )
    .split(",")
    .map((raw) =>
      raw
        .trim()
        .split(/\s+as\s+/)[0]
        .trim(),
    )
    .filter(Boolean),
);

/** registry 가 선언하는 `ACTION_ICONS` 키 목록. */
const REGISTRY_KEYS = (() => {
  const body =
    registry.text.match(
      /export const ACTION_ICONS = \{([\s\S]*?)\n\} as const/,
    )?.[1] ?? "";
  return body
    .split("\n")
    .map((line) => line.match(/^\s{2}([A-Za-z][A-Za-z0-9]*):\s/)?.[1])
    .filter((key): key is string => Boolean(key));
})();

/** 한 파일이 `lucide-react` 에서 가져오는 심볼. */
function lucideImportsOf(text: string): string[] {
  const symbols: string[] = [];
  const re = /import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    for (const raw of match[1].split(",")) {
      const symbol = raw
        .trim()
        .split(/\s+as\s+/)[0]
        .trim();
      if (symbol && /^[A-Z]/.test(symbol)) symbols.push(symbol);
    }
  }
  return symbols;
}

/** 한 파일이 참조하는 `ACTION_ICONS` 키 — member 접근과 분해 할당 양쪽. */
function actionIconKeysOf(text: string): string[] {
  const keys: string[] = [];
  for (const match of text.matchAll(
    /\bACTION_ICONS\.([A-Za-z][A-Za-z0-9]*)/g,
  )) {
    keys.push(match[1]);
  }
  const destructure = /const\s*\{([^}]*)\}\s*=\s*ACTION_ICONS\b/g;
  let match: RegExpExecArray | null;
  while ((match = destructure.exec(text))) {
    for (const raw of match[1].split(",")) {
      const key = raw.trim().split(":")[0].trim();
      if (key) keys.push(key);
    }
  }
  return keys;
}

describe("ACTION_ICONS — 등재 심볼의 registry 밖 직접 import 0건", () => {
  it("정본이 소유한 lucide 심볼을 다른 파일이 직접 집지 않는다", () => {
    const violations: string[] = [];

    for (const file of SOURCE_FILES) {
      if (file.rel === REGISTRY_REL) continue;
      for (const symbol of lucideImportsOf(file.text)) {
        if (!OWNED_SYMBOLS.has(symbol)) continue;
        if (isIntentionalDivergence(file.rel, symbol)) continue;
        violations.push(`${file.rel} — ${symbol}`);
      }
    }

    expect(
      violations,
      `여러 화면에 공통으로 나오는 액션 아이콘은 \`${REGISTRY_REL}\` 의 ` +
        `ACTION_ICONS 에서 고른다. 낱개 lucide 심볼을 직접 집으면 다른 진입점과 ` +
        `갈린다 (실측: 삭제 Trash2/Trash, 눈금자 Ruler/RulerDimensionLine).\n` +
        `그 액션이 정말 이 화면에만 있다면 registry 에서 항목을 빼는 것이 맞다.`,
    ).toEqual([]);
  });

  it("registry 가 소유하는 심볼 목록이 비어 있지 않다 (파싱 회귀 감지)", () => {
    // 위 가드는 OWNED_SYMBOLS 가 비면 조용히 전부 통과한다.
    expect(OWNED_SYMBOLS.size).toBeGreaterThanOrEqual(15);
  });
});

describe("ACTION_ICONS — 금지 변종 0건", () => {
  it("정본이 다른 그림을 쓰는 액션의 대체 심볼을 아무도 집지 않는다", () => {
    const violations: string[] = [];

    for (const file of SOURCE_FILES) {
      if (file.rel === REGISTRY_REL) continue;
      for (const symbol of lucideImportsOf(file.text)) {
        const banned = BANNED_VARIANTS[symbol];
        if (!banned) continue;
        if (isIntentionalDivergence(file.rel, symbol)) continue;
        violations.push(
          `${file.rel} — ${symbol} (→ ACTION_ICONS.${banned.canonicalKey}: ${banned.why})`,
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it("금지 변종이 가리키는 정본 키가 실재한다 (오타 감지)", () => {
    const missing = Object.entries(BANNED_VARIANTS)
      .filter(([, v]) => !REGISTRY_KEYS.includes(v.canonicalKey))
      .map(([symbol, v]) => `${symbol} → ${v.canonicalKey}`);
    expect(missing).toEqual([]);
  });
});

describe("ACTION_ICONS — 등재 항목별 소비처 ≥1", () => {
  const consumers = SOURCE_FILES.filter((f) => f.rel !== REGISTRY_REL);
  const referencedKeys = new Set(
    consumers.flatMap((file) => actionIconKeysOf(file.text)),
  );
  const referencedMaps = new Set(
    Object.keys(DERIVED_COVERAGE).filter((name) =>
      consumers.some((file) => file.text.includes(name)),
    ),
  );
  const coveredByDerived = new Set(
    [...referencedMaps].flatMap((name) => DERIVED_COVERAGE[name]),
  );

  it("키 목록 파싱이 살아 있다", () => {
    expect(REGISTRY_KEYS.length).toBeGreaterThanOrEqual(15);
  });

  it.each(REGISTRY_KEYS)("`%s` 를 쓰는 곳이 있다", (key) => {
    expect(
      referencedKeys.has(key) || coveredByDerived.has(key),
      `ACTION_ICONS.${key} 의 소비처가 0건이다. 정본에 남아 있으면 "고를 수 ` +
        `있는 것" 으로 잘못 읽히므로 삭제한다 — 도입 계획은 CHANGELOG 가 기록한다.`,
    ).toBe(true);
  });
});
