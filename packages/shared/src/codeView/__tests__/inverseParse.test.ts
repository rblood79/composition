import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { structuredLiteralOf } from "../inverse";
import {
  codeViewLineAt,
  codeViewNormalized,
  parseCodeView,
  type CodeViewElement,
} from "../inverse/parse";

/**
 * ADR-285 Phase 1 (G1) — the code view's code read back with the editor's parser (decision 4 —
 * lezer). The generated golden files (ADR-284 acceptance set) read with no problem: every statement
 * is a vocabulary kind and the page's JSX is a tree. Code outside the vocabulary is a problem with
 * its line.
 */
const GENERATED = join(
  dirname(fileURLToPath(import.meta.url)),
  "../__fixtures__/generated",
);
const golden = readdirSync(GENERATED).map((file) => ({
  file,
  code: readFileSync(join(GENERATED, file), "utf8"),
}));

const count = (elements: readonly CodeViewElement[]): number =>
  elements.reduce((sum, element) => sum + 1 + count(element.children), 0);

describe("structuredLiteralOf — JSON own keys", () => {
  it("preserves reserved keys without changing object prototypes", () => {
    const parsed = structuredLiteralOf(
      "{['__proto__']: {enabled: true}, nested: {['__proto__']: 1}, constructor: 'data'}",
    )!.value as Record<string, unknown>;
    expect(JSON.stringify(parsed)).toBe(
      '{"__proto__":{"enabled":true},"nested":{"__proto__":1},"constructor":"data"}',
    );
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(Object.hasOwn(parsed, "__proto__")).toBe(true);
    expect(parsed.enabled).toBeUndefined();
  });

  it.each(["{[name]: 1}", "{[run()]: 1}", "{['a' + 'b']: 1}"])(
    "rejects expressions in a computed key: %s",
    (text) => expect(structuredLiteralOf(text)).toBeUndefined(),
  );
});

describe("parseCodeView — the generated golden 5", () => {
  it.each(golden)("$file reads with no problem", ({ code }) => {
    const parsed = parseCodeView(code);
    expect(parsed.problems).toEqual([]);
    expect(parsed.component?.name).toMatch(/^[A-Z]/);
    expect(parsed.jsx?.roots.length).toBeGreaterThan(0);
    // (Every `<` that opens an element in the returned JSX is an element of the tree — rows
    // templates aside.)
    const jsx = code.slice(parsed.jsx!.from, parsed.jsx!.to);
    const rowItems = (jsx.match(/\{item => </g) ?? []).length;
    const opened = (jsx.match(/<[A-Za-z]/g) ?? []).length;
    expect(count(parsed.jsx!.roots)).toBe(opened - rowItems);
  });
});

describe("parseCodeView — shapes", () => {
  it("reads statements, attributes, text, a visibility state and a row template", () => {
    const code = `import {ListBox, ListBoxItem, Text} from 'react-aria-components';
import users from './data/users';

export default function Home() {
  let [q, setQ] = useState('');
  let items = users
    .filter(item =>
      contains(String(item.name), q));
  return (
    <>
      {open && <Text color="red" isHidden>A {q}</Text>}
      <ListBox items={items}>
        {item => <ListBoxItem id={item.id}>{item.name}</ListBoxItem>}
      </ListBox>
    </>
  );
}
`;
    const parsed = parseCodeView(code);
    expect(parsed.problems).toEqual([]);
    expect(parsed.statements.map((item) => [item.kind, item.name])).toEqual([
      ["import", undefined],
      ["import", undefined],
      ["state", "q"],
      ["view", "items"],
    ]);
    expect(parsed.statements[2]!.setter).toBe("setQ");
    const [text, list] = parsed.jsx!.roots;
    expect(text!.type).toBe("Text");
    expect(text!.visibleState).toBe("open");
    expect(code.slice(text!.from, text!.to)).toBe(
      `{open && <Text color="red" isHidden>A {q}</Text>}`,
    );
    expect(
      text!.attributes.map((item) => [item.name, item.value?.code]),
    ).toEqual([
      ["color", "red"],
      ["isHidden", undefined],
    ]);
    expect(text!.text?.code).toBe("A {q}");
    expect(list!.attributes[0]!.value).toMatchObject({
      kind: "expression",
      code: "items",
    });
    expect(list!.rows?.code).toMatch(/^\{item => <ListBoxItem/);
    expect(list!.children).toEqual([]);
  });

  it.each([
    ["a call statement", "doSomething();"],
    ["a computed declaration", "let [a, setA] = useReducer(r, 0);"],
    ["a loop", "while (true) {}"],
    ["a class", "class Foo {}"],
    ["an if statement", "if (q) setQ('');"],
    ["a const", "const total = 1;"],
    ["a throw", "throw new Error('x');"],
  ])("refuses %s in the component with its line", (_, line) => {
    const code = `export default function Home() {\n  ${line}\n  return (\n    <>\n    </>\n  );\n}\n`;
    const parsed = parseCodeView(code);
    expect(parsed.problems.length).toBeGreaterThan(0);
    expect(codeViewLineAt(code, parsed.problems[0]!.from)).toBe(2);
  });

  it("reads a function in the component as a handler statement (ADR-296 E9 — the planner reads its body)", () => {
    const parsed = parseCodeView(
      "export default function Home() {\n  function onButtonPress() {\n    setQ('');\n  }\n  return (\n    <>\n    </>\n  );\n}\n",
    );
    expect(parsed.problems).toEqual([]);
    expect(parsed.statements).toMatchObject([
      { kind: "handler", name: "onButtonPress" },
    ]);
  });

  it("refuses a module function and a spread attribute", () => {
    const fn = parseCodeView(
      "function helper() {}\nexport default function Home() {\n  return (\n    <>\n    </>\n  );\n}\n",
    );
    expect(fn.problems).toMatchObject([{ reason: "outsideVocabulary" }]);
    const spread = parseCodeView(
      "export default function Home() {\n  return (\n    <>\n      <Text {...props} />\n    </>\n  );\n}\n",
    );
    expect(spread.problems).toMatchObject([{ reason: "outsideVocabulary" }]);
  });

  it("marks broken code as unparsable (never throws)", () => {
    const parsed = parseCodeView(
      "export default function Home() {\n  return (\n    <>\n      <Text>Text\n    </>\n  );\n}\n",
    );
    expect(parsed.problems.some((item) => item.reason === "unparsable")).toBe(
      true,
    );
  });
});

describe("codeViewNormalized", () => {
  it("drops whitespace and comments, keeps strings and word separators", () => {
    expect(
      codeViewNormalized("let  x =\n  'a  b' // c\n  + `d  e`; /* f */"),
    ).toBe("let x='a  b'+`d  e`;");
    expect(codeViewNormalized("fetch('https://x.io/a')")).toBe(
      "fetch('https://x.io/a')",
    );
  });
});
