// import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
// import { NextResponse } from "next/server";
// import { allowedOrigins } from "./lib/corsConfig";

// const isPublicRoute = createRouteMatcher([
//   "/",
//   "/sign-up(.*)",
//   "/subscribe(.*)",
//   "/api/webhook(.*)",
//   "/api/check-subscription(.*)",
//   "/api/game-session(.*)",
//   "/api/game-data(.*)",
//   "/api/games(.*)",
//   "/datalab(.*)",
//   "/api/datalab(.*)"
// ])

// const isSignUpRoute = createRouteMatcher(["/sign-up(.*)"])

// const isMealPlanRoute = createRouteMatcher(["/mealplan(.*)"])

// // Apply CORS headers to all responses
// function applyCorsHeaders(response: NextResponse, request: Request) {
//   const origin = request.headers.get('origin');
  
//   // For game API endpoints, allow specific origins
//   if (request.url.includes('/api/game-')) {
    
//     // If the origin is in our allowed list, set it specifically
//     if (origin && allowedOrigins.includes(origin)) {
//       response.headers.set('Access-Control-Allow-Origin', origin);
//     } else {
//       // For other origins, use a wildcard (but credentials won't work)
//       response.headers.set('Access-Control-Allow-Origin', '*');
//     }
//   } else {
//     // For non-game API endpoints, use a wildcard
//     response.headers.set('Access-Control-Allow-Origin', '*');
//   }
  
//   response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
//   response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
//   // Only set Allow-Credentials for specific origins
//   if (origin && origin !== '*') {
//     response.headers.set('Access-Control-Allow-Credentials', 'true');
//   }
  
//   return response;
// }

// export default clerkMiddleware(async (auth, req) => {
//   const userAuth = await auth()
//   const { userId } = userAuth
//   const { pathname, origin } = req.nextUrl

//   // Handle OPTIONS requests for CORS preflight
//   if (req.method === 'OPTIONS') {
//     const response = NextResponse.json({}, { status: 200 });
//     return applyCorsHeaders(response, req);
//   }

//   // Apply CORS to game API endpoints
//   if (pathname.startsWith('/api/game-')) {
//     const response = NextResponse.next();
//     return applyCorsHeaders(response, req);
//   }

//   if (pathname === "/api/check-subscription") {
//     return NextResponse.next()
//   }

//   if (!isPublicRoute(req) && !userId) {
//     return NextResponse.redirect(new URL("/sign-up", origin))
//   }

//   if (isSignUpRoute(req) && userId) {
//     return NextResponse.redirect(new URL("/mealplan", origin))
//   }

//   if (isMealPlanRoute(req) && userId) {
//     try {
//       const response = await fetch(`${origin}/api/check-subscription?userId=${userId}`)
//       const data = await response.json()
//       if (!data.subscriptionActive) {
//         return NextResponse.redirect(new URL("/subscribe", origin))
//       }
//     } catch(error: any) {
//       return NextResponse.redirect(new URL("/subscribe", origin))
//     }
//   }

//   return NextResponse.next()
// });

// export const config = {
//   matcher: [
//     // Skip Next.js internals and all static files, unless found in search params
//     '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
//     // Always run for API routes
//     '/(api|trpc)(.*)',
//   ],
// };

// // middleware.ts
// import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
// import { NextResponse } from "next/server";
// import { allowedOrigins } from "./lib/corsConfig";

// // Import our new auth utility
// import { isAdmin } from "./lib/auth";

// const isPublicRoute = createRouteMatcher([
//   "/",
//   "/sign-up(.*)",
//   "/subscribe(.*)",
//   "/api/webhook(.*)",
//   "/api/check-subscription(.*)",
//   "/api/game-session(.*)",
//   "/api/game-data(.*)",
//   "/api/games(.*)",
//   "/datalab(.*)",
//   "/api/datalab(.*)"
// ])

// const isSignUpRoute = createRouteMatcher(["/sign-up(.*)"])

// const isMealPlanRoute = createRouteMatcher(["/mealplan(.*)"])

// // Add admin routes matcher
// const isAdminRoute = createRouteMatcher([
//   "/admin(.*)",
//   "/rp/admin(.*)",
//   "/api/admin(.*)",
//   "/api/rp/execute(.*)" // Assuming this is an admin-only endpoint
// ])

// // Apply CORS headers to all responses
// function applyCorsHeaders(response: NextResponse, request: Request) {
//   const origin = request.headers.get('origin');
  
//   // For game API endpoints, allow specific origins
//   if (request.url.includes('/api/game-')) {
    
