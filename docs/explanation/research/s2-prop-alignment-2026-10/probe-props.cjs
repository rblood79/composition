const ts = require(process.argv[2]);
const entry = process.argv[3];
const out = process.argv[4];
const program = ts.createProgram([entry], {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, skipLibCheck: true, types: [],
});
const checker = program.getTypeChecker();
const sf = program.getSourceFile(entry);
const mod = checker.getSymbolAtLocation(sf.statements[0].moduleSpecifier);
const moduleExports = checker.getExportsOfModule(mod);
const SKIP_FILES = /@react-types\/shared\/src\/(dom|events)\.d\.ts|react\/global\.d\.ts|@types\/react/;
const result = {};
for (const sym of moduleExports) {
  const name = sym.getName();
  if (!/^[A-Z]/.test(name)) continue;
  let target = sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
  if (!(target.flags & (ts.SymbolFlags.Variable | ts.SymbolFlags.Function))) continue;
  const type = checker.getTypeOfSymbolAtLocation(target, sf);
  const sig = type.getCallSignatures()[0];
  if (!sig || !sig.parameters.length) continue;
  const pType = checker.getTypeOfSymbolAtLocation(sig.parameters[0], sf);
  const props = {};
  for (const p of checker.getPropertiesOfType(pType)) {
    const pn = p.getName();
    if (/^(on[A-Z]|aria-|UNSAFE_|data-)/.test(pn) || ["styles","children","slot","id","key","ref","className","style"].includes(pn)) continue;
    const decl = p.getDeclarations()?.[0];
    const file = decl?.getSourceFile().fileName ?? "";
    const owner = decl?.parent && decl.parent.name ? decl.parent.name.text : "";
    if (/@types\/react|react\/global\.d\.ts/.test(file)) continue;
    if (["GlobalDOMAttributes", "DOMProps", "AriaLabelingProps", "AriaDescriptionProps", "StyleProps", "SlotProps"].includes(owner)) continue;
    if (/@react-types\/shared\/src\/events\.d\.ts/.test(file)) continue;
    const t = checker.typeToString(checker.getTypeOfSymbolAtLocation(p, sf), undefined, ts.TypeFormatFlags.NoTruncation);
    const src = /react-aria-components/.test(file) ? "RAC" : /react-aria\//.test(file) || /react-stately/.test(file) || /@react-types/.test(file) ? "aria" : /@react-spectrum\/s2/.test(file) ? "S2" : file.split("node_modules/").pop();
    props[pn] = { type: t, src };
  }
  if (Object.keys(props).length) result[name] = props;
}
require("fs").writeFileSync(out, JSON.stringify(result, null, 1));
console.log(Object.keys(result).length, "components");
