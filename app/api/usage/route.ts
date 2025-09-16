import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { getApiLimitForTier } from "@/lib/plans";

// Get current usage
export async function GET(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: clerkUser.id },
      select: { subscriptionTier: true }
    });
    const correctMonthlyLimit = getApiLimitForTier(profile?.subscriptionTier);

    let usage = await prisma.apiUsage.findUnique({
      where: { userId: clerkUser.id }
    });

    if (!usage) {
      // If no usage record exists, create one with the correct limit.
      usage = await prisma.apiUsage.create({
        data: {
          userId: clerkUser.id,
          usageCount: 0,
          monthlyLimit: correctMonthlyLimit,
          lastResetDate: new Date()
        }
      });
    } else {
      const now = new Date();
      const lastReset = new Date(usage.lastResetDate);
      const needsMonthlyReset = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
      const limitIsIncorrect = usage.monthlyLimit !== correctMonthlyLimit;

      // If the month has changed OR the stored limit is incorrect, update the record.
      if (needsMonthlyReset || limitIsIncorrect) {
        usage = await prisma.apiUsage.update({
          where: { userId: clerkUser.id },
          data: {
            usageCount: needsMonthlyReset ? 0 : usage.usageCount,
            monthlyLimit: correctMonthlyLimit,
            lastResetDate: needsMonthlyReset ? now : usage.lastResetDate,
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

      const monthlyLimit = getApiLimitForTier(profile?.subscriptionTier);
      
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
        const profile = await prisma.profile.findUnique({
          where: { userId: clerkUser.id },
          select: { subscriptionTier: true }
        });
        const monthlyLimit = getApiLimitForTier(profile?.subscriptionTier);
        
        usage = await prisma.apiUsage.update({
          where: { userId: clerkUser.id },
          data: {
            usageCount: 1,
            monthlyLimit: monthlyLimit,
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