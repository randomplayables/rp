import Cors from 'cors';
import { NextRequest, NextResponse } from 'next/server';

// Initialize the CORS middleware
const cors = Cors({
  methods: ['GET', 'POST', 'OPTIONS'],
  origin: ['http://localhost:5173', 'https://gothamloops.randomplayables.com'],
  credentials: true,
});

// Helper method to wait for a middleware to execute before continuing
// And to handle any errors that might occur during execution
function runMiddleware(req: NextRequest, res: NextResponse) {
  return new Promise((resolve, reject) => {
    cors(req as any, res as any, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export { runMiddleware };