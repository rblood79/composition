import baseConfig from "@composition/config/eslint/base";

// ADR-201 HC4 — 의존 방향 `upload ← shared ← builder/publish` 단방향.
// composition 패키지 · RAC 는 어디서도 import 하지 않고, react 는 `src/react/**` 한정.
const forbidden = [
  { group: ["@composition/*"], message: "역방향 import 금지 (ADR-201 HC4)" },
  {
    group: ["react-aria-components", "react-aria", "react-stately"],
    message: "RAC 는 엔진 밖 (ADR-201 HC4)",
  },
];

export default [
  ...baseConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/react/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...forbidden,
            {
              group: ["react", "react/*", "react-dom", "react-dom/*"],
              message: "react 는 src/react/** 한정 (ADR-201 HC4)",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/react/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: forbidden }],
    },
  },
];
