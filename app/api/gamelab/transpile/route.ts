import { NextRequest, NextResponse } from 'next/server';
import { transform } from '@swc/core';
import { currentUser } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code: tsxCode } = await request.json();

    if (!tsxCode || typeof tsxCode !== 'string') {
      return NextResponse.json({ error: 'TSX code is required' }, { status: 400 });
    }

    // Transpile TSX to JavaScript using SWC
    const { code: compiledCode } = await transform(tsxCode, {
      // Treat the input as a script, not a module
      isModule: false,
      jsc: {
        parser: {
          syntax: "typescript",
          tsx: true,
        },
        transform: {
          react: {
            // Use the classic runtime to transform JSX to React.createElement,
            // which works with the React CDN script in the sandbox.
            runtime: "classic",
          },
        },
        // Target a reasonably modern version of JavaScript
        target: 'es2020',
      },
      // Keep source maps off for the final output
      sourceMaps: false,
    });

    return NextResponse.json({ compiledCode });

  } catch (error: any) {
    console.error('[SWC Transpile Error]', error);
    return NextResponse.json(
      {
        error: 'Failed to transpile code.',
        details: error.message
      },
      { status: 500 }
    );
  }
}