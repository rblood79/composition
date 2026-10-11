// G5 example 9 — Dialog: DialogTrigger > Button + Modal > Dialog > Heading slot=title + p + Form
// (TextField ×2 + div > Button slot=close ×2) — react-aria.adobe.com Modal.
import { canvasVsPreview, diff, edit, launch, newProject, place, press, previewHtml, recordOf, reopen, structure } from "./harness.mjs";
import { closeOverlays, dropAnchors, dumpTree, lastHtml, refMount, unwrapTrigger } from "./helpers-a.mjs";

const TEXT = "Enter your information to subscribe to our newsletter and receive updates about new features and announcements.";

const kids = (page, id, type) =>
  page.evaluate(({ id, type }) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return root.canvasInputs.get(id).children.filter((k) => !type || root.typeOf(root.canvasInputs.get(k)) === type);
  }, { id, type });

const reference = (open) => new Function("h", "R", `
  const field = (label, placeholder, extra) => h(R.TextField, extra, h(R.Label, null, label), h(R.Input, { placeholder }), h(R.FieldError, null));
  return h(R.DialogTrigger, ${open ? "{ defaultOpen: true }" : "null"}, h(R.Button, null, "Sign up…"),
    h(R.Modal, null, h(R.Dialog, null,
      h(R.Heading, { slot: "title" }, "Subscribe to our newsletter"),
      h("p", null, ${JSON.stringify(TEXT)}),
      h(R.Form, null,
        field("Name", "Enter your full name", { autoFocus: true }),
        field("Email", "Enter your email", null),
        h("div", null, h(R.Button, { slot: "close" }, "Cancel"), h(R.Button, { slot: "close" }, "Subscribe"))))));`);
const pickOverlay = (host, doc) => { const all = doc.querySelectorAll(".react-aria-ModalOverlay"); return all[all.length - 1]?.outerHTML ?? null; };

async function compare(page, label, previewSide, referenceSide) {
  const p = await structure(page, dropAnchors(previewSide));
  const r = await structure(page, referenceSide ?? "");
  const d = diff(p, r);
  return { label, structure: d ? { pass: false, d } : { pass: true } };
}

export async function run(page) {
  const edits = [];
  const src = await place(page, "lib:definition:origin-component-dialog");
  // Deleting the origin's close Button (or its footer) in the instance is refused —
  // REQUIRED_PART_NOT_REMOVABLE "DialogTrigger>Button" (template path, structure.ts assertTemplatePartsKept)
  // though the trigger Button stays. The Design panel's Detach instance makes the parts the page's own.
  const refusedInInstance = await edit(page, (c, ws, h, src) => {
    const dialog = h.within(h.bySource(src).id, "Dialog")[0].id;
    return c.removeTargets({ targets: [h.target(h.within(dialog, "DialogFooter")[0].id)] });
  }, src);
  edits.push(await edit(page, (c, ws, h, src) => c.detachInstances({ ids: [src], newId: ws.newId }), src));
  const root = await recordOf(page, src);
  const [button] = await kids(page, root, "Button");
  const [modal] = await kids(page, root, "Modal");
  const [dialog] = await kids(page, modal, "Dialog");
  edits.push(await edit(page, (c, ws, h, [button, dialog]) => {
    const heading = h.within(dialog, "Heading")[0];
    const drop = h.get(dialog).children.map((k) => h.get(k)).filter((k) => ["frame", "DialogFooter"].includes(h.type(k)));
    return [
      h.props(button, { children: "Sign up…" }),
      h.props(heading.id, { children: "Subscribe to our newsletter" }),
      ...drop.map((k) => h.later(() => c.removeTargets({ targets: [h.target(k.id)] }))),
      h.later(() => h.insert(dialog, [h.node(h.newId(), "lib:definition:type-Paragraph", { children: "Enter your information to subscribe to our newsletter and receive updates about new features and announcements." })])),
      h.later(() => h.insert(dialog, [h.node(h.newId(), "lib:definition:origin-component-form")])),
    ];
  }, [button, dialog]));
  const [form] = await kids(page, dialog, "Form");
  edits.push(await edit(page, (c, ws, h, form) => {
    const [name, email] = h.within(form, "TextField");
    const group = h.within(form, "ButtonGroup")[0];
    const frame = h.newId();
    return [
      h.props(name.id, { isRequired: false, autoFocus: true }),
      h.props(email.id, { isRequired: false, type: "text" }),
      h.later(() => c.removeTargets({ targets: [h.target(group.id)] })),
      h.later(() => h.insert(form, [h.node(frame, "lib:definition:type-frame")])),
    ];
  }, form));
  const [frame] = await kids(page, form, "frame");
  edits.push(await edit(page, (c, ws, h, frame) => [
    h.insert(frame, [h.node(h.newId(), "lib:definition:origin-component-button", { children: "Cancel", slot: "close", variant: "secondary" })]),
    h.later(() => h.insert(frame, [h.node(h.newId(), "lib:definition:origin-component-button", { children: "Subscribe", slot: "close" })])),
  ], frame));
  const tree = await dumpTree(page, src);
  const reopened = await reopen(page);
  const id = await recordOf(page, src);
  const out = [];
  const closedHtml = await previewHtml(page, id);
  const closedRef = await refMount(page, reference(false));
  out.push({ ...(await compare(page, "closed (as is)", closedHtml, closedRef)), canvas: await canvasVsPreview(page, id) });
  out.push(await compare(page, "closed (ADR-255 trigger wrapper out)", unwrapTrigger(closedHtml), closedRef));
  await press(page, `[data-catalog-id="${id}"] button`);
  const opened = await lastHtml(page, ".react-aria-ModalOverlay");
  await closeOverlays(page);
  out.push(await compare(page, "open", opened, await refMount(page, reference(true), { pick: pickOverlay })));
  return { refusedInInstance, edits: edits.filter((e) => !e.ok), editCount: edits.length, reopened, out, tree };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { browser, page, errors } = await launch();
  await newProject(page, `g5-ex09-${Date.now()}`);
  const r = await run(page);
  console.log(JSON.stringify(r, null, 1));
  console.log("errors", JSON.stringify(errors.slice(0, 6)));
  await browser.close();
}