//     // If the origin is in our allowed list, set it specifically
//     if (origin && allowedOrigins.includes(origin)) {
//       response.headers.set('Access-Control-Allow-Origin', origin);
//     } else {
//       // For other origins, use a wildcard (but credentials won't work)
//       response.headers.set('Access-Control-Allow-Origin', '*');
//     }
//   } else {
//     // For non-game API endpoints, use a wildcard
//     response.headers.set('Access-Control-Allow-Origin', '*');
//   }
  
//   response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
//   response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
//   // Only set Allow-Credentials for specific origins
//   if (origin && origin !== '*') {
//     response.headers.set('Access-Control-Allow-Credentials', 'true');
//   }
  
//   return response;
// }

// export default clerkMiddleware(async (auth, req) => {
//   const userAuth = await auth()
//   const { userId } = userAuth
//   const { pathname, origin } = req.nextUrl

//   // Get current user data for admin check
//   const user = userAuth.user;
//   const username = user?.username;

//   // Admin route protection - must come before the general auth check
//   if (isAdminRoute(req)) {
//     // Check if user is admin
//     if (!userId || !isAdmin(userId, username)) {
//       // For API routes, return 403 Forbidden status
//       if (pathname.startsWith('/api/')) {
//         return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
//       }
//       // For UI routes, redirect to homepage
//       return NextResponse.redirect(new URL("/", origin));
//     }
//   }

//   // Handle OPTIONS requests for CORS preflight
//   if (req.method === 'OPTIONS') {
//     const response = NextResponse.json({}, { status: 200 });
//     return applyCorsHeaders(response, req);
//   }

//   // Apply CORS to game API endpoints
//   if (pathname.startsWith('/api/game-')) {
//     const response = NextResponse.next();
//     return applyCorsHeaders(response, req);
//   }

//   if (pathname === "/api/check-subscription") {
//     return NextResponse.next()
//   }

//   if (!isPublicRoute(req) && !userId) {
//     return NextResponse.redirect(new URL("/sign-up", origin))
//   }

//   if (isSignUpRoute(req) && userId) {
//     return NextResponse.redirect(new URL("/mealplan", origin))
//   }

//   if (isMealPlanRoute(req) && userId) {
//     try {
//       const response = await fetch(`${origin}/api/check-subscription?userId=${userId}`)
//       const data = await response.json()
//       if (!data.subscriptionActive) {
//         return NextResponse.redirect(new URL("/subscribe", origin))
//       }
//     } catch(error: any) {
//       return NextResponse.redirect(new URL("/subscribe", origin))
//     }
//   }

//   return NextResponse.next()
// });

// export const config = {
//   matcher: [
//     // Skip Next.js internals and all static files, unless found in search params
//     '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
//     // Always run for API routes
//     '/(api|trpc)(.*)',
//   ],
// };

// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { allowedOrigins } from "./lib/corsConfig";

// Import our new auth utility
import { isAdmin, isAdminUser } from "./lib/auth"; // Import isAdminUser also

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-up(.*)",
  "/subscribe(.*)",
  "/create-profile(.*)",
  "/api/webhook(.*)",
  "/api/check-subscription(.*)",
  "/api/game-session(.*)",
  "/api/game-data(.*)",
  "/api/games(.*)",
  "/datalab(.*)",
  "/api/datalab(.*)"
])

const isSignUpRoute = createRouteMatcher(["/sign-up(.*)"])

const isMealPlanRoute = createRouteMatcher(["/mealplan(.*)"])

// Add admin routes matcher
const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
  "/rp/admin(.*)",
  "/api/admin(.*)",
  "/api/rp/execute(.*)" // Assuming this is an admin-only endpoint
])

// Apply CORS headers to all responses
function applyCorsHeaders(response: NextResponse, request: Request) {
  const origin = request.headers.get('origin');
  
  // For game API endpoints, allow specific origins
  if (request.url.includes('/api/game-')) {
    
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

  // Admin route protection - must come before the general auth check
  // In middleware, we only have access to userId, not username
  // So we'll just check the userId for admin access
  if (isAdminRoute(req)) {
    // Check if user is admin using only userId
    if (!userId || !isAdminUser(userId)) {
      // For API routes, return 403 Forbidden status
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
      }
      // For UI routes, redirect to homepage
      return NextResponse.redirect(new URL("/", origin));
    }
  }

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

  if (pathname === "/create-profile") {
    return NextResponse.next(); // Skip other middleware checks for this path
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