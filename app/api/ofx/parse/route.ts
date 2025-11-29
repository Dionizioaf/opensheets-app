/**
 * API Route: POST /api/ofx/parse
 * 
 * Parse and validate OFX file content
 * Returns parsed transactions or user-friendly error messages
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/server";
import { parseOFXFileAction } from "@/lib/ofx-parser/actions";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Não autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fileContent, accountId } = body;

    // Debug logging
    console.log("[OFX API] fileContent type:", typeof fileContent);
    if (typeof fileContent === "string") {
      console.log("[OFX API] fileContent length:", fileContent.length);
      console.log("[OFX API] fileContent preview:", fileContent.slice(0, 100));
    } else {
      console.log("[OFX API] fileContent value:", fileContent);
    }

    // Validate input
    if (!fileContent || typeof fileContent !== "string") {
      return NextResponse.json(
        { success: false, error: "Conteúdo do arquivo OFX ausente ou inválido" },
        { status: 400 }
      );
    }

    if (!accountId || typeof accountId !== "string") {
      return NextResponse.json(
        { success: false, error: "ID da conta ausente ou inválido" },
        { status: 400 }
      );
    }

    // Call the server action to parse and validate OFX file
    const result = await parseOFXFileAction(fileContent, accountId);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || "Arquivo OFX inválido ou corrompido" 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transactions: result.transactions,
      warnings: result.warnings ?? [],
    });
  } catch (error) {
    console.error("Error in OFX parse API:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Erro ao processar arquivo OFX. Verifique se o arquivo está correto e tente novamente." 
      },
      { status: 500 }
    );
  }
}
