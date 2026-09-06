import { getDeterministicCategoryRule } from "@/lib/ofx/category-rules";

describe("deterministic category rules", () => {
  it("prioritizes owner rules and normalizes descriptors", () => {
    expect(getDeterministicCategoryRule("pix qrs claro08/08")?.categoryName).toBe(
      "Telecomunicação"
    );
  });

  it("only classifies the pharmacy rule below the amount threshold", () => {
    expect(
      getDeterministicCategoryRule("Drogaria Sao Paulo Sa", "149.99")?.categoryName
    ).toBe("Conveniência");
    expect(getDeterministicCategoryRule("Drogaria Sao Paulo Sa", "150")).toBeNull();
    expect(
      getDeterministicCategoryRule("Drogaria Sao Paulo Sa", "0.01", "Receita")
    ).toBeNull();
  });
});
