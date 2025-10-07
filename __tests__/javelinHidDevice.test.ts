/* eslint-disable @typescript-eslint/no-explicit-any */

import { 
  decodeJavEvent,
  decodeBase64ToBoolArray,
  DecodedJavEvent
} from "@/lib/javelinHidDevice"; // adjust import

// Basic helper to encode bit patterns as base64
function boolArrayToBase64(bits: boolean[]): string {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      if (bits[i + j]) byte |= (1 << j);
    }
    bytes.push(byte);
  }
  return btoa(String.fromCharCode(...bytes));
}

describe("decodeBase64ToBoolArray", () => {
  test("decodes single byte of 0xFF to 8 true bits", () => {
    const base64 = btoa(String.fromCharCode(0xFF));
    expect(decodeBase64ToBoolArray(base64)).toEqual([true, true, true, true, true, true, true, true]);
  });

  test("decodes mixed bit pattern correctly", () => {
    const base64 = boolArrayToBase64([true, false, true, false, true, false, true, false]);
    expect(decodeBase64ToBoolArray(base64)).toEqual([true, false, true, false, true, false, true, false]);
  });
});

describe("decodeJavEvent", () => {
  test("decodes dictionary status event", () => {
    const input = { e: "d", d: "user.json", v: 1 };
    const decoded = decodeJavEvent(input)! as unknown as DecodedJavEvent<"dictionary_status">;
    expect(decoded.event).toBe("dictionary_status");
    expect(decoded.detail.dictionary).toBe("user.json");
    expect(decoded.detail.enabled).toBe(true);
  });

  test("decodes button_state event with base64 data", () => {
    const bits = [true, false, true, false, false, false, false, false];
    const encoded = boolArrayToBase64(bits);
    const input = { e: "b", d: encoded };
    const decoded = decodeJavEvent(input)! as unknown as DecodedJavEvent<"button_state">;
    expect(decoded.event).toBe("button_state");
    expect(decoded.detail.keys).toEqual(bits);
  });

  test("decodes suggestion event", () => {
    const input = { e: "s", c: 2, t: "this is", o: ["TH-S", "STKHE", "STKH-B"] };
    const decoded = decodeJavEvent(input)! as unknown as DecodedJavEvent<"suggestion">;
    expect(decoded.event).toBe("suggestion");
    expect(decoded.detail.strokes).toBe(2);
    expect(decoded.detail.translation).toBe("this is");
    expect(decoded.detail.outlines).toEqual(["TH-S", "STKHE", "STKH-B"]);
  });

  test("decodes paper_tape event", () => {
    const input = { e: "p", o: "TH", d: "main.json", t: "this" };
    const decoded = decodeJavEvent(input)! as unknown as DecodedJavEvent<"paper_tape">;;
    expect(decoded.event).toBe("paper_tape");
    expect(decoded.detail.outline).toBe("TH");
    expect(decoded.detail.dictionary).toBe("main.json");
    expect(decoded.detail.translation).toBe("this");
  });

  test("decodes script event", () => {
    const input = { e: "c", t: "layer_id: 87377230" };
    const decoded = decodeJavEvent(input)! as unknown as DecodedJavEvent<"script">;
    expect(decoded.event).toBe("script");
    expect(decoded.detail.text).toBe("layer_id: 87377230");
  });

  test("decodes template_value event", () => {
    const input = { e: "v", i: 0, v: "test" };
    const decoded = decodeJavEvent(input)! as unknown as DecodedJavEvent<"template_value">;
    expect(decoded.event).toBe("template_value");
    expect(decoded.detail.index).toBe(0);
    expect(decoded.detail.value).toBe("test");
  });

  test("decodes serial event", () => {
    const input = { e: "l", d: "BAA=" };
    const decoded = decodeJavEvent(input)! as unknown as DecodedJavEvent<"serial">;
    expect(decoded.event).toBe("serial");
    expect(decoded.detail.data).toBe("BAA=");
  });

  test("decodes analog_data event", () => {
    const input = { e: "a", raw: "analog" };
    const decoded = decodeJavEvent(input)! as unknown as DecodedJavEvent<"analog_data">;
    expect(decoded.event).toBe("analog_data");
    expect(decoded.detail.raw).toBe(JSON.stringify(input));
  });

  test("returns null for unknown event alias", () => {
    const input = { e: "x", data: "unknown" };
    expect(decodeJavEvent(input)).toBeNull();
  });

  test("ignores unrecognized alias fields", () => {
    const input = { e: "t", t: "Hello", foo: "bar" };
    const decoded = decodeJavEvent(input)! as unknown as DecodedJavEvent<"text">;
    expect(decoded.event).toBe("text");
    expect(decoded.detail.text).toBe("Hello");
    expect((decoded.detail as any).foo).toBeUndefined();
  });
});