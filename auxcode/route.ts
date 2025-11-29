// app/api/parse-ofx/route.ts

import { parseOFX, validateOFXData } from '@/lib/ofxParser';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.ofx') && !file.type.includes('ofx')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .ofx files are supported' },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();

    // Parse OFX
    const parsedData = await parseOFX(fileContent);

    // Validate
    const validation = validateOFXData(parsedData);
    if (!validation.valid) {
      return NextResponse.json(
        {
          warning: 'OFX parsed but with validation issues',
          errors: validation.errors,
          data: parsedData
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: parsedData
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('OFX parsing error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to parse OFX file'
      },
      { status: 500 }
    );
  }
}