import { describe, expect, it } from "vitest";
import { formatDeadlineLabel, getDeadlineUrgency, isExpired } from "@/lib/deadline";

const DAY = 86400000;

describe("getDeadlineUrgency", () => {
  it("returns 'none' when there is no deadline", () => {
    expect(getDeadlineUrgency(null)).toBe("none");
  });

  it("returns 'expired' for a past deadline", () => {
    expect(getDeadlineUrgency(new Date(Date.now() - DAY))).toBe("expired");
  });

  it("returns 'today' for a deadline within the current day", () => {
    expect(getDeadlineUrgency(new Date(Date.now() + 1000))).toBe("today");
  });

  it("returns 'soon' within 3 days", () => {
    expect(getDeadlineUrgency(new Date(Date.now() + 2 * DAY))).toBe("soon");
  });

  it("returns 'this-week' within 7 days", () => {
    expect(getDeadlineUrgency(new Date(Date.now() + 6 * DAY))).toBe("this-week");
  });

  it("returns 'this-month' within 30 days", () => {
    expect(getDeadlineUrgency(new Date(Date.now() + 20 * DAY))).toBe("this-month");
  });

  it("returns 'later' beyond 30 days", () => {
    expect(getDeadlineUrgency(new Date(Date.now() + 90 * DAY))).toBe("later");
  });
});

describe("isExpired", () => {
  it("is true only for past deadlines", () => {
    expect(isExpired(new Date(Date.now() - DAY))).toBe(true);
    expect(isExpired(new Date(Date.now() + DAY))).toBe(false);
    expect(isExpired(null)).toBe(false);
  });
});

describe("formatDeadlineLabel", () => {
  it("mentions rolling/no deadline when null", () => {
    expect(formatDeadlineLabel(null)).toMatch(/no deadline/i);
  });

  it("mentions 'passed' for an expired deadline", () => {
    expect(formatDeadlineLabel(new Date(Date.now() - DAY))).toMatch(/passed/i);
  });

  it("mentions 'today' for a same-day deadline", () => {
    expect(formatDeadlineLabel(new Date(Date.now() + 1000))).toMatch(/today/i);
  });

  it("says 'Rolling' only when deadlineType is explicitly ROLLING, never merely from a null deadline", () => {
    expect(formatDeadlineLabel(null, "ROLLING")).toMatch(/rolling/i);
    expect(formatDeadlineLabel(null, "NOT_STATED")).not.toMatch(/rolling/i);
    expect(formatDeadlineLabel(null)).not.toMatch(/rolling/i);
  });

  it("says 'Ongoing' only when deadlineType is explicitly ONGOING", () => {
    expect(formatDeadlineLabel(null, "ONGOING")).toMatch(/ongoing/i);
  });
});
