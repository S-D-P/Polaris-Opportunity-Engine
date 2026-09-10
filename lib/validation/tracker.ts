import { z } from "zod";
import { TRACK_STATUSES } from "@/lib/taxonomy";

export const trackerCreateSchema = z.object({
  opportunityId: z.string().min(1),
  status: z.enum(TRACK_STATUSES).default("SAVED"),
});

export const trackerUpdateSchema = z.object({
  status: z.enum(TRACK_STATUSES).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type TrackerCreateInput = z.infer<typeof trackerCreateSchema>;
export type TrackerUpdateInput = z.infer<typeof trackerUpdateSchema>;
