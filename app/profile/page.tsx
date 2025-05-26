"use client"

import { Spinner } from "@/components/spinner"
import { useUser } from "@clerk/nextjs"
import toast, { Toaster } from "react-hot-toast"
import Image from "next/image"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { availablePlans } from "@/lib/plans" //
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation";
import UsageDisplay from './UsageDisplay'; //

// Define types for the data we'll fetch
interface ProfileDetails {
    subscriptionTier: string | null;
    stripeSubscriptionId: string | null;
    subscriptionActive: boolean;
    stripeConnectAccountId: string | null;
    stripePayoutsEnabled: boolean;
}

interface Payout {
    _id: string;
    amount: number;
    timestamp: string;
    status: string;
    stripeTransferId?: string;
}

// Function to fetch full profile details (including Stripe Connect status)
async function fetchProfileDetails(): Promise<{ profile: ProfileDetails } | null> {
    const response = await fetch("/api/profile/details");
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch profile details");
    }
    return response.json();
}

// Function to fetch payout history
async function fetchPayoutHistory(): Promise<{ payouts: Payout[] }> {
    const response = await fetch("/api/profile/payouts"); // You created this endpoint
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch payout history");
    }
    return response.json();
}

async function updatePlan(newPlan: string) {
    const response = await fetch("/api/profile/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPlan }),
    })
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error updating plan.");
    }
    return response.json()
}

async function unsubscribe() {
    const response = await fetch("/api/profile/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    })
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error unsubscribing.");
    }
    return response.json()
}

export default function Profile() {
    const [selectedPlan, setSelectedPlan] = useState<string>("") //
    const { isLoaded, isSignedIn, user } = useUser() //
    const queryClient = useQueryClient() //
    const router = useRouter() //

    // Query for profile details (includes subscription and Stripe Connect status)
    const { data: profileData, isLoading: isLoadingProfile, isError: isProfileError, error: profileError, refetch: refetchProfileDetails } = useQuery({
        queryKey: ["profileDetails"],
        queryFn: fetchProfileDetails,
        enabled: isLoaded && isSignedIn,
        staleTime: 5 * 60 * 1000,
    });

    // Query for payout history
    const { data: payoutHistoryData, isLoading: isLoadingPayouts, isError: isPayoutHistoryError, error: payoutHistoryError } = useQuery({
        queryKey: ["payoutHistory"],
        queryFn: fetchPayoutHistory,
        enabled: isLoaded && isSignedIn && !!profileData?.profile.stripeConnectAccountId, // Only fetch if Stripe is connected
        staleTime: 5 * 60 * 1000,
    });

    const {
        mutate: updatePlanMutation,
        isPending: isUpdatePlanPending,
    } = useMutation({ //
        mutationFn: updatePlan, //
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ["profileDetails"]}) //
            toast.success("Subscription plan updated successfully!") //
            refetchProfileDetails(); // Refetch profile details which includes subscription
        },
        onError: (e: Error) => {
            toast.error(e.message || "Error updating plan.") //
        }
    })

    const {
        mutate: unsubscribeMutation,
        isPending: isUnsubscribePending,
    } = useMutation({ //
        mutationFn: unsubscribe, //
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ["profileDetails"]}) //
            router.push("/subscribe") //
            toast.success("Unsubscribed successfully.")
        },
        onError: (e: Error) => {
            toast.error(e.message || "Error unsubscribing.") //
        }
    })

    const currentPlanDetails = availablePlans.find(
        plan => plan.planType === profileData?.profile?.subscriptionTier
      )

    function handleUpdatePlan() {
        if (selectedPlan) {
            updatePlanMutation(selectedPlan) //
        }
        setSelectedPlan("") //
    }

    function handleUnsubscribe() {
        if (confirm("Are you sure you want to unsubscribe? You will lose access to premium features.")) { //
            unsubscribeMutation() //
        }
    }

    const handleSetupPayouts = async () => {
        toast.loading("Redirecting to Stripe for setup...");
        try {
            const response = await fetch('/api/stripe/connect-onboard', { method: 'POST' }); ///components/ProfileInstrumentCard.tsx`, `app/api/stripe/connect-onboard/route.ts`]
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url; //
            } else {
                toast.dismiss();
                toast.error(data.error || 'Failed to start Stripe onboarding.');
            }
        } catch (err) {
            toast.dismiss();
            toast.error('Error setting up payouts.');
            console.error("Stripe onboarding error:", err);
        }
    };

    // Effect to check for Stripe setup completion from redirect
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('stripe_setup_complete') === 'true') {
            toast.success('Stripe account setup complete! Your payout information is being verified.');
            refetchProfileDetails(); // Refresh profile to get latest Stripe status
            // Clean up URL
            router.replace('/profile', { scroll: false });
        }
    }, [router, refetchProfileDetails]);


    if (!isLoaded || isLoadingProfile){ //
        return (
            <div className="flex items-center justify-center min-h-screen bg-emerald-100">
                <Spinner /><span className="ml-2"> Loading...</span>
            </div>
        )
    }

    if (!isSignedIn){ //
        return (
            <div className="flex items-center justify-center min-h-screen bg-emerald-100">
                <p> Please sign in to view your profile.</p>
            </div>
        )
    }
    
    const profile = profileData?.profile;

    return (
        <div className="min-h-screen flex items-center justify-center bg-emerald-100 p-4">
          <Toaster position="top-center" />
      
          <div className="w-full max-w-5xl bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="flex flex-col md:flex-row">
      
              {/* Left: User Info */}
              <div className="w-full md:w-1/3 p-6 bg-emerald-500 text-white flex flex-col items-center">
                {user.imageUrl && (
                  <Image
                    src={user.imageUrl}
                    alt="User Avatar"
                    width={100}
                    height={100}
                    className="rounded-full mb-4"
                  /> //
                )}
                <h1 className="text-2xl font-bold mb-2">
                  {user.firstName} {user.lastName}
                </h1> {/* */}
                <p className="mb-1 text-lg">
                  @{user.username || "No username set"}
                </p> {/* */}
                <p className="mb-4">
                  {user.primaryEmailAddress?.emailAddress}
                </p> {/* */}
                {user.username && (
                  <a
                    href={`/profile/${user.username}`}
                    className="px-4 py-2 bg-white text-emerald-600 rounded-md font-medium hover:bg-gray-100 transition"
                  >
                    View Public Profile
                  </a> //
                )}
              </div>
      
              {/* Right: Details */}
              <div className="w-full md:w-2/3 p-6 bg-gray-50">
                <h2 className="text-2xl font-bold mb-6 text-emerald-700">
                  Account Management
                </h2>
      
                {isProfileError ? (
                  <p className="text-red-500">Error loading profile: {(profileError as Error)?.message}</p>
                ) : profile ? (
                  <div className="space-y-6">
                    {/* Subscription Management */}
                    <div className="bg-white shadow-md rounded-lg p-4 border border-emerald-200">
                      <h3 className="text-xl font-semibold mb-2 text-emerald-600">
                        Current Plan
                      </h3>
                      {currentPlanDetails ? (
                        <>
                          <p><strong>Plan:</strong> {currentPlanDetails.name}</p> {/* */}
                          <p><strong>Amount:</strong> ${currentPlanDetails.amount}/{currentPlanDetails.interval}</p> {/* */}
                          <p><strong>Status:</strong> {profile.subscriptionActive ? "ACTIVE" : "INACTIVE"}</p>
                        </>
                      ) : (
                        <p>You are not subscribed to any plan.</p>
                      )}
                    </div>
      
                    {profile.subscriptionActive && currentPlanDetails && (
                      <div className="bg-white shadow-md rounded-lg p-4 border border-emerald-200">
                        <h3 className="text-xl font-semibold mb-2 text-emerald-600">
                          Change Subscription Plan
                        </h3>
                        <>
                          <select
                            id="plan-select"
                            value={selectedPlan}
                            disabled={isUpdatePlanPending}
                            className="w-full px-3 py-2 border border-emerald-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            onChange={e => setSelectedPlan(e.target.value)}
                          >
                            <option value="" disabled>
                              Select a New Plan
                            </option>
                            {availablePlans.map(plan => (
                              <option key={plan.planType} value={plan.planType}>
                                {plan.name} — ${plan.amount}/{plan.interval}
                              </option> //
                            ))}
                          </select>
      
                          <button
                            className="mt-3 w-full bg-emerald-500 text-white py-2 rounded-lg disabled:opacity-50"
                            onClick={handleUpdatePlan}
                            disabled={
                              isUpdatePlanPending ||
                              !selectedPlan ||
                              selectedPlan === profile.subscriptionTier
                            }
                          >
                            {isUpdatePlanPending ? "Updating…" : "Save Change"}
                          </button> {/* */}
                        </>
                      </div>
                    )}
                     {profile.subscriptionActive && (
                        <div className="bg-white shadow-md rounded-lg p-4 border border-red-200">
                          <h3 className="text-xl font-semibold mb-2 text-red-600">
                            Cancel Subscription
                          </h3>
                          <button
                            onClick={handleUnsubscribe}
                            disabled={isUnsubscribePending}
                            className={`w-full py-2 px-4 rounded-md text-white ${
                              isUnsubscribePending ? "bg-red-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"
                            }`}
                          >
                            {isUnsubscribePending ? "Processing…" : "Unsubscribe"}
                          </button> {/* */}
                        </div>
                     )}
                     {!profile.subscriptionActive && (
                        <div className="bg-white shadow-md rounded-lg p-4 border border-emerald-200 text-center">
                            <p className="mb-2">You currently do not have an active subscription.</p>
                            <button
                                onClick={() => router.push('/subscribe')}
                                className="px-6 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors"
                            >
                                View Subscription Plans
                            </button>
                        </div>
                     )}

                    {/* Payout Settings */}
                    <div className="bg-white shadow-md rounded-lg p-4 border border-emerald-200">
                        <h3 className="text-xl font-semibold mb-2 text-emerald-600">
                            Payout Settings
                        </h3>
                        {profile.stripeConnectAccountId ? (
                            profile.stripePayoutsEnabled ? (
                                <div className="text-green-700">
                                    <p>✅ Your payout account is active and verified by Stripe.</p>
                                    <p className="text-sm mt-1">Payouts will be sent to the bank account you configured with Stripe.</p>
                                     {/* Add a link to manage Stripe Express account if available */}
                                </div>
                            ) : (
                                <div className="text-orange-600">
                                    <p>⚙️ Your Stripe account setup is in progress or requires more information.</p>
                                    <p className="text-sm mt-1">You might need to complete identity verification or add bank details on Stripe.</p>
                                    <button
                                        onClick={handleSetupPayouts}
                                        className="mt-3 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                                    >
                                        Continue Stripe Setup
                                    </button>
                                </div>
                            )
                        ) : (
                            <div>
                                <p className="mb-3">Connect your Stripe account to receive payouts for your contributions.</p>
                                <button
                                    onClick={handleSetupPayouts}
                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                >
                                    Connect Stripe Account
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Payout History */}
                    {profile.stripeConnectAccountId && (
                        <div className="bg-white shadow-md rounded-lg p-4 border border-emerald-200">
                            <h3 className="text-xl font-semibold mb-2 text-emerald-600">
                                Payout History
                            </h3>
                            {isLoadingPayouts ? (
                                <div className="flex items-center"><Spinner /><span className="ml-2">Loading payout history...</span></div>
                            ) : isPayoutHistoryError ? (
                                <p className="text-red-500">Error loading payouts: {(payoutHistoryError as Error)?.message}</p>
                            ) : payoutHistoryData && payoutHistoryData.payouts.length > 0 ? (
                                <ul className="space-y-2 max-h-60 overflow-y-auto">
                                    {payoutHistoryData.payouts.map((payout) => (
                                        <li key={payout._id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                            <div>
                                                <span className="font-medium">${payout.amount.toFixed(2)}</span>
                                                <span className="text-xs text-gray-500 ml-2">({payout.status})</span>
                                            </div>
                                            <span className="text-sm text-gray-600">{new Date(payout.timestamp).toLocaleDateString()}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No payouts received yet.</p>
                            )}
                        </div>
                    )}
      
                    {/* API Usage */}
                    <div className="mt-6">
                      <UsageDisplay /> {/* */}
                    </div>
                  </div>
      
                ) : ( // Else for if (!profile)
                  <p>Could not load profile information.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )
}