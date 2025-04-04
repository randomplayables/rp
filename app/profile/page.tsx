"use client"
import { Spinner } from "@/components/spinner"
import { useUser } from "@clerk/nextjs"
import { Toaster } from "react-hot-toast"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { availablePlans } from "@/lib/plans"

async function fetchSubscriptionStatus() {
    const response = await fetch("/api/profile/subscription-status")
    return response.json()
}

export default function Profile() {
    const  {isLoaded, isSignedIn, user } = useUser()
    const {data: subscription, isLoading, isError, error} = useQuery({
        queryKey: ["subscription"],
        queryFn: fetchSubscriptionStatus,
        enabled: isLoaded && isSignedIn,
        staleTime: 5 * 60 * 1000,
    })

    const currentPlan = availablePlans.find(
        (plan) => plan.interval === subscription?.subscription.subscriptionTier
    )

    if (!isLoaded){
        return (
            <div className="flex items-center justify-center min-h-screen bg-emerald-100">
                <Spinner /><span className="ml-2"> Loading...</span>
            </div>
        )
    }

    if (!isSignedIn){
        return (
            <div  className="flex items-center justify-center min-h-screen bg-emerald-100">
                <p> Please sign in to view your profile.</p>
            </div>
        )
    }

    return (
        <div  className="min-h-screen flex items-center justify-center bg-emerald-100 p-4">
            <Toaster position="top-center" />
            <div  className="w-full max-w-5xl bg-white shadow-lg rounded-lg overflow-hidden">
                <div  className="flex flex-col md:flex-row">
                    <div  className="w-full md:w-1/3 p-6 bg-emerald-500 text-white flex flex-col items-center">
                        {user.imageUrl && (
                            <Image
                                src={user.imageUrl}
                                alt="User Avatar"
                                width={100}
                                height={100}
                                className="rounded-full mb-4"
                            />
                        )}
                        <h1  className="text-2xl font-bold mb-2"> {user.firstName} {user.lastName} </h1>
                        <p className="mb-4"> {user.primaryEmailAddress?.emailAddress}</p>
                    </div>
                    <div  className="w-full md:w-2/3 p-6 bg-gray-50">
                        <h2  className="text-2xl font-bold mb-6 text-emerald-700"> Subscription Details </h2>
                        {isLoading ? 
                        (
                            <div className="flex items-center">
                                <Spinner /><span  className="ml-2"> Loading subscription details...</span>
                            </div>
                        ) : isError ? (
                            <p className="text-red-500">{error?.message}</p>
                        ) : subscription ? (
                            <div className="bg-white shadow-md rounded-lg p-4 border border-emerald-200">
                                <h3  className="text-xl font-semibold mb-2 text-emerald-600"> Current Plan</h3>
                                {currentPlan ? (
                                    <div>
                                        <>
                                            <p><strong> Plan: </strong>{currentPlan.name}</p>
                                            <p><strong> Amount: </strong>{currentPlan.amount}{currentPlan.currency}</p>
                                            <p><strong> Status: </strong> ACTIVE</p>
                                        </>
                                    </div>
                                ) : (<p className="text-red-500">Current Plan not Found.</p>)}
                            </div>
                        ) : (
                            <p> You are not subscribed to any plan.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )

}