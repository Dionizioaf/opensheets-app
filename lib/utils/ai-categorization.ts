import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categorias, lancamentos } from "@/db/schema";
import {
    CategorySuggestionSchema,
    AICategorizationResponseSchema,
    CombinedCategorizationSchema,
    type CategorySuggestion,
    type AICategorizationResponse,
    type CombinedCategorization,
} from "@/lib/schemas/ai-categorization";
import { CATEGORIZATION_SYSTEM_PROMPT } from "./ai-categorization-data";

/**
 * Busca histórico de transações similares para fallback
 */
async function findHistoricalMatches(
    userId: string,
    transactionName: string,
    limit: number = 10
) {
    // Buscar transações com nomes similares nos últimos 6 meses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const similarTransactions = await db
        .select({
            categoriaId: lancamentos.categoriaId,
            categoryName: categorias.name,
            transactionName: lancamentos.name,
            count: sql<number>`count(*)`,
            lastUsed: sql<string>`max(${lancamentos.purchaseDate})`,
        })
        .from(lancamentos)
        .innerJoin(categorias, eq(lancamentos.categoriaId, categorias.id))
        .where(
            and(
                eq(lancamentos.userId, userId),
                sql`${lancamentos.name} ILIKE ${`%${transactionName}%`}`,
                sql`${lancamentos.purchaseDate} >= ${sixMonthsAgo.toISOString().split('T')[0]}`
            )
        )
        .groupBy(lancamentos.categoriaId, categorias.name, lancamentos.name)
        .orderBy(sql`count(*) DESC`)
        .limit(limit);

    return similarTransactions;
}

/**
 * Calcula similaridade entre strings usando algoritmo simples
 */
function calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Contar palavras em comum
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word)).length;

    return Math.min(commonWords / Math.max(words1.length, words2.length), 0.6);
}

/**
 * Categoriza uma transação usando IA
 */
export async function categorizeTransactionWithAI(
    transactionName: string,
    transactionAmount: number,
    availableCategories: Array<{ id: string; name: string; type: string }>,
    modelId: string = "gpt-5.1",
    userId?: string
): Promise<AICategorizationResponse> {
    try {
        // Filtrar apenas categorias de despesa
        const expenseCategories = availableCategories.filter(cat => cat.type === "despesa");

        if (expenseCategories.length === 0) {
            throw new Error("Nenhuma categoria de despesa disponível");
        }

        // Selecionar provider baseado no modelId
        let model;
        if (modelId.includes("/")) {
            // OpenRouter format: provider/model
            const apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey) {
                throw new Error("OPENROUTER_API_KEY não configurada");
            }
            const openrouter = createOpenRouter({ apiKey });
            model = openrouter.chat(modelId);
        } else if (modelId.startsWith("gpt-")) {
            model = openai(modelId);
        } else if (modelId.startsWith("claude-")) {
            model = anthropic(modelId);
        } else if (modelId.startsWith("gemini-")) {
            model = google(modelId);
        } else {
            throw new Error(`Provider não suportado para modelo: ${modelId}`);
        }

        // Chamar IA para categorização
        const result = await generateObject({
            model,
            schema: z.object({
                suggestions: z.array(z.object({
                    categoryId: z.string(),
                    categoryName: z.string(),
                    confidence: z.number().min(0).max(1),
                    reasoning: z.string(),
                })).min(1).max(5),
            }),
            system: CATEGORIZATION_SYSTEM_PROMPT,
            prompt: `Categorize a seguinte transação:

**Transação:** ${transactionName}
**Valor:** R$ ${transactionAmount.toFixed(2)}

**Categorias disponíveis:**
${expenseCategories.map(cat => `- ${cat.name} (ID: ${cat.id})`).join('\n')}

Analise a transação e sugira as 1-5 categorias mais apropriadas com seus níveis de confiança. Considere palavras-chave, contexto e padrões comuns de gastos.`,
        });

        // Mapear nomes para IDs das categorias disponíveis
        const suggestions = result.object.suggestions.map(suggestion => {
            const matchedCategory = expenseCategories.find(
                cat => cat.name.toLowerCase() === suggestion.categoryName.toLowerCase()
            );

            return {
                categoryId: matchedCategory?.id || suggestion.categoryId,
                categoryName: matchedCategory?.name || suggestion.categoryName,
                confidence: suggestion.confidence,
                reasoning: suggestion.reasoning,
            };
        });

        return {
            suggestions,
            fallbackUsed: false,
        };
    } catch (error) {
        console.error("Erro na categorização com IA:", error);

        // Fallback para matching histórico se userId fornecido
        if (userId) {
            try {
                const historicalMatches = await findHistoricalMatches(userId, transactionName, 5);

                if (historicalMatches.length > 0) {
                    const suggestions = historicalMatches.map((match: any) => ({
                        categoryId: match.categoriaId,
                        categoryName: match.categoryName,
                        confidence: Math.min(match.count * 0.15, 0.8), // Confiança baseada na frequência
                        reasoning: `Baseado em ${match.count} transação(ões) similar(es) anterior(es)`,
                    }));

                    return {
                        suggestions,
                        fallbackUsed: true,
                    };
                }
            } catch (fallbackError) {
                console.error("Erro no fallback histórico:", fallbackError);
            }
        }

        // Último fallback: categoria genérica
        const genericCategory = availableCategories.find(cat => cat.name.toLowerCase().includes("outros"));
        const fallbackCategory = genericCategory || availableCategories[0];

        if (!fallbackCategory) {
            throw new Error("Nenhuma categoria disponível para fallback");
        }

        return {
            suggestions: [{
                categoryId: fallbackCategory.id,
                categoryName: fallbackCategory.name,
                confidence: 0.1,
                reasoning: "Categorização automática - categoria padrão",
            }],
            fallbackUsed: true,
        };
    }
}

