const HEADER_KEYWORDS = {
  date: [
    "data",
    "data compra",
    "data do lancamento",
    "data lancamento",
  ],
  description: [
    "lançamento",
    "lancamento",
    "descrição",
    "descricao",
    "historico",
    "estabelecimento",
  ],
  amount: ["valor", "valor (r$)", "valor (rs)"],
};

type ConvertedExcel = {
  csv: string;
  delimiter: ";";
};

type HeaderMatch = {
  score: number;
  nonEmptyCells: number;
};

const normalizeCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeForCompare = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
};

const scoreHeaderRow = (cells: string[]): HeaderMatch => {
  const normalized = cells.map(normalizeForCompare);
  const hasMatch = (keywords: string[]) =>
    keywords.some((keyword) => {
      const normalizedKeyword = normalizeForCompare(keyword);
      return normalized.some(
        (cell) => cell === normalizedKeyword || cell.includes(normalizedKeyword)
      );
    });

  let score = 0;
  if (hasMatch(HEADER_KEYWORDS.date)) score += 1;
  if (hasMatch(HEADER_KEYWORDS.description)) score += 1;
  if (hasMatch(HEADER_KEYWORDS.amount)) score += 1;

  const nonEmptyCells = cells.filter((cell) => cell.trim()).length;

  return { score, nonEmptyCells };
};

const findHeaderRowIndex = (rows: string[][]): number => {
  let fallbackIndex = -1;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const { score, nonEmptyCells } = scoreHeaderRow(row);
    if (score >= 2) return index;
    if (fallbackIndex === -1 && nonEmptyCells >= 2) {
      fallbackIndex = index;
    }
  }

  return fallbackIndex === -1 ? 0 : fallbackIndex;
};

const escapeCsvValue = (value: string, delimiter: string): string => {
  if (value.includes("\"")) {
    value = value.replace(/"/g, "\"\"");
  }

  if (value.includes(delimiter) || value.includes("\n") || value.includes("\"")) {
    return `"${value}"`;
  }

  return value;
};

const buildCsv = (rows: string[][], delimiter: string): string => {
  return rows
    .map((row) =>
      row.map((cell) => escapeCsvValue(cell, delimiter)).join(delimiter)
    )
    .join("\n");
};

const hasUsefulRows = (rows: string[][]): boolean => {
  return rows.some((row) => row.filter((cell) => cell.trim()).length >= 2);
};

const INTERNATIONAL_IGNORE = new Set([
  "canada",
  "united states",
  "united kingdom",
  "eua",
  "usa",
  "estados unidos",
]);

const shouldIgnoreInternationalDescription = (value: string): boolean => {
  const normalized = normalizeForCompare(value);
  if (!normalized) return true;
  if (normalized.includes("dolar de conversao")) return true;
  if (normalized.includes("dólar de conversão")) return true;
  if (normalized.includes("valor em dolar")) return true;
  if (INTERNATIONAL_IGNORE.has(normalized)) return true;
  return false;
};

const filterExcelRows = (rows: string[][]): string[][] => {
  if (rows.length === 0) return rows;
  const header = rows[0];
  const dataRows = rows.slice(1);
  const filtered: string[][] = [];

  let mode: "national" | "international" = "national";
  let currentDate = "";

  const isStopRow = (value: string) => {
    const normalized = normalizeForCompare(value);
    return (
      normalized === "encargos" ||
      normalized === "encargos e servicos" ||
      normalized === "encargos e serviços"
    );
  };

  const isIgnoreTotalRow = (value: string) => {
    const normalized = normalizeForCompare(value);
    return normalized.startsWith("total nacional do cartao");
  };

  const isInternationalHeader = (value: string) => {
    const normalized = normalizeForCompare(value);
    return normalized.includes("lancamentos internacionais");
  };

  const isNationalHeader = (value: string) => {
    const normalized = normalizeForCompare(value);
    return normalized.includes("lancamentos nacionais");
  };

  for (const row of dataRows) {
    const firstCol = row[0] ?? "";
    if (!firstCol && row.every((cell) => !cell.trim())) continue;

    if (isStopRow(firstCol)) {
      break;
    }

    if (isInternationalHeader(firstCol)) {
      mode = "international";
      currentDate = "";
      continue;
    }

    if (isNationalHeader(firstCol)) {
      mode = "national";
      currentDate = "";
      continue;
    }

    if (isIgnoreTotalRow(firstCol)) {
      continue;
    }

    if (mode === "international") {
      const description = row[1] ?? "";
      const value = row[3] ?? row[2] ?? "";
      if (firstCol.trim()) {
        currentDate = firstCol.trim();
      }

      if (!currentDate) continue;
      if (shouldIgnoreInternationalDescription(description)) continue;

      filtered.push([currentDate, description, "", value]);
      continue;
    }

    filtered.push(row);
  }

  return [header, ...filtered];
};

export async function convertExcelToCsv(file: File): Promise<ConvertedExcel> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheetNames = workbook.SheetNames ?? [];
  if (sheetNames.length === 0) {
    throw new Error("Arquivo Excel sem planilhas.");
  }

  const delimiter = ";";
  let selectedRows: string[][] | null = null;

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    }) as unknown[][];

    const rows = rawRows.map((row) =>
      row.map((cell) => normalizeCell(cell))
    );

    if (!hasUsefulRows(rows)) continue;

    const headerIndex = findHeaderRowIndex(rows);
    const dataRows = rows
      .slice(headerIndex)
      .filter((row) => row.some((cell) => cell.trim()));

    if (dataRows.length === 0) continue;

    selectedRows = filterExcelRows(dataRows);
    break;
  }

  if (!selectedRows) {
    throw new Error("Não foi possível ler dados úteis do Excel.");
  }

  return {
    csv: buildCsv(selectedRows, delimiter),
    delimiter: ";",
  };
}
