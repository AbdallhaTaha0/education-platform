import { it, expect } from "vitest";
import { safeDownloadName } from "./downloads";
it("keeps file download names safe", () => {
  expect(safeDownloadName("../../etc/passwd", "fallback.pdf")).toBe("passwd");
  expect(safeDownloadName("", "fallback.pdf")).toBe("fallback.pdf");
  expect(safeDownloadName("notes.pdf", "fallback.pdf")).toBe("notes.pdf");
});