/**
 * Combina sugestões da IA com matching histórico
 */
export async function combineCategorizationWithHistory(
    aiResponse: AICategorizationResponse,
    userId: string,
    transactionName: string
): Promise<CombinedCategorization> {
    const historicalMatches = await findHistoricalMatches(userId, transactionName, 1);

    let primarySuggestion = aiResponse.suggestions[0];
    const alternativeSuggestions = aiResponse.suggestions.slice(1);

    // Se há match histórico forte, verificar se deve ser promovido
    if (historicalMatches.length > 0) {
        const bestHistorical = historicalMatches[0];
        const historicalConfidence = Math.min(bestHistorical.count * 0.15, 0.9);

        // Se histórico tem confiança maior que a IA, usar histórico como primário
        if (historicalConfidence > primarySuggestion.confidence) {
            primarySuggestion = {
                categoryId: bestHistorical.categoriaId,
                categoryName: bestHistorical.categoryName,
                confidence: historicalConfidence,
                reasoning: `Match histórico forte (${bestHistorical.count} ocorrências)`,
            };
        }

        return {
            primarySuggestion,
            alternativeSuggestions: aiResponse.suggestions.slice(0, 4),
            historicalMatch: {
                categoryId: bestHistorical.categoriaId,
                categoryName: bestHistorical.categoryName,
                confidence: historicalConfidence,
                matchCount: bestHistorical.count,
                lastUsed: bestHistorical.lastUsed,
            },
        };
    }

    return {
        primarySuggestion,
        alternativeSuggestions,
        historicalMatch: undefined,
    };
}

/**
 * Verifica se a IA está habilitada para o usuário (placeholder para futuras configurações)
 */
export function isAICategorizationEnabled(userPreferences?: any): boolean {
    // Por enquanto sempre habilitado, mas pode ser expandido para verificar preferências do usuário
    // Futuramente pode verificar uma tabela de configurações do usuário
    // ou um campo nas configurações da conta
    return true;
}

/**
 * Categoriza uma transação com verificação de preferências do usuário
 */
export async function categorizeTransaction(
    transactionName: string,
    transactionAmount: number,
    availableCategories: Array<{ id: string; name: string; type: string }>,
    modelId: string = "gpt-5.1",
    userId?: string,
    userPreferences?: any
): Promise<CombinedCategorization> {
    // Verificar se IA está habilitada
    const aiEnabled = isAICategorizationEnabled(userPreferences);

    if (!aiEnabled || !userId) {
        // Fallback direto para histórico
        const historicalMatches = await findHistoricalMatches(userId || "", transactionName, 5);

        if (historicalMatches.length > 0) {
            const bestMatch = historicalMatches[0];
            const confidence = Math.min(bestMatch.count * 0.15, 0.8);

            return {
                primarySuggestion: {
                    categoryId: bestMatch.categoriaId,
                    categoryName: bestMatch.categoryName,
                    confidence,
                    reasoning: `Categorização baseada em histórico (${bestMatch.count} ocorrências)`,
                },
                alternativeSuggestions: historicalMatches.slice(1, 5).map((match: any) => ({
                    categoryId: match.categoriaId,
                    categoryName: match.categoryName,
                    confidence: Math.min(match.count * 0.15, 0.8),
                    reasoning: `Match histórico (${match.count} ocorrências)`,
                })),
                historicalMatch: {
                    categoryId: bestMatch.categoriaId,
                    categoryName: bestMatch.categoryName,
                    confidence,
                    matchCount: bestMatch.count,
                    lastUsed: bestMatch.lastUsed,
                },
            };
        }

        // Último fallback
        const genericCategory = availableCategories.find(cat => cat.name.toLowerCase().includes("outros"));
        const fallbackCategory = genericCategory || availableCategories[0];

        return {
            primarySuggestion: {
                categoryId: fallbackCategory.id,
                categoryName: fallbackCategory.name,
                confidence: 0.1,
                reasoning: "Categoria padrão - IA desabilitada",
            },
            alternativeSuggestions: [],
            historicalMatch: undefined,
        };
    }

    // IA habilitada - usar categorização completa
    const aiResponse = await categorizeTransactionWithAI(
        transactionName,
        transactionAmount,
        availableCategories,
        modelId,
        userId
    );

    return combineCategorizationWithHistory(aiResponse, userId, transactionName);
}