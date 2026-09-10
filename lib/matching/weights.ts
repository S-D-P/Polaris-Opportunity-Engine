// Named, tunable weights for the matching engine (docs/architecture.md §5). Keeping
// these as constants in one file means scoring behavior can be tuned without touching
// scoring logic.
export const WEIGHTS = {
  ELIGIBILITY_MAX: 15,
  INTEREST_MAX: 25,
  SKILLS_MAX: 15,
  GOAL_MAX: 20,
  PREFERENCE_MAX: 15,
  TIMING_MAX: 10,
} as const;

export const TOTAL_MAX =
  WEIGHTS.ELIGIBILITY_MAX +
  WEIGHTS.INTEREST_MAX +
  WEIGHTS.SKILLS_MAX +
  WEIGHTS.GOAL_MAX +
  WEIGHTS.PREFERENCE_MAX +
  WEIGHTS.TIMING_MAX; // == 100
