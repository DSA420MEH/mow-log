import { z } from "zod";

// Base Event Schema
const baseEventSchema = z.object({
    id: z.string().uuid(),
    date: z.date(),
    notes: z.string().optional(),
});

// Mowing Schema
export const MowingEventSchema = baseEventSchema.extend({
    type: z.literal("mow"),
    cutHeightInches: z.number().min(0.5).max(5),
    grassBagged: z.boolean(),
    deckCleaned: z.boolean().default(false),
});

// Watering Schema
export const WateringEventSchema = baseEventSchema.extend({
    type: z.literal("water"),
    durationMinutes: z.number().min(1).max(300),
    waterAmountInches: z.number().optional(), // Estimated amount
    zones: z.array(z.string()).optional(), // e.g., ["Front Yard", "Backyard"]
});

// Fertilizing Schema
export const FertilizingEventSchema = baseEventSchema.extend({
    type: z.literal("fertilize"),
    productName: z.string().min(1, "Product name is required"),
    npkRatio: z.string().regex(/^\d+-\d+-\d+$/, "Must be in N-P-K format (e.g., 20-0-5)"),
    applicationRate: z.string().optional(), // e.g., "3 lbs per 1000 sq ft"
});

// Combined Event Type for general logging
export const LawnEventSchema = z.discriminatedUnion("type", [
    MowingEventSchema,
    WateringEventSchema,
    FertilizingEventSchema,
]);

// TypeScript Types inferred from Zod Schemas
export type MowingEvent = z.infer<typeof MowingEventSchema>;
export type WateringEvent = z.infer<typeof WateringEventSchema>;
export type FertilizingEvent = z.infer<typeof FertilizingEventSchema>;
export type LawnEvent = z.infer<typeof LawnEventSchema>;
