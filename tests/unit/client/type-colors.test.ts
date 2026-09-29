import { expect, test } from "vitest";
import { TYPE_COLORS, typeTextColor } from "../../../src/client/ui/TypeChip.tsx";

function luminance(hex: string) {
  const linear = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}

test("Every official type colour keeps WCAG AA contrast for its label", () => {
  for (const [type, background] of Object.entries(TYPE_COLORS)) {
    const values = [luminance(background), luminance(typeTextColor(type))].sort((a, b) => a - b);
    const ratio = (values[1]! + 0.05) / (values[0]! + 0.05);
    expect(ratio, `${type} text contrast`).toBeGreaterThanOrEqual(4.5);
  }
});
