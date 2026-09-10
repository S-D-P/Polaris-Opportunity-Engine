import { fromJsonArray } from "@/lib/db/json";
import { formatDeadlineLabel } from "@/lib/deadline";
import { OPPORTUNITY_TYPE_LABELS, type OpportunityTypeValue } from "@/lib/taxonomy";
import type { Opportunity } from "@prisma/client";

export interface SpecRow {
  label: string;
  value: string;
}

/** Structured fact rows shared by Concept B's detail spec-sheet and comparison table — one
 *  place that decides what "the facts" are so both views stay consistent. */
export function buildSpecRows(opportunity: Opportunity): SpecRow[] {
  const experienceReqs = fromJsonArray(opportunity.experienceRequirements);
  const educationReqs = fromJsonArray(opportunity.educationRequirements);
  const citizenshipReqs = fromJsonArray(opportunity.citizenshipRequirements).filter(
    (c) => c.toLowerCase() !== "any"
  );
  const countries = fromJsonArray(opportunity.countries);

  return [
    { label: "Type", value: OPPORTUNITY_TYPE_LABELS[opportunity.opportunityType as OpportunityTypeValue] },
    { label: "Deadline", value: formatDeadlineLabel(opportunity.deadline) },
    { label: "Cost", value: opportunity.isFree ? "Free" : opportunity.cost || "Paid" },
    { label: "Funding", value: opportunity.funding || "Not specified" },
    {
      label: "Location",
      value:
        [opportunity.remote && "Remote", opportunity.hybrid && "Hybrid", opportunity.inPerson && "In-person"]
          .filter(Boolean)
          .join(" / ") || "Not specified",
    },
    { label: "Countries", value: countries.length > 0 ? countries.join(", ") : "Not restricted" },
    { label: "Experience required", value: experienceReqs.length > 0 ? experienceReqs.join(", ") : "Not specified" },
    { label: "Education required", value: educationReqs.length > 0 ? educationReqs.join(", ") : "Not specified" },
    { label: "Citizenship required", value: citizenshipReqs.length > 0 ? citizenshipReqs.join(", ") : "Not restricted" },
    {
      label: "Verification",
      value:
        opportunity.verificationStatus === "VERIFIED"
          ? "Verified"
          : opportunity.verificationStatus === "AI_EXTRACTED"
            ? "AI-extracted"
            : "Needs review",
    },
  ];
}
