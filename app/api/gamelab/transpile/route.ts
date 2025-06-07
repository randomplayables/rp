// import { NextRequest, NextResponse } from 'next/server';
// import { transform } from '@swc/core';
// import { currentUser } from '@clerk/nextjs/server';

// export async function POST(request: NextRequest) {
//   try {
//     const clerkUser = await currentUser();
//     if (!clerkUser) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }

//     const { code: tsxCode } = await request.json();

//     if (!tsxCode || typeof tsxCode !== 'string') {
//       return NextResponse.json({ error: 'TSX code is required' }, { status: 400 });
//     }

//     // Transpile TSX to JavaScript using SWC
//     const { code: compiledCode } = await transform(tsxCode, {
//       // Treat the input as a script, not a module
//       isModule: false,
//       jsc: {
//         parser: {
//           syntax: "typescript",
//           tsx: true,
//         },
//         transform: {
//           react: {
//             // Use the classic runtime to transform JSX to React.createElement,
//             // which works with the React CDN script in the sandbox.
//             runtime: "classic",
//           },
//         },
//         // Target a reasonably modern version of JavaScript
//         target: 'es2020',
//       },
//       // Keep source maps off for the final output
//       sourceMaps: false,
//     });

//     return NextResponse.json({ compiledCode });

//   } catch (error: any) {
//     console.error('[SWC Transpile Error]', error);
//     return NextResponse.json(
//       {
//         error: 'Failed to transpile code.',
//         details: error.message
//       },
//       { status: 500 }
//     );
//   }
// }

import { NextRequest, NextResponse } from 'next/server';
import { transform } from '@swc/core';
import { currentUser } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/mongodb';
import UserSketchModel from '@/models/UserSketch';

// Define an interface for the plain object returned by .lean()
interface ISketchLean {
    userId: string;
    isPublic: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { code: tsxCode, sketchId } = await request.json();

    if (!tsxCode || typeof tsxCode !== 'string') {
      return NextResponse.json({ error: 'TSX code is required' }, { status: 400 });
    }

    // If a sketchId is provided, perform an access check
    if (sketchId) {
        await connectToDatabase();
        // Explicitly type the result of the lean query
        const sketch = await UserSketchModel.findById(sketchId).lean<ISketchLean>();

        if (!sketch) {
            return NextResponse.json({ error: 'Sketch not found' }, { status: 404 });
        }

        // If the sketch is NOT public, we must verify ownership
        if (!sketch.isPublic) {
            const user = await currentUser();
            if (!user || user.id !== sketch.userId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }
        // If the sketch is public, or if the user is the owner, allow transpilation
    } else {
        // For generic transpilation without a sketchId, require authentication
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }


    // Transpile TSX to JavaScript using SWC
    const { code: compiledCode } = await transform(tsxCode, {
      isModule: false,
      jsc: {
        parser: {
          syntax: "typescript",
          tsx: true,
        },
        transform: {
          react: {
            runtime: "classic",
          },
        },
        target: 'es2020',
      },
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