// Calendrier de disponibilité : fusion des intervalles et plage demandée (sans base de données)
import { describe, expect, it } from "vitest";
import { mergeIntervals, resolveRange, toPeriods } from "../src/services/availability.js";

const d = (value) => new Date(`${value}T00:00:00Z`);
const iso = (intervals) =>
  intervals.map(({ start, end }) => [
    start.toISOString().slice(0, 10),
    end.toISOString().slice(0, 10),
  ]);

describe("fusion des intervalles", () => {
  it("fusionne les intervalles qui se chevauchent, dans le désordre", () => {
    const merged = mergeIntervals([
      { start: d("2026-11-10"), end: d("2026-11-15") },
      { start: d("2026-11-01"), end: d("2026-11-05") },
      { start: d("2026-11-03"), end: d("2026-11-08") },
    ]);
    expect(iso(merged)).toEqual([
      ["2026-11-01", "2026-11-08"],
      ["2026-11-10", "2026-11-15"],
    ]);
  });

  it("fusionne les intervalles qui se touchent (fin de l'un = début de l'autre)", () => {
    const merged = mergeIntervals([
      { start: d("2026-11-01"), end: d("2026-11-03") },
      { start: d("2026-11-03"), end: d("2026-11-06") },
    ]);
    expect(iso(merged)).toEqual([["2026-11-01", "2026-11-06"]]);
  });

  it("garde un intervalle contenu dans un autre sans raccourcir le plus grand", () => {
    const merged = mergeIntervals([
      { start: d("2026-11-01"), end: d("2026-11-20") },
      { start: d("2026-11-05"), end: d("2026-11-06") },
    ]);
    expect(iso(merged)).toEqual([["2026-11-01", "2026-11-20"]]);
  });

  it("ignore les intervalles vides et renvoie une liste vide sans données", () => {
    expect(mergeIntervals([])).toEqual([]);
    expect(mergeIntervals([{ start: d("2026-11-02"), end: d("2026-11-02") }])).toEqual([]);
  });

  it("ramène les périodes à la plage et donne le dernier jour occupé (bornes comprises)", () => {
    const periods = toPeriods(
      [
        { start: d("2026-10-20"), end: d("2026-11-03") },
        { start: d("2026-11-28"), end: d("2026-12-10") },
      ],
      d("2026-11-01"),
      d("2026-12-01")
    );
    expect(periods).toEqual([
      { start: "2026-11-01", end: "2026-11-02" },
      { start: "2026-11-28", end: "2026-11-30" },
    ]);
  });
});

describe("plage demandée", () => {
  const now = new Date("2026-10-26T15:00:00Z");

  it("par défaut : aujourd'hui et les 89 jours suivants (90 jours)", () => {
    expect(resolveRange({}, now)).toMatchObject({ from: "2026-10-26", to: "2027-01-23" });
  });

  it("ne consulte jamais les jours passés", () => {
    const range = resolveRange({ from: "2026-10-01", to: "2026-10-31" }, now);
    expect(range.start.toISOString().slice(0, 10)).toBe("2026-10-26");
  });

  it("refuse une plage inversée, de plus de 90 jours ou trop lointaine", () => {
    expect(() => resolveRange({ from: "2026-11-10", to: "2026-11-01" }, now)).toThrow();
    expect(() => resolveRange({ from: "2026-11-01", to: "2027-01-30" }, now)).toThrow(/90/);
    expect(() => resolveRange({ from: "2028-01-01" }, now)).toThrow(/lointaine/);
  });
});
