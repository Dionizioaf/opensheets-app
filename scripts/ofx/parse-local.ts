#!/usr/bin/env -S node --enable-source-maps
import fs from "node:fs";
import path from "node:path";
import { parseOfxFile } from "@/lib/ofx-parser/parser";
import { parse as parseOfxRaw } from "ofx-js";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: tsx scripts/ofx/parse-local.ts <path-to-ofx-file>");
    process.exit(1);
  }

  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }

  const content = fs.readFileSync(abs, "utf8");
  const startIdx = content.indexOf("<OFX>");
  const trimmed = startIdx >= 0 ? content.slice(startIdx) : content;

  try {
    // Debug: inspect raw structure
    const raw = parseOfxRaw(content);
    console.log("raw.OFX keys:", raw?.OFX ? Object.keys(raw.OFX) : Object.keys(raw));
    console.log("has BANKMSGSRSV1:", Boolean(raw?.OFX?.BANKMSGSRSV1));
    console.log("has STMTTRNRS:", Boolean(raw?.OFX?.BANKMSGSRSV1?.STMTTRNRS));
    console.log("has STMTRS:", Boolean(raw?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS));
    console.log("has BANKTRANLIST:", Boolean(raw?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST));
    const st = raw?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.STMTTRN;
    console.log("STMTTRN type:", Array.isArray(st) ? "array" : typeof st, "length:", Array.isArray(st) ? st.length : 0);

    // Try trimmed parse as well for debugging
    const rawTrim = parseOfxRaw(trimmed);
    console.log("(trimmed) has BANKMSGSRSV1:", Boolean(rawTrim?.OFX?.BANKMSGSRSV1));
    const stTrim = rawTrim?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.STMTTRN;
    console.log("(trimmed) STMTTRN type:", Array.isArray(stTrim) ? "array" : typeof stTrim, "length:", Array.isArray(stTrim) ? stTrim.length : 0);

    const result = await parseOfxFile(content, path.basename(abs));
    console.log("success:", true);
    console.log("account:", result.account);
    console.log("startDate:", result.startDate);
    console.log("endDate:", result.endDate);
    console.log("transactions count:", result.transactions.length);
    console.log("first 3:", result.transactions.slice(0, 3));
  } catch (err) {
    console.error("success:", false);
    if (err instanceof Error) {
      console.error("error:", err.message);
    } else {
      console.error("error:", err);
    }
    process.exit(2);
  }
}

main();
