import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

// Helper function to get monthly limit based on tier
function getMonthlyLimitForTier(tier?: string | null): number {
  switch (tier) {
    case "premium":
      return 500;
    case "premium_plus":
      return 1500;
    default:
      return 100; // Basic tier gets 100 requests
  }
}

// Get current usage
export async function GET(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create usage record
    let usage = await prisma.apiUsage.findUnique({
      where: { userId: clerkUser.id }
    });

    // If no usage record exists, get subscription info to determine limit
    if (!usage) {
      const profile = await prisma.profile.findUnique({
        where: { userId: clerkUser.id },
        select: { subscriptionTier: true }
      });

      // Set appropriate limit based on tier
      const monthlyLimit = getMonthlyLimitForTier(profile?.subscriptionTier);
      
      usage = await prisma.apiUsage.create({
        data: {
          userId: clerkUser.id,
          usageCount: 0,
          monthlyLimit,
          lastResetDate: new Date()
        }
      });
    }

    // Check if we need to reset monthly usage
    const now = new Date();
    const lastReset = new Date(usage.lastResetDate);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      // Reset monthly usage
      usage = await prisma.apiUsage.update({
        where: { userId: clerkUser.id },
        data: {
          usageCount: 0,
          lastResetDate: now
        }
      });
    }

    return NextResponse.json({
      usageCount: usage.usageCount,
      monthlyLimit: usage.monthlyLimit,
      remaining: Math.max(0, usage.monthlyLimit - usage.usageCount)
    });
  } catch (error: any) {
    console.error("Error getting usage data:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// Increment usage
export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    
    // Get or create usage record
    let usage = await prisma.apiUsage.findUnique({
      where: { userId: clerkUser.id }
    });

    if (!usage) {
      const profile = await prisma.profile.findUnique({
        where: { userId: clerkUser.id },
        select: { subscriptionTier: true }
      });

      const monthlyLimit = getMonthlyLimitForTier(profile?.subscriptionTier);
      
      usage = await prisma.apiUsage.create({
        data: {
          userId: clerkUser.id,
          usageCount: 1,
          monthlyLimit,
          lastResetDate: now
        }
      });
    } else {
      // Check if we need to reset monthly usage
      const lastReset = new Date(usage.lastResetDate);
      if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        // Reset monthly usage
        usage = await prisma.apiUsage.update({
          where: { userId: clerkUser.id },
          data: {
            usageCount: 1,
            lastResetDate: now
          }
        });
      } else {
        // Increment usage count
        usage = await prisma.apiUsage.update({
          where: { userId: clerkUser.id },
          data: {
            usageCount: { increment: 1 }
          }
        });
      }
    }

    return NextResponse.json({
      usageCount: usage.usageCount,
      monthlyLimit: usage.monthlyLimit,
      remaining: Math.max(0, usage.monthlyLimit - usage.usageCount)
    });
  } catch (error: any) {
    console.error("Error incrementing usage:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}