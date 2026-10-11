import { describe, expect, it } from "vitest";
import {
  comparisonsOk,
  forbiddenFound,
  numbersOk,
  scrubModelTic,
  surnamesOk,
  validateAiText,
} from "./ai-validate";

describe("ai-validate", () => {
  it("rejects brake-pressure claims (incl. the drivers/ERS trap)", () => {
    expect(forbiddenFound("He braked with 90 bar of brake pressure")).toBe(true);
    expect(forbiddenFound("Drivers must slow down")).toBe(false);
    expect(forbiddenFound("ERS deployment was strong")).toBe(true);
    expect(forbiddenFound("tyre temperature rose")).toBe(true);
  });

  it("checks every number against context", () => {
    const ctx = 'Gap 1.2 s, lap 41, median 96.448';
    expect(numbersOk("Gap is 1.2 s on lap 41.", ctx)).toBe(true);
    expect(numbersOk("Gap is 2.5 s on lap 41.", ctx)).toBe(false);
  });

  it("rejects unlisted driver surnames", () => {
    const roster = new Set(["Verstappen", "Russell", "Bottas"]);
    expect(surnamesOk("Verstappen leads Russell.", new Set(["Verstappen", "Russell"]), roster)).toBe(true);
    expect(surnamesOk("Verstappen leads Bottas.", new Set(["Verstappen", "Russell"]), roster)).toBe(false);
  });

  it("catches inverted lap-time comparisons", () => {
    expect(comparisonsOk("95.555 is faster than 95.303")).toBe(false);
    expect(comparisonsOk("95.303 is faster than 95.555")).toBe(true);
  });

  it("scrubs the model tic unless evidence has an ESTIMATE", () => {
    expect(scrubModelTic("Good pace. This is a model, not a measurement.", false)).toBe("Good pace.");
    expect(scrubModelTic("Good pace. This is a model, not a measurement.", true)).toContain("model");
  });

  it("validates end to end", () => {
    const ctx = "VER gap 0.4 s lap 12";
    const roster = new Set(["Verstappen", "Russell"]);
    expect(
      validateAiText("Verstappen leads by 0.4 s on lap 12.", ctx, new Set(["Verstappen"]), roster).ok
    ).toBe(true);
    expect(
      validateAiText("Brake pressure was 90 bar on lap 12.", ctx, new Set(["Verstappen"]), roster)
        .reason
    ).toBe("forbidden-signal");
    expect(
      validateAiText("Verstappen braked at 90 bar on lap 12.", ctx, new Set(["Verstappen"]), roster)
        .reason
    ).toBe("number-check");
  });
});
