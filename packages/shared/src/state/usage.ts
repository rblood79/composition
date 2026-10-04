/** catalog 변수의 사용처. 수집은 graph 소비자의 stateVariables가 소유한다. */
export type VariableUsage =
  | { kind: "template"; nodeId: string; props: string[] }
  | { kind: "setState"; ruleId: string; elementId: string; trigger: string };
