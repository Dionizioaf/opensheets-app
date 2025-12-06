import { parseOfxFile } from "../parser";
import type { OfxStatement } from "../types";

/**
 * Unit tests for OFX parser
 * Tests parsing of OFX files from Itaú and other Brazilian banks
 * 
 * Note: Run these tests with your test framework (Jest, Vitest, etc.)
 * Example: npm test or pnpm test
 */

describe("parseOfxFile", () => {
    describe("Valid OFX files", () => {
        it("should parse Itaú OFX file correctly", async () => {
            const sampleOfx = getSampleItauOfx();

            const result = await parseOfxFile(sampleOfx);

            expect(result).toBeDefined();
            expect(result.account).toBeDefined();
            expect(result.account.bankId).toBe("341"); // Itaú bank code
            expect(result.transactions).toBeInstanceOf(Array);
            expect(result.transactions.length).toBeGreaterThan(0);
            expect(result.currency).toBe("BRL");
        });

        it("should extract account information", async () => {
            const sampleOfx = getSampleItauOfx();

            const result = await parseOfxFile(sampleOfx);

            expect(result.account.accountId).toBeDefined();
            expect(result.account.accountType).toBeDefined();
            expect(result.account.bankId).toBe("341");
        });

        it("should parse transactions with all fields", async () => {
            const sampleOfx = getSampleItauOfx();

            const result = await parseOfxFile(sampleOfx);

            const firstTransaction = result.transactions[0];
            expect(firstTransaction.fitId).toBeDefined();
            expect(firstTransaction.amount).toBeDefined();
            expect(firstTransaction.datePosted).toBeInstanceOf(Date);
            expect(firstTransaction.type).toBeDefined();
        });

        it("should parse date range correctly", async () => {
            const sampleOfx = getSampleItauOfx();

            const result = await parseOfxFile(sampleOfx);

            expect(result.startDate).toBeInstanceOf(Date);
            expect(result.endDate).toBeInstanceOf(Date);
            expect(result.endDate.getTime()).toBeGreaterThanOrEqual(result.startDate.getTime());
        });
    });

    describe("Invalid OFX files", () => {
        it("should throw error for empty content", async () => {
            await expect(parseOfxFile("")).rejects.toMatchObject({
                code: "INVALID_FILE",
            });
        });

        it("should throw error for non-OFX content", async () => {
            // Parser will fail, resulting in PARSE_ERROR
            await expect(parseOfxFile("This is not OFX")).rejects.toMatchObject({
                code: "PARSE_ERROR",
            });
        });

        it("should throw error for malformed OFX", async () => {
            const malformed = `
        <OFX>
          <SIGNONMSGSRSV1>
          </SIGNONMSGSRSV1>
        </OFX>
      `;

            await expect(parseOfxFile(malformed)).rejects.toMatchObject({
                code: "PARSE_ERROR",
            });
        });

        it("should handle OFX with no transactions", async () => {
            const noTransactions = getOfxWithNoTransactions();

            const result = await parseOfxFile(noTransactions);

            // Should parse successfully but return empty transactions array
            expect(result.transactions).toHaveLength(0);
            expect(result.account).toBeDefined();
        });
    });

    describe("OFX date parsing", () => {
        it("should parse OFX date format correctly", async () => {
            const sampleOfx = getSampleItauOfx();

            const result = await parseOfxFile(sampleOfx);

            const transaction = result.transactions[0];
            expect(transaction.datePosted.getFullYear()).toBeGreaterThan(2000);
            expect(transaction.datePosted.getMonth()).toBeGreaterThanOrEqual(0);
            expect(transaction.datePosted.getMonth()).toBeLessThan(12);
        });
    });

    describe("Transaction type handling", () => {
        it("should handle debit transactions", async () => {
            const sampleOfx = getSampleItauOfx();

            const result = await parseOfxFile(sampleOfx);

            const debitTransaction = result.transactions.find(t => t.amount < 0);
            expect(debitTransaction).toBeDefined();
            expect(debitTransaction!.type).toBeDefined();
        });

        it("should handle credit transactions", async () => {
            const sampleOfx = getSampleOfxWithCredit();

            const result = await parseOfxFile(sampleOfx);

            const creditTransaction = result.transactions.find(t => t.amount > 0);
            expect(creditTransaction).toBeDefined();
        });
    });
});

/**
 * Sample Itaú OFX file structure
 * Based on typical Itaú bank statement format
 */
function getSampleItauOfx(): string {
    return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <DTSERVER>20231215120000
      <LANGUAGE>POR
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>1
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <STMTRS>
        <CURDEF>BRL
        <BANKACCTFROM>
          <BANKID>341
          <ACCTID>12345-6
          <ACCTTYPE>CHECKING
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20231201120000
          <DTEND>20231215120000
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20231205120000
            <TRNAMT>-150.00
            <FITID>202312051
            <MEMO>COMPRA CARTAO - MERCADO
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20231208120000
            <TRNAMT>-50.50
            <FITID>202312082
            <NAME>FARMACIA SAO PAULO
            <MEMO>PAGAMENTO DEBITO
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20231210120000
            <TRNAMT>1500.00
            <FITID>202312103
            <NAME>SALARIO
            <MEMO>DEPOSITO SALARIO
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>1299.50
          <DTASOF>20231215120000
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;
}

/**
 * Sample OFX with credit transaction
 */
function getSampleOfxWithCredit(): string {
    return getSampleItauOfx(); // Already includes credit transaction
}

/**
 * Sample OFX with no transactions
 */
function getOfxWithNoTransactions(): string {
    return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <DTSERVER>20231215120000
      <LANGUAGE>POR
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>1
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <STMTRS>
        <CURDEF>BRL
        <BANKACCTFROM>
          <BANKID>341
          <ACCTID>12345-6
          <ACCTTYPE>CHECKING
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20231201120000
          <DTEND>20231215120000
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;
}
