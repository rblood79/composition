import reactConfig from "@composition/config/eslint/react";
import localRules from "./eslint-local-rules/index.js";

export default [
  ...reactConfig,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      local: {
        rules: localRules,
      },
    },
    rules: {
      // composition Anti-Pattern Detection Rules
      "local/no-zustand-grouped-selectors": "error",
      "local/no-zustand-use-shallow": "error",
      "local/prefer-keyboard-shortcuts-registry": "warn",
      "local/prefer-copy-paste-hook": "warn",
      "local/no-eventtype-legacy-import": "error",
      "local/no-deprecated-element-import": "error",
      // TanStack Virtual v3 는 React Compiler 비호환 — "use no memo" 로 opt-out 완료
      "react-hooks/incompatible-library": "off",
    },
  },
];
