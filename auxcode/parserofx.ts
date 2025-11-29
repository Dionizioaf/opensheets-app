
// lib/ofxParser.ts

interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: string;
  description: string;
  memo?: string;
  checkNum?: string;
  refNum?: string;
}

interface Account {
  bankId: string;
  accountId: string;
  accountType: string;
  balance: number;
  balanceDate: string;
  currency: string;
  transactions: Transaction[];
}

interface OFXParsedData {
  bankName?: string;
  accounts: Account[];
  dtStart: string;
  dtEnd: string;
  rawText: string;
}

/**
 * Parses OFX file content to structured JSON
 * Handles both SGML and XML OFX formats
 */
export async function parseOFX(ofxContent: string): Promise<OFXParsedData> {
  try {
    // Remove BOM if present
    const cleanContent = ofxContent.replace(/^\uFEFF/, '').trim();
    
    // Detect format and parse accordingly
    if (cleanContent.includes('<?xml')) {
      return parseXMLOFX(cleanContent);
    } else {
      return parseSGMLOFX(cleanContent);
    }
  } catch (error) {
    throw new Error(`OFX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parses XML-based OFX (OFX 2.0)
 */
function parseXMLOFX(xmlContent: string): OFXParsedData {
  const accounts: Account[] = [];
  
  // Extract bank info
  const bankName = extractValue(xmlContent, 'ORGNAME') || 'Unknown Bank';
  
  // Extract statement transactions
  const stmtList = xmlContent.match(/<STMTTRS>[\s\S]*?<\/STMTTRS>/g) || [];
  
  for (const stmt of stmtList) {
    const account: Account = {
      bankId: extractValue(stmt, 'BANKID') || '',
      accountId: extractValue(stmt, 'ACCTID') || '',
      accountType: extractValue(stmt, 'ACCTTYPE') || 'CHECKING',
      balance: parseFloat(extractValue(stmt, 'BALAMT') || '0'),
      balanceDate: formatDate(extractValue(stmt, 'DTASOF') || ''),
      currency: extractValue(stmt, 'CURDEF') || 'USD',
      transactions: []
    };

    // Parse transactions
    const transactionMatches = stmt.matchAll(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g);
    for (const match of transactionMatches) {
      const txn = match[0];
      const transaction: Transaction = {
        id: extractValue(txn, 'FITID') || `txn-${Date.now()}`,
        date: formatDate(extractValue(txn, 'DTPOSTED') || ''),
        amount: parseFloat(extractValue(txn, 'TRNAMT') || '0'),
        type: extractValue(txn, 'TRNTYPE') || 'OTHER',
        description: extractValue(txn, 'NAME') || '',
        memo: extractValue(txn, 'MEMO'),
        checkNum: extractValue(txn, 'CHECKNUM'),
        refNum: extractValue(txn, 'REFNUM')
      };
      account.transactions.push(transaction);
    }

    accounts.push(account);
  }

  return {
    bankName,
    accounts,
    dtStart: extractValue(xmlContent, 'DTSTART') || '',
    dtEnd: extractValue(xmlContent, 'DTEND') || '',
    rawText: xmlContent
  };
}

/**
 * Parses SGML-based OFX (OFX 1.x)
 * This is the legacy format without XML declaration
 */
function parseSGMLOFX(sgmlContent: string): OFXParsedData {
  const accounts: Account[] = [];
  
  // Extract header info
  const bankName = extractSGMLValue(sgmlContent, 'ORGNAME') || 'Unknown Bank';
  
  // Find all banking statements
  const stmtBlocks = sgmlContent.match(/<STMTRS>[\s\S]*?<\/STMTRS>/g) || [];
  
  for (const stmtBlock of stmtBlocks) {
    const account: Account = {
      bankId: extractSGMLValue(stmtBlock, 'BANKID') || '',
      accountId: extractSGMLValue(stmtBlock, 'ACCTID') || '',
      accountType: extractSGMLValue(stmtBlock, 'ACCTTYPE') || 'CHECKING',
      balance: parseFloat(extractSGMLValue(stmtBlock, 'BALAMT') || '0'),
      balanceDate: formatDate(extractSGMLValue(stmtBlock, 'DTASOF') || ''),
      currency: extractSGMLValue(stmtBlock, 'CURDEF') || 'USD',
      transactions: []
    };

    // Parse individual transactions
    const transactionMatches = stmtBlock.matchAll(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g);
    for (const match of transactionMatches) {
      const txnBlock = match[0];
      const transaction: Transaction = {
        id: extractSGMLValue(txnBlock, 'FITID') || `txn-${Date.now()}`,
        date: formatDate(extractSGMLValue(txnBlock, 'DTPOSTED') || ''),
        amount: parseFloat(extractSGMLValue(txnBlock, 'TRNAMT') || '0'),
        type: extractSGMLValue(txnBlock, 'TRNTYPE') || 'OTHER',
        description: extractSGMLValue(txnBlock, 'NAME') || '',
        memo: extractSGMLValue(txnBlock, 'MEMO'),
        checkNum: extractSGMLValue(txnBlock, 'CHECKNUM'),
        refNum: extractSGMLValue(txnBlock, 'REFNUM')
      };
      account.transactions.push(transaction);
    }

    accounts.push(account);
  }

  return {
    bankName,
    accounts,
    dtStart: extractSGMLValue(sgmlContent, 'DTSTART') || '',
    dtEnd: extractSGMLValue(sgmlContent, 'DTEND') || '',
    rawText: sgmlContent
  };
}

/**
 * Extracts value from XML-style tags
 */
function extractValue(content: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}>([^<]*)<\/${tag}>`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extracts value from SGML-style tags (no closing tags)
 */
function extractSGMLValue(content: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}>([^<\n]*)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Converts OFX date format (YYYYMMDD) to ISO 8601
 */
function formatDate(ofxDate: string): string {
  if (!ofxDate || ofxDate.length < 8) return '';
  
  const year = ofxDate.substring(0, 4);
  const month = ofxDate.substring(4, 6);
  const day = ofxDate.substring(6, 8);
  
  return `${year}-${month}-${day}`;
}

/**
 * Validates parsed OFX data
 */
export function validateOFXData(data: OFXParsedData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.accounts || data.accounts.length === 0) {
    errors.push('No accounts found in OFX data');
  }

  for (const account of data.accounts) {
    if (!account.accountId) {
      errors.push(`Account missing accountId`);
    }
    if (!account.bankId) {
      errors.push(`Account ${account.accountId} missing bankId`);
    }
    if (account.transactions.length === 0) {
      errors.push(`Account ${account.accountId} has no transactions`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}