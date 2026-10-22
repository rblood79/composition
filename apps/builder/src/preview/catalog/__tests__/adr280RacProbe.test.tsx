import { act, fireEvent, render, screen } from "@testing-library/react";
import { User } from "@react-aria/test-utils";
import { useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  FieldError,
  Form,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  NumberField,
  Popover,
  Select,
  SelectValue,
  Slider,
  SliderThumb,
  SliderTrack,
  TextField,
} from "react-aria-components";
import { describe, expect, it, vi } from "vitest";

/**
 * ADR-280 Phase 0 §1c — what the installed RAC (1.22.1, D1 authority) does at the places the
 * ADR's decisions depend on. Facts, not wishes: each `it` pins the observed behavior so an RAC
 * upgrade that changes it turns RED here first. Source lines are the installed
 * `react-aria-components/dist/private/*.mjs` (recorded in the breakdown §1c table).
 */
describe("ADR-280 §1c — an overlay body's own isOpen beats its trigger's context", () => {
  it("a Modal given isOpen ignores its DialogTrigger: the trigger's press does not open it", async () => {
    // Modal.mjs:88-90 — `props.isOpen != null || props.defaultOpen != null || !contextState ?
    // localState : contextState` (Popover.mjs:53-55 · Tooltip.mjs:61-63 the same).
    render(
      <DialogTrigger>
        <Button>Open</Button>
        <Modal isOpen={false}>
          <Dialog>
            <Heading slot="title">Body</Heading>
          </Dialog>
        </Modal>
      </DialogTrigger>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the DialogTrigger given isOpen opens the body through its context", () => {
    const onOpenChange = vi.fn();
    const Probe = () => {
      const [open, setOpen] = useState(false);
      return (
        <DialogTrigger
          isOpen={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <Button>Open</Button>
          <Modal>
            <Dialog>
              <Heading slot="title">Body</Heading>
            </Dialog>
          </Modal>
        </DialogTrigger>
      );
    };
    render(<Probe />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
    });
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("ADR-280 §1c — a picker's ListBox follows the picker, not its own selectedKeys", () => {
  it("Select > Popover > ListBox: the ListBox's own selectedKeys is ignored", () => {
    // ListBox.mjs:72-78 — inside a Select the ListBox renders from the Select's ListStateContext.
    render(
      <Select aria-label="Pick" defaultSelectedKey="a">
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox selectedKeys={["b"]}>
            <ListBoxItem id="a">A</ListBoxItem>
            <ListBoxItem id="b">B</ListBoxItem>
          </ListBox>
        </Popover>
      </Select>,
    );
    expect(screen.getByRole("button").textContent).toContain("A");
  });
});

describe("ADR-280 §1c — range: RAC state clamps a controlled value (no range guard needed)", () => {
  it("a Slider given value 150 of 0..100 reports 100", () => {
    render(
      <Slider aria-label="S" value={150} minValue={0} maxValue={100}>
        <SliderTrack>
          <SliderThumb />
        </SliderTrack>
      </Slider>,
    );
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe(
      "100",
    );
  });

  it("a NumberField given value 150 of 0..100 shows 100", () => {
    render(
      <NumberField aria-label="N" value={150} minValue={0} maxValue={100}>
        <Input />
      </NumberField>,
    );
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("100");
  });
});

describe("ADR-280 §1c — Form: requestSubmit runs RAC validation, reset runs useFormReset", () => {
  const ProbeForm = (props: {
    onSubmit: () => void;
    onChange: (value: string) => void;
  }) => {
    const [value, setValue] = useState("start");
    return (
      <Form
        data-testid="form"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
      >
        <TextField
          aria-label="Name"
          isRequired
          value={value}
          onChange={(next) => {
            props.onChange(next);
            setValue(next);
          }}
        >
          <Label>Name</Label>
          <Input />
          <FieldError />
        </TextField>
      </Form>
    );
  };

  it("requestSubmit with an empty required field does not submit", () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    render(<ProbeForm onSubmit={onSubmit} onChange={onChange} />);
    act(() => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    });
    act(() => {
      (screen.getByTestId("form") as HTMLFormElement).requestSubmit();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requestSubmit with a valid field submits once", () => {
    const onSubmit = vi.fn();
    render(<ProbeForm onSubmit={onSubmit} onChange={() => {}} />);
    act(() => {
      (screen.getByTestId("form") as HTMLFormElement).requestSubmit();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("reset calls a controlled field's onChange with its first value", () => {
    const onChange = vi.fn();
    render(<ProbeForm onSubmit={() => {}} onChange={onChange} />);
    act(() => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "typed" },
      });
    });
    onChange.mockClear();
    act(() => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
    });
    expect(onChange).toHaveBeenCalledWith("start");
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "start",
    );
  });
});

describe("ADR-280 §1d — @react-aria/test-utils runs in this harness", () => {
  it("the ListBox tester reads and drives a RAC ListBox", async () => {
    const user = new User({ interactionType: "mouse" });
    render(
      <ListBox aria-label="L" selectionMode="single">
        <ListBoxItem id="a">A</ListBoxItem>
        <ListBoxItem id="b">B</ListBoxItem>
      </ListBox>,
    );
    const tester = user.createTester("ListBox", {
      root: screen.getByRole("listbox"),
    });
    await tester.toggleOptionSelection({ option: 1 });
    expect(tester.getOptions()[1]?.getAttribute("aria-selected")).toBe("true");
  });
});
