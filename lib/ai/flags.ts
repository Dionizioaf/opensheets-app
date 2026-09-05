export const isAiCategorizationEnabled = (): boolean => {
    return process.env.AI_CATEGORIZATION_ENABLED !== "false";
};

export const isAiCategorizationEnabledClient = (): boolean => {
    return process.env.NEXT_PUBLIC_AI_CATEGORIZATION_ENABLED !== "false";
};
