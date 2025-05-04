// lib/cors.ts
import Cors from 'cors';
import { NextRequest, NextResponse } from 'next/server';

// Initialize the CORS middleware with more permissive settings
const cors = Cors({
  methods: ['GET', 'POST', 'OPTIONS'],
  origin: '*', // Allow all origins in development
  credentials: true,
});

// Helper method to wait for a middleware to execute before continuing
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