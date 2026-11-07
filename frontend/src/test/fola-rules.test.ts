import { describe, expect, it } from "vitest";
import { money } from "@/lib/format";
import { reportSummary } from "@/lib/reports";
import { mock } from "@/mocks/store";
import { initialReports } from "@/mocks/data";

describe("Fola rules", () => {
  it("formats negatives with a real minus sign", () => {
    expect(money(1353.07)).toBe("£1,353.07");
    expect(money(-60)).toBe("−£60.00");
  });
  it("summary counts monthly money ×12 for done and in-progress reports", () => {
    const reports = initialReports();
    const base = reports[0]!;
    reports.push({ ...base, id: "x", status: "resolved", money: { amount: 303.94, period: "month" } });
    reports.push({ ...base, id: "y", status: "referred", money: { amount: 999, period: "year" } });
    const s = reportSummary(reports);
    expect(s.perYear).toBeCloseTo(295 + 303.94 * 12, 2);
    expect([s.done, s.inProgress, s.referred]).toEqual([1, 1, 1]);
  });
  it("approving an action adds a report and marks the notification sorted", () => {
    const before = mock.reports().length;
    const r = mock.approve("act1", "Yes, do it");
    expect(mock.reports().length).toBe(before + 1);
    expect(mock.notifications().find((n) => n.id === "n1")?.status).toBe("resolved");
    expect(mock.reports().find((x) => x.id === r.report_id)?.steps.some((s) => s.user_quote === "Yes, do it")).toBe(true);
  });
  it("no pending voice action unless the user has been listening", () => {
    mock.setVoiceListening(false);
    expect(mock.pendingActions()).toEqual([]);
  });
});
