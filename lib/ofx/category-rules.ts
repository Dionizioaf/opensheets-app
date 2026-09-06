/**
 * Deterministic category rules supplied by the account owner.
 *
 * These rules intentionally run before historical/fuzzy suggestions. A
 * recurring bank descriptor should keep the same category even when the
 * historical data is incomplete or contains a conflicting category.
 */

export type CategoryRule = {
  id: string;
  description: string;
  categoryName: string;
  patterns: string[];
  maxAbsoluteAmount?: number;
  incomeCategoryName?: string;
};

export const USER_CATEGORY_RULES: CategoryRule[] = [
  {
    id: "transf-amanda-saude",
    description: "PIX TRANSF AMANDA",
    categoryName: "Saúde",
    patterns: ["TRANSF AMANDA"],
  },
  {
    id: "daev-casa",
    description: "DAEV (água)",
    categoryName: "Energia e água",
    patterns: ["DAEV"],
  },
  {
    id: "cpfl-casa",
    description: "CPFL (energia)",
    categoryName: "Energia e água",
    patterns: ["CPFL"],
  },
  {
    id: "claro-telecom",
    description: "CLARO",
    categoryName: "Telecomunicação",
    patterns: ["CLARO"],
    incomeCategoryName: "Outras receitas",
  },
  {
    id: "itau-black-pagamentos",
    description: "ITAU BLACK (pagamento do cartão)",
    categoryName: "Pagamentos",
    patterns: ["ITAU BLACK"],
  },
  {
    id: "pagaleve-outros",
    description: "PAGALEVE",
    categoryName: "Outras despesas",
    patterns: ["DEV PIX PAGALEVE", "PIX QRS PAGALEVE"],
    incomeCategoryName: "Outras receitas",
  },
  {
    id: "consignado-outros",
    description: "crédito consignado",
    categoryName: "Outras despesas",
    patterns: ["CREDITO CONSIGNADO", "CRED CONSIGNAD"],
  },
  {
    id: "andre-alimentacao",
    description: "PIX TRANSF ANDRE (valores baixos)",
    categoryName: "Alimentação",
    patterns: ["PIX TRANSF ANDRE"],
  },
  {
    id: "municipio-casa",
    description: "PIX QRS MUNICIPIO (IPTU)",
    categoryName: "Moradia",
    patterns: ["PIX QRS MUNICIPIO"],
  },
  {
    id: "vivo-telecom",
    description: "VIVO FIXO NAC",
    categoryName: "Telecomunicação",
    patterns: ["VIVO FIXO NAC"],
  },
  {
    id: "drogaria-conveniencia",
    description: "Drogaria Sao Paulo Sa abaixo de R$ 150",
    categoryName: "Conveniência",
    patterns: ["DROGARIA SAO PAULO SA"],
    maxAbsoluteAmount: 150,
  },
];

function normalizeDescriptor(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function getDeterministicCategoryRule(
  name: string,
  amount?: string | number,
  transactionType?: string
): CategoryRule | null {
  const normalizedName = normalizeDescriptor(name);
  const absoluteAmount =
    amount === undefined ? undefined : Math.abs(Number(amount));

  return (
    USER_CATEGORY_RULES.find((rule) => {
      const descriptorMatches = rule.patterns.some((pattern) =>
        normalizedName.includes(normalizeDescriptor(pattern))
      );

      if (!descriptorMatches) return false;
      if (rule.id === "drogaria-conveniencia" && transactionType === "Receita") {
        return false;
      }
      if (rule.maxAbsoluteAmount === undefined) return true;
      return (
        absoluteAmount !== undefined &&
        Number.isFinite(absoluteAmount) &&
        absoluteAmount < rule.maxAbsoluteAmount
      );
    }) ?? null
  );
}

export function getDeterministicCategoryName(
  rule: CategoryRule,
  transactionType?: string
): string {
  return transactionType === "Receita" && rule.incomeCategoryName
    ? rule.incomeCategoryName
    : rule.categoryName;
}
