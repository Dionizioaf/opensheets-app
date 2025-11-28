import { z } from "zod";

/**
 * Schema para sugestão de categoria da IA
 */
export const CategorySuggestionSchema = z.object({
    categoryId: z.string().uuid(),
    categoryName: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
});

/**
 * Schema para resposta completa de categorização da IA
 */
export const AICategorizationResponseSchema = z.object({
    suggestions: z.array(CategorySuggestionSchema).min(1).max(5),
    fallbackUsed: z.boolean().optional(),
});

/**
 * Schema para combinação de sugestões IA + histórico
 */
export const CombinedCategorizationSchema = z.object({
    primarySuggestion: CategorySuggestionSchema,
    alternativeSuggestions: z.array(CategorySuggestionSchema).max(4),
    historicalMatch: z.object({
        categoryId: z.string().uuid(),
        categoryName: z.string(),
        confidence: z.number().min(0).max(1),
        matchCount: z.number(),
        lastUsed: z.string(), // ISO date
    }).optional(),
});

/**
 * Schema para entrada de categorização
 */
export const CategorizationInputSchema = z.object({
    transactionName: z.string().min(1),
    transactionAmount: z.number(),
    availableCategories: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        type: z.string(),
    })),
    modelId: z.string().optional(),
    userId: z.string().optional(),
});

/**
 * Tipos TypeScript
 */
export type CategorySuggestion = z.infer<typeof CategorySuggestionSchema>;
export type AICategorizationResponse = z.infer<typeof AICategorizationResponseSchema>;
export type CombinedCategorization = z.infer<typeof CombinedCategorizationSchema>;
export type CategorizationInput = z.infer<typeof CategorizationInputSchema>;