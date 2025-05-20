
export interface Plan {
    planType: "premium" | "premium_plus";
    name: string;
    amount: number;
    currency: string;
    interval: string;   // e.g. "month"
    description: string;
    isPopular?: boolean;
    features: string[]
  }

export const availablePlans: Plan[] = [
    {
        planType: "premium",
        name: "Premium",
        amount: 20.00,
        currency: "USD",
        interval: "month",
        description: "Access to stronger AI models with standard monthly usage limits.",
        features: [
            "Access to advanced AI models",
            "500 monthly AI requests",
            "Full access to all platform tools",
            "Cancel Anytime"
        ]
    },
    {
        planType: "premium_plus",
        name: "Premium+",
        amount: 40.00,
        currency: "USD",
        interval: "month",
        isPopular: true,
        description: "Access to stronger AI models with premium monthly usage limits.",
        features: [
            "Access to advanced AI models",
            "1,500 monthly AI requests",
            "Full access to all platform tools",
            "Priority support",
            "Cancel Anytime"
        ]
    }
]

const priceIDMap: Record<string, string> = {
    premium: process.env.STRIPE_PRICE_PREMIUM!,
    premium_plus: process.env.STRIPE_PRICE_PREMIUM_PLUS!
}

export const getPriceIDFromType = (planType: string) => priceIDMap[planType];