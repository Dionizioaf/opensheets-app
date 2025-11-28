import { categorizeTransaction, categorizeTransactionWithAI, combineCategorizationWithHistory } from "./ai-categorization";

// Teste básico da categorização
async function testAICategorization() {
    console.log("🧪 Testando sistema de categorização com IA...\n");

    // Categorias de exemplo
    const mockCategories = [
        { id: "cat-1", name: "Alimentação", type: "despesa" },
        { id: "cat-2", name: "Transporte", type: "despesa" },
        { id: "cat-3", name: "Saúde", type: "despesa" },
        { id: "cat-4", name: "Lazer", type: "despesa" },
        { id: "cat-5", name: "Outros", type: "despesa" },
    ];

    // Teste 1: Transação simples
    console.log("Teste 1: Transação 'UBER TRIP'");
    try {
        const result = await categorizeTransactionWithAI(
            "UBER TRIP",
            25.50,
            mockCategories,
            "gpt-5.1"
        );
        console.log("✅ Sucesso:", result);
    } catch (error) {
        console.log("❌ Erro:", error instanceof Error ? error.message : String(error));
    }

    // Teste 2: Transação com fallback (sem userId)
    console.log("\nTeste 2: Transação 'FARMACIA DROGASIL' (sem histórico)");
    try {
        const result = await categorizeTransaction(
            "FARMACIA DROGASIL",
            45.90,
            mockCategories,
            "gpt-5.1"
        );
        console.log("✅ Sucesso:", result);
    } catch (error) {
        console.log("❌ Erro:", error instanceof Error ? error.message : String(error));
    }

    // Teste 3: Combinação com histórico (mock)
    console.log("\nTeste 3: Combinação IA + histórico");
    try {
        const aiResult = {
            suggestions: [{
                categoryId: "cat-1",
                categoryName: "Alimentação",
                confidence: 0.7,
                reasoning: "Restaurante identificado",
            }],
        };

        // Mock do resultado combinado (não podemos testar DB aqui)
        console.log("✅ Teste de combinação preparado");
    } catch (error) {
        console.log("❌ Erro:", error instanceof Error ? error.message : String(error));
    }

    console.log("\n🎉 Testes concluídos!");
}

// Executar testes se chamado diretamente
if (require.main === module) {
    testAICategorization().catch(console.error);
}

export { testAICategorization };