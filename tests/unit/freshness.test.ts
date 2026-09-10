import { describe, expect, it } from "vitest";
import { computeRefetchUpdate, deriveDeadlineStatus } from "@/lib/ingestion/freshness";

const NOW = new Date("2026-09-03T00:00:00.000Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe("deriveDeadlineStatus", () => {
  it("returns EXPIRED when the deadline has passed", () => {
    expect(deriveDeadlineStatus({ deadline: days(-1), currentStatus: "OPEN", now: NOW })).toBe("EXPIRED");
  });

  it("returns CLOSING_SOON when the deadline is within the window", () => {
    expect(deriveDeadlineStatus({ deadline: days(3), currentStatus: "OPEN", now: NOW })).toBe("CLOSING_SOON");
  });

  it("returns OPEN when the deadline is far in the future and status was CLOSING_SOON", () => {
    expect(deriveDeadlineStatus({ deadline: days(30), currentStatus: "CLOSING_SOON", now: NOW })).toBe("OPEN");
  });

  it("returns null when nothing would change", () => {
    expect(deriveDeadlineStatus({ deadline: days(30), currentStatus: "OPEN", now: NOW })).toBeNull();
  });

  it("never touches DRAFT", () => {
    expect(deriveDeadlineStatus({ deadline: days(-1), currentStatus: "DRAFT", now: NOW })).toBeNull();
  });

  it("never touches an explicitly CLOSED record", () => {
    expect(deriveDeadlineStatus({ deadline: days(30), currentStatus: "CLOSED", now: NOW })).toBeNull();
  });

  it("returns null when there is no deadline to reason about", () => {
    expect(deriveDeadlineStatus({ deadline: null, currentStatus: "OPEN", now: NOW })).toBeNull();
  });
});

describe("computeRefetchUpdate", () => {
  it("reports no change and still sets verifiedAt when nothing differs", () => {
    const result = computeRefetchUpdate({
      existing: { status: "OPEN", deadline: days(30), description: "Same text" },
      incoming: { deadline: days(30), description: "Same text" },
      now: NOW,
    });
    expect(result.changed).toBe(false);
    expect(result.verifiedAt).toBe(NOW);
    expect(result.deadline).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it("picks up an extended deadline from the source", () => {
    const result = computeRefetchUpdate({
      existing: { status: "CLOSING_SOON", deadline: days(3), description: "Same text" },
      incoming: { deadline: days(60), description: "Same text" },
      now: NOW,
    });
    expect(result.changed).toBe(true);
    expect(result.deadline).toEqual(days(60));
    expect(result.status).toBe("OPEN");
  });

  it("picks up a changed description", () => {
    const result = computeRefetchUpdate({
      existing: { status: "OPEN", deadline: days(30), description: "Old text" },
      incoming: { deadline: days(30), description: "New text" },
      now: NOW,
    });
    expect(result.changed).toBe(true);
    expect(result.description).toBe("New text");
  });

  it("reopens a CLOSED record when the source now shows a new future deadline", () => {
    const result = computeRefetchUpdate({
      existing: { status: "CLOSED", deadline: days(-10), description: "Same text" },
      incoming: { deadline: days(45), description: "Same text" },
      now: NOW,
    });
    expect(result.status).toBe("OPEN");
    expect(result.changed).toBe(true);
  });

  it("reopens an EXPIRED record when the source now shows a new future deadline", () => {
    const result = computeRefetchUpdate({
      existing: { status: "EXPIRED", deadline: days(-5), description: "Same text" },
      incoming: { deadline: days(20), description: "Same text" },
      now: NOW,
    });
    expect(result.status).toBe("OPEN");
  });

  it("does not reopen CLOSED when the incoming deadline is still in the past", () => {
    const result = computeRefetchUpdate({
      existing: { status: "CLOSED", deadline: days(-10), description: "Same text" },
      incoming: { deadline: days(-2), description: "Same text" },
      now: NOW,
    });
    expect(result.status).toBeUndefined();
  });

  it("transitions OPEN to EXPIRED on refetch if the deadline quietly passed", () => {
    const result = computeRefetchUpdate({
      existing: { status: "OPEN", deadline: days(-1), description: "Same text" },
      incoming: { deadline: days(-1), description: "Same text" },
      now: NOW,
    });
    expect(result.status).toBe("EXPIRED");
    expect(result.changed).toBe(true);
  });
});
