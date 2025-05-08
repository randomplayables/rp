import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-up(.*)",
  "/subscribe(.*)",
  "/api/webhook(.*)",
  "/api/check-subscription(.*)",
  "/api/game-session(.*)",
  "/api/game-data(.*)",
  "/api/games(.*)",
])

const isSignUpRoute = createRouteMatcher(["/sign-up(.*)"])

const isMealPlanRoute = createRouteMatcher(["/mealplan(.*)"])

// Apply CORS headers to all responses
function applyCorsHeaders(response: NextResponse, request: Request) {
  const origin = request.headers.get('origin');
  
  // For game API endpoints, allow specific origins
  if (request.url.includes('/api/game-')) {
    // List of allowed origins for game API endpoints
    const allowedOrigins = [
      'http://localhost:5173',         // Vite dev server
      'http://localhost:3000',         // Next.js dev server
      'http://172.31.12.157:5173',     // EC2 Vite dev server
      'http://172.31.12.157:3000',     // EC2 Next.js dev server
      'http://54.176.104.229:5173',    // EC2 public IP Vite dev server
      'http://54.176.104.229:3000',    // EC2 public IP Next.js dev server
      'https://randomplayables.com',
      'https://gothamloops.randomplayables.com'
    ];
    
    // If the origin is in our allowed list, set it specifically
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    } else {
      // For other origins, use a wildcard (but credentials won't work)
      response.headers.set('Access-Control-Allow-Origin', '*');
    }
  } else {
    // For non-game API endpoints, use a wildcard
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Only set Allow-Credentials for specific origins
  if (origin && origin !== '*') {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  return response;
}

export default clerkMiddleware(async (auth, req) => {
  const userAuth = await auth()
  const { userId } = userAuth
  const { pathname, origin } = req.nextUrl

  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    const response = NextResponse.json({}, { status: 200 });
    return applyCorsHeaders(response, req);
  }

  // Apply CORS to game API endpoints
  if (pathname.startsWith('/api/game-')) {
    const response = NextResponse.next();
    return applyCorsHeaders(response, req);
  }

  if (pathname === "/api/check-subscription") {
    return NextResponse.next()
  }

  if (!isPublicRoute(req) && !userId) {
    return NextResponse.redirect(new URL("/sign-up", origin))
  }

  if (isSignUpRoute(req) && userId) {
    return NextResponse.redirect(new URL("/mealplan", origin))
  }

  if (isMealPlanRoute(req) && userId) {
    try {
      const response = await fetch(`${origin}/api/check-subscription?userId=${userId}`)
      const data = await response.json()
      if (!data.subscriptionActive) {
        return NextResponse.redirect(new URL("/subscribe", origin))
      }
    } catch(error: any) {
      return NextResponse.redirect(new URL("/subscribe", origin))
    }
  }

  return NextResponse.next()
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};