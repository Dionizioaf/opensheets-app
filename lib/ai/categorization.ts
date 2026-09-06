import { AVAILABLE_MODELS } from "@/app/(dashboard)/insights/data";
import {
    AiCategorizationResponseSchema,
    type AiCategorizationResponse,
} from "@/lib/schemas/ai-categorization";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";

export type AiCategoriaTipo = "despesa" | "receita";

export interface AiCategoriaOption {
    id: string;
    name: string;
    type: AiCategoriaTipo;
}

export interface AiTransactionInput {
    id: string;
    nome: string;
    valor: string;
    tipo_transacao: "Despesa" | "Receita";
    categoriaId?: string | null;
    categoriaNome?: string | null;
}

const AI_CATEGORIZATION_SYSTEM_PROMPT = `Voce e um assistente de categorizacao financeira. Escolha a categoria mais adequada para cada transacao.

REGRAS:
- Use apenas as categorias fornecidas.
- Para transacoes do tipo "Despesa", use somente categorias com tipo "despesa".
- Para transacoes do tipo "Receita", use somente categorias com tipo "receita".
- Se a categoria atual parecer correta, mantenha-a.
- Se nao houver confianca, retorne categoriaId como null e confidence como "low".
- Retorne apenas JSON valido seguindo o schema.`;

function resolveModel(modelId: string) {
    const selectedModel = AVAILABLE_MODELS.find((model) => model.id === modelId);

    if (modelId.startsWith("openollama/")) {
        return createOpenAI({
            apiKey: process.env.OPENOLLAMA_API_KEY ?? "openollama",
            baseURL: process.env.OPENOLLAMA_BASE_URL ?? "http://localhost:11434/v1",
        }).chat(modelId.slice("openollama/".length));
    }

    if (!selectedModel && !modelId.includes("/")) {
        throw new Error("Modelo invalido.");
    }

    if (modelId.includes("/")) {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error(
                "OPENROUTER_API_KEY nao configurada. Adicione a chave no arquivo .env"
            );
        }

        const openrouter = createOpenRouter({ apiKey });
        return openrouter.chat(modelId);
    }

    if (selectedModel?.provider === "openai") {
        return openai(modelId);
    }

    if (selectedModel?.provider === "anthropic") {
        return anthropic(modelId);
    }

    if (selectedModel?.provider === "google") {
        return google(modelId);
    }

    if (selectedModel?.provider === "openollama") {
        return createOpenAI({
            apiKey: process.env.OPENOLLAMA_API_KEY ?? "openollama",
            baseURL: process.env.OPENOLLAMA_BASE_URL ?? "http://localhost:11434/v1",
        }).chat(modelId);
    }

    throw new Error("Provider de modelo nao suportado.");
}

function buildPrompt(
    categories: AiCategoriaOption[],
    transactions: AiTransactionInput[]
) {
    const categoriesByType = {
        despesa: categories.filter((category) => category.type === "despesa"),
        receita: categories.filter((category) => category.type === "receita"),
    };

    const payload = {
        categorias: categoriesByType,
        transacoes: transactions.map((transaction) => ({
            id: transaction.id,
            nome: transaction.nome,
            valor: transaction.valor,
            tipo_transacao: transaction.tipo_transacao,
            categoria_atual: transaction.categoriaId
                ? {
                    id: transaction.categoriaId,
                    nome: transaction.categoriaNome ?? null,
                }
                : null,
        })),
    };

    return `Analise as transacoes e escolha a melhor categoria.

Dados:
${JSON.stringify(payload, null, 2)}

Responda com um JSON valido no formato:
{
  "suggestions": [
    { "id": "...", "categoriaId": "uuid ou null", "confidence": "high|medium|low" }
  ]
}
`;
}

export async function suggestAiCategories(
    modelId: string,
    categories: AiCategoriaOption[],
    transactions: AiTransactionInput[]
): Promise<AiCategorizationResponse> {
    const model = resolveModel(modelId);

    const result = await generateObject({
        model,
        schema: AiCategorizationResponseSchema,
        system: AI_CATEGORIZATION_SYSTEM_PROMPT,
        prompt: buildPrompt(categories, transactions),
    });

    return AiCategorizationResponseSchema.parse(result.object);
}
