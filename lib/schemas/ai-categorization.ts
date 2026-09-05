import { z } from "zod";

export const AiCategorySuggestionSchema = z.object({
    id: z.string().min(1),
    categoriaId: z.string().uuid().nullable(),
    confidence: z.enum(["high", "medium", "low"]),
});

export const AiCategorizationResponseSchema = z.object({
    suggestions: z.array(AiCategorySuggestionSchema),
});

export type AiCategorySuggestion = z.infer<typeof AiCategorySuggestionSchema>;
export type AiCategorizationResponse = z.infer<
    typeof AiCategorizationResponseSchema
>;
