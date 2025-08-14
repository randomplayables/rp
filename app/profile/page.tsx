// "use client"

// import { Spinner } from "@/components/spinner"
// import { useUser, UserProfile } from "@clerk/nextjs"
// import toast, { Toaster } from "react-hot-toast"
// import Image from "next/image"
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
// import { availablePlans } from "@/lib/plans" 
// import { useState, useEffect } from "react"
// import { useRouter } from "next/navigation";
// import UsageDisplay from './UsageDisplay'; 
// import GitHubConnectButton from '@/components/GitHubConnectButton';
// import Link from 'next/link';

// interface LinkItem {
//     title: string;
//     url: string;
// }

// interface ProfileDetails {
//     subscriptionTier: string | null;
//     stripeSubscriptionId: string | null;
//     subscriptionActive: boolean;
//     stripeConnectAccountId: string | null;
//     stripePayoutsEnabled: boolean;
//     aboutMe?: string | null;
//     links?: LinkItem[] | null;
// }

// interface Payout {
//     _id: string;
//     amount: number;
//     timestamp: string;
//     status: string;
//     stripeTransferId?: string;
// }

// async function fetchProfileDetails(): Promise<{ profile: ProfileDetails } | null> {
//     const response = await fetch("/api/profile/details");
//     if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error || "Failed to fetch profile details");
//     }
//     return response.json();
// }

// async function fetchPayoutHistory(): Promise<{ payouts: Payout[] }> {
//     const response = await fetch("/api/profile/payouts"); 
//     if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error || "Failed to fetch payout history");
//     }
//     return response.json();
// }

// async function updateProfileDetails(details: { aboutMe?: string; links?: LinkItem[] }) {
//     const response = await fetch('/api/profile/details', {
//         method: 'PUT',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(details)
//     });
//     if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error || 'Failed to update profile details.');
//     }
//     return response.json();
// }

// async function updatePlan(newPlan: string) {
//     const response = await fetch("/api/profile/change-plan", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ newPlan }),
//     })
//     if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error || "Error updating plan.");
//     }
//     return response.json()
// }

// async function unsubscribe() {
//     const response = await fetch("/api/profile/unsubscribe", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//     })
//     if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error || "Error unsubscribing.");
//     }
//     return response.json()
// }

// export default function Profile() {
//     const [selectedPlan, setSelectedPlan] = useState<string>("") 
//     const { isLoaded, isSignedIn, user } = useUser() 
//     const queryClient = useQueryClient() 
//     const router = useRouter() 
//     const [isDisconnectingStripe, setIsDisconnectingStripe] = useState(false);
//     const [isCreatingManageLink, setIsCreatingManageLink] = useState(false);
//     const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
//     const [disconnectConfirmText, setDisconnectConfirmText] = useState("");
    
//     // State for the new About Me form
//     const [aboutMe, setAboutMe] = useState('');
//     const [links, setLinks] = useState<LinkItem[]>([{ title: '', url: '' }]);

//     const { data: profileData, isLoading: isLoadingProfile, isError: isProfileError, error: profileError, refetch: refetchProfileDetails } = useQuery({
//         queryKey: ["profileDetails"],
//         queryFn: fetchProfileDetails,
//         enabled: isLoaded && isSignedIn,
//         staleTime: 5 * 60 * 1000,
//     });
    
//     // Populate form when profile data loads
//     useEffect(() => {
//         if (profileData?.profile) {
//             setAboutMe(profileData.profile.aboutMe || '');
//             setLinks(profileData.profile.links && profileData.profile.links.length > 0 ? profileData.profile.links : [{ title: '', url: '' }]);
//         }
//     }, [profileData]);

//     const { data: payoutHistoryData, isLoading: isLoadingPayouts, isError: isPayoutHistoryError, error: payoutHistoryError } = useQuery({
//         queryKey: ["payoutHistory"],
//         queryFn: fetchPayoutHistory,
//         enabled: isLoaded && isSignedIn && !!profileData?.profile.stripeConnectAccountId,
//         staleTime: 5 * 60 * 1000,
//     });

//     const {
//         mutate: updateProfileMutation,
//         isPending: isUpdateProfilePending,
//     } = useMutation({
//         mutationFn: updateProfileDetails,
//         onSuccess: () => {
//             queryClient.invalidateQueries({ queryKey: ["profileDetails"] });
//             toast.success("Profile updated successfully!");
//         },
//         onError: (e: Error) => {
//             toast.error(e.message || "Error updating profile.");
//         }
//     });

//     const {
//         mutate: updatePlanMutation,
//         isPending: isUpdatePlanPending,
//     } = useMutation({ 
//         mutationFn: updatePlan, 
//         onSuccess: () => {
//             queryClient.invalidateQueries({queryKey: ["profileDetails"]}) 
//             toast.success("Subscription plan updated successfully!") 
//             refetchProfileDetails(); 
//         },
//         onError: (e: Error) => {
//             toast.error(e.message || "Error updating plan.") 
//         }
//     })

//     const {
//         mutate: unsubscribeMutation,
//         isPending: isUnsubscribePending,
//     } = useMutation({ 
//         mutationFn: unsubscribe, 
//         onSuccess: () => {
//             queryClient.invalidateQueries({queryKey: ["profileDetails"]}) 
//             toast.success("Unsubscribed successfully.");
//             refetchProfileDetails(); 
//             router.push("/subscribe");
//         },
//         onError: (e: Error) => {
//             toast.error(e.message || "Error unsubscribing.") 
//         }
//     })

//     const disconnectAccountMutation = useMutation<any, Error>({
//         mutationFn: async () => {
//             const response = await fetch('/api/profile/disconnect-account', {
//                 method: 'POST',
//             });
//             if (!response.ok) {
//                 const data = await response.json();
//                 throw new Error(data.error || 'Failed to disconnect account.');
//             }
//             return response.json();
//         },
//         onSuccess: () => {
//             toast.success('Account disconnected successfully. You will be logged out.');
//             router.push('/');
//         },
//         onError: (error: Error) => {
//             toast.error(`Error: ${error.message}`);
//             setIsDisconnectModalOpen(false);
//         }
//     });

//     const handleLinkChange = (index: number, field: 'title' | 'url', value: string) => {
//         const newLinks = [...links];
//         newLinks[index][field] = value;
//         setLinks(newLinks);
//     };

//     const addLink = () => setLinks([...links, { title: '', url: '' }]);
//     const removeLink = (index: number) => setLinks(links.filter((_, i) => i !== index));
    
//     const handleSaveAboutMe = () => {
//         updateProfileMutation({ aboutMe, links: links.filter(l => l.title && l.url) });
//     };

//     const handleDisconnectAccount = () => {
//         if (disconnectConfirmText === user?.username) {
//             disconnectAccountMutation.mutate();
//         } else {
//             toast.error("Username does not match.");
//         }
//     };

//     const currentPlanDetails = availablePlans.find(
//         plan => plan.planType === profileData?.profile?.subscriptionTier
//       )

//     function handleUpdatePlan() {
//         if (selectedPlan) {
//             updatePlanMutation(selectedPlan) 
//         }
//         setSelectedPlan("") 
//     }

//     function handleUnsubscribe() {
//         if (confirm("Are you sure you want to unsubscribe? You will lose access to premium features at the end of your current billing period.")) { 
//             unsubscribeMutation() 
//         }
//     }

//     const handleSetupPayouts = async () => {
//         toast.loading("Redirecting to Stripe for setup...");
//         try {
//             const response = await fetch('/api/stripe/connect-onboard', { method: 'POST' });
//             const data = await response.json();
//             if (data.url) {
//                 window.location.href = data.url; 
//             } else {
//                 toast.dismiss();
//                 toast.error(data.error || 'Failed to start Stripe onboarding.');
//             }
//         } catch (err) {
//             toast.dismiss();
//             toast.error('Error setting up payouts.');
//             console.error("Stripe onboarding error:", err);
//         }
//     };

//     const handleManageStripeAccount = async () => {
//         setIsCreatingManageLink(true);
//         toast.loading("Redirecting to your Stripe Dashboard...");
//         try {
//             const response = await fetch('/api/stripe/manage-account', { method: 'POST' });
//             const data = await response.json();
//             toast.dismiss();
//             if (data.url) {
//                 window.location.href = data.url;
//             } else {
//                 toast.error(data.error || 'Failed to create dashboard link.');
//             }
//         } catch (err) {
//             toast.dismiss();
//             toast.error('An error occurred.');
//             console.error("Stripe manage account error:", err);
//         } finally {
//             setIsCreatingManageLink(false);
//         }
//     };

//     const handleDisconnectStripe = async () => {
//         if (!confirm("Are you sure you want to disconnect your Stripe account? You will no longer receive payouts to this account and will need to set it up again if you wish to enable payouts in the future.")) {
//             return;
//         }
//         setIsDisconnectingStripe(true);
//         toast.loading("Disconnecting Stripe account...");
//         try {
//             const response = await fetch('/api/profile/stripe-disconnect', { method: 'POST' });
//             const data = await response.json();
//             toast.dismiss();
//             if (response.ok && data.success) {
//                 toast.success("Stripe account disconnected successfully!");
//                 refetchProfileDetails();
//             } else {
//                 toast.error(data.error || 'Failed to disconnect Stripe account.');
//             }
//         } catch (err: any) {
//             toast.dismiss();
//             toast.error(err.message || 'An error occurred while disconnecting Stripe.');
//             console.error("Stripe disconnect client-side error:", err);
//         } finally {
//             setIsDisconnectingStripe(false);
//         }
//     };

//     useEffect(() => {
//         const params = new URLSearchParams(window.location.search);
//         if (params.get('stripe_setup_complete') === 'true') {
//             toast.success('Stripe account setup complete! Your payout information is being verified by Stripe.');
//             refetchProfileDetails(); 
//             router.replace('/profile', { scroll: false });
//         }
//     }, [router, refetchProfileDetails]);


//     if (!isLoaded || isLoadingProfile){ 
//         return (
//             <div className="flex items-center justify-center min-h-screen bg-gray-50">
//                 <Spinner /><span className="ml-2"> Loading...</span>
//             </div>
//         )
//     }

//     if (!isSignedIn){ 
//         return (
//             <div className="flex items-center justify-center min-h-screen bg-gray-50">
//                 <p> Please sign in to view your profile.</p>
//             </div>
//         )
//     }
    
//     const profile = profileData?.profile;

//     return (
//         <div className="min-h-screen bg-gray-50 p-4">
//           <Toaster position="top-center" />
      
//           <div className="w-full max-w-6xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden my-8">
//             <div className="p-6">
//                 <div className="flex justify-between items-center mb-6">
//                     <h1 className="text-3xl font-bold text-gray-800">Manage Your Profile</h1>
//                     {user?.username && (
//                         <Link
//                             href={`/profile/${user.username}`}
//                             target="_blank"
//                             rel="noopener noreferrer"
//                             className="px-4 py-2 bg-emerald-500 text-white rounded-md font-medium hover:bg-emerald-600 transition-colors text-sm"
//                         >
//                             View Public Profile
//                         </Link>
//                     )}
//                 </div>
                
//                 {/* Clerk UserProfile Component */}
//                 <div className="mb-8">
//                     <UserProfile routing="path" path="/profile" appearance={{
//                         elements: {
//                             card: "shadow-none border border-gray-200",
//                             navbar: "hidden",
//                             header: "hidden",
//                             rootBox: "w-full",
//                             profileSection__danger: { 
//                                 display: "none" 
//                             }
//                         }
//                     }} />
//                 </div>
                
//                 {/* Custom Profile Details Form */}
//                 <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
//                     <h2 className="text-2xl font-bold text-emerald-700 mb-4">Public Profile Details</h2>
//                     <div className="space-y-4">
//                         <div>
//                             <label htmlFor="aboutMe" className="block text-sm font-medium text-gray-700">About Me</label>
//                             <textarea
//                                 id="aboutMe"
//                                 value={aboutMe}
//                                 onChange={(e) => setAboutMe(e.target.value)}
//                                 rows={4}
//                                 className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500"
//                                 placeholder="Tell us a little about yourself..."
//                             />
//                         </div>
//                         <div>
//                             <h3 className="block text-sm font-medium text-gray-700">Links</h3>
//                             {links.map((link, index) => (
//                                 <div key={index} className="flex items-center gap-2 mt-2">
//                                     <input
//                                         type="text"
//                                         placeholder="Link Title (e.g., My Website)"
//                                         value={link.title}
//                                         onChange={(e) => handleLinkChange(index, 'title', e.target.value)}
//                                         className="w-1/3 border border-gray-300 rounded-md shadow-sm py-2 px-3"
//                                     />
//                                     <input
//                                         type="url"
//                                         placeholder="URL (e.g., https://...)"
//                                         value={link.url}
//                                         onChange={(e) => handleLinkChange(index, 'url', e.target.value)}
//                                         className="flex-grow border border-gray-300 rounded-md shadow-sm py-2 px-3"
//                                     />
//                                     <button onClick={() => removeLink(index)} className="text-red-500 hover:text-red-700 p-2">&times;</button>
//                                 </div>
//                             ))}
//                             <button onClick={addLink} className="mt-2 text-sm text-emerald-600 hover:text-emerald-800">+ Add Link</button>
//                         </div>
//                         <div className="text-right">
//                             <button
//                                 onClick={handleSaveAboutMe}
//                                 disabled={isUpdateProfilePending}
//                                 className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
//                             >
//                                 {isUpdateProfilePending ? "Saving..." : "Save Profile Details"}
//                             </button>
//                         </div>
//                     </div>
//                 </div>

//                 {isProfileError ? (
//                   <p className="text-red-500">Error loading account details: {(profileError as Error)?.message}</p>
//                 ) : profile ? (
//                   <div className="space-y-6">
//                     <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
//                         <h3 className="text-xl font-semibold mb-2 text-gray-800">My Games</h3>
//                         <p className="text-sm text-gray-600 mb-3">Have a game you built? Submit it to the RandomPlayables platform.</p>
//                         <div className="flex space-x-3 items-center">
//                             <Link href="/profile/submit-game" className="inline-block px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors">
//                                 Submit a Game
//                             </Link>
//                             <Link href="/submit-guide" className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">
//                                 Submission Guide
//                             </Link>
//                         </div>
//                     </div>
//                     <div className="mt-6"><GitHubConnectButton /></div>
//                     <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
//                       <h3 className="text-xl font-semibold mb-2 text-gray-800">Current Plan</h3>
//                       {currentPlanDetails && profile.subscriptionActive ? (
//                         <>
//                           <p><strong>Plan:</strong> {currentPlanDetails.name}</p> 
//                           <p><strong>Amount:</strong> ${currentPlanDetails.amount}/{currentPlanDetails.interval}</p> 
//                           <p><strong>Status:</strong> <span className="font-semibold text-green-600">ACTIVE</span></p>
//                         </>
//                       ) : (<p>You are not subscribed to any plan.</p>)}
//                     </div>
//                     {profile.subscriptionActive && currentPlanDetails && (
//                       <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
//                         <h3 className="text-xl font-semibold mb-2 text-gray-800">Change Subscription Plan</h3>
//                         <>
//                           <select id="plan-select" value={selectedPlan} disabled={isUpdatePlanPending} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400" onChange={e => setSelectedPlan(e.target.value)}>
//                             <option value="" disabled>Select a New Plan</option>
//                             {availablePlans.map(plan => (plan.planType !== profile.subscriptionTier && <option key={plan.planType} value={plan.planType}>{plan.name} — ${plan.amount}/{plan.interval}</option> ))}
//                           </select>
//                           <button className="mt-3 w-full bg-emerald-500 text-white py-2 rounded-lg disabled:opacity-50" onClick={handleUpdatePlan} disabled={isUpdatePlanPending || !selectedPlan || selectedPlan === profile.subscriptionTier}>{isUpdatePlanPending ? "Updating…" : "Save Change"}</button> 
//                         </>
//                       </div>
//                     )}
//                      {profile.subscriptionActive && (<div className="bg-white shadow-md rounded-lg p-4 border border-red-200"><h3 className="text-xl font-semibold mb-2 text-red-600">Cancel Subscription</h3><button onClick={handleUnsubscribe} disabled={isUnsubscribePending} className={`w-full py-2 px-4 rounded-md text-white transition-colors ${isUnsubscribePending ? "bg-red-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"}`}>{isUnsubscribePending ? "Processing…" : "Unsubscribe"}</button> </div>)}
//                      {!profile.subscriptionActive && (<div className="bg-white shadow-md rounded-lg p-4 border border-gray-200"><p className="mb-2">You currently do not have an active subscription.</p><button onClick={() => router.push('/subscribe')} className="px-6 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors">View Subscription Plans</button></div>)}
//                     <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
//                         <h3 className="text-xl font-semibold mb-2 text-gray-800">Payout Settings</h3>
//                         {profile.stripeConnectAccountId ? (
//                             profile.stripePayoutsEnabled ? (<div><div className="text-green-700 mb-3"><p className="flex items-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.06 0l4-5.5Z" clipRule="evenodd" /></svg>Your payout account is currently enabled by Stripe.</p><p className="text-sm mt-1 pl-7">You can manage your details or update your bank information on Stripe.</p></div><button onClick={handleManageStripeAccount} disabled={isCreatingManageLink} className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50">{isCreatingManageLink ? "Redirecting..." : "Manage Stripe Account"}</button></div>) : (<div className="text-orange-600"><p>⚙️ Your Stripe account setup is in progress or requires more information.</p><p className="text-sm mt-1">Please continue to Stripe to complete your account setup and enable payouts.</p><button onClick={handleSetupPayouts} className="mt-3 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors">Continue Stripe Setup</button></div>)
//                         ) : (<div><p className="mb-3">Connect your Stripe account to receive payouts for your contributions.</p><button onClick={handleSetupPayouts} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">Connect Stripe Account</button></div>)}
//                     </div>
//                     {profile.stripeConnectAccountId && (<div className="bg-white shadow-md rounded-lg p-4 border border-gray-200"><h3 className="text-xl font-semibold mb-2 text-gray-800">Payout History</h3>{isLoadingPayouts ? (<div className="flex items-center"><Spinner /><span className="ml-2">Loading payout history...</span></div>) : isPayoutHistoryError ? (<p className="text-red-500">Error loading payouts: {(payoutHistoryError as Error)?.message}</p>) : payoutHistoryData && payoutHistoryData.payouts.length > 0 ? (<ul className="space-y-2 max-h-60 overflow-y-auto">{payoutHistoryData.payouts.map((payout) => (<li key={payout._id} className="flex justify-between items-center p-2 bg-gray-50 rounded"><div><span className="font-medium">${payout.amount.toFixed(2)}</span><span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${payout.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{payout.status}</span></div><span className="text-sm text-gray-600">{new Date(payout.timestamp).toLocaleDateString()}</span></li>))}</ul>) : (<p>No payouts received yet.</p>)}</div>)}
//                     {profile.stripeConnectAccountId && (<div className="bg-white shadow-md rounded-lg p-4 border border-red-200 mt-6"><h3 className="text-xl font-semibold mb-2 text-red-600">Disconnect Stripe Account</h3><p className="text-sm text-gray-600 mb-3">Disconnecting will remove your Stripe account information from our platform for future payouts. You can reconnect at any time.</p><button onClick={handleDisconnectStripe} disabled={isDisconnectingStripe} className={`w-full py-2 px-4 rounded-md text-white transition-colors ${isDisconnectingStripe ? "bg-red-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"}`}>{isDisconnectingStripe ? "Processing…" : "Disconnect Stripe Account"}</button></div>)}
//                     <div className="mt-6"><UsageDisplay /></div>
//                     <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
//                         <h3 className="text-xl font-semibold mb-2 text-red-700">Danger Zone</h3>
//                         <p className="text-sm text-red-600 mb-4">Disconnecting your account is a permanent action and cannot be undone. All your personal data, contributions, and content will be deleted from our platform.</p>
//                         <button onClick={() => setIsDisconnectModalOpen(true)} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">Disconnect Account</button>
//                     </div>
//                   </div>
//                 ) : ( <p>Could not load profile information.</p> )}
//               </div>
//           </div>
//           {isDisconnectModalOpen && (
//             <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
//                 <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
//                     <h3 className="text-lg font-bold mb-4 text-red-700">Are you absolutely sure?</h3>
//                     <p className="text-sm text-gray-700 mb-4">This action is irreversible. Your profile, subscriptions, API usage, and personally saved content (like sketches and visualizations) will be permanently deleted. To maintain the integrity of community discussions, your questions and answers will be disassociated from your account and fully anonymized.</p>
//                     <p className="text-sm text-gray-700 mb-2">Please type your username <strong className="font-mono">{user?.username}</strong> to confirm.</p>
//                     <input type="text" value={disconnectConfirmText} onChange={(e) => setDisconnectConfirmText(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4" />
//                     <div className="flex justify-end space-x-2">
//                         <button onClick={() => setIsDisconnectModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
//                         <button onClick={handleDisconnectAccount} disabled={disconnectConfirmText !== user?.username || disconnectAccountMutation.isPending} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center">
//                             {disconnectAccountMutation.isPending && <Spinner className="w-4 h-4 mr-2" />}
//                             {disconnectAccountMutation.isPending ? 'Disconnecting...' : 'I understand, disconnect my account'}
//                         </button>
//                     </div>
//                 </div>
//             </div>
//           )}
//         </div>
//       )
// }





"use client"

import { Spinner } from "@/components/spinner"
import { useUser, UserProfile } from "@clerk/nextjs"
import toast, { Toaster } from "react-hot-toast"
import Image from "next/image"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { availablePlans } from "@/lib/plans" 
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation";
import UsageDisplay from './UsageDisplay'; 
import GitHubConnectButton from '@/components/GitHubConnectButton';
import Link from 'next/link';

interface LinkItem {
    title: string;
    url: string;
}

interface ProfileDetails {
    subscriptionTier: string | null;
    stripeSubscriptionId: string | null;
    subscriptionActive: boolean;
    stripeConnectAccountId: string | null;
    stripePayoutsEnabled: boolean;
    aboutMe?: string | null;
    links?: LinkItem[] | null;
}

interface Payout {
    _id: string;
    amount: number;
    timestamp: string;
    status: string;
    stripeTransferId?: string;
}

async function fetchProfileDetails(): Promise<{ profile: ProfileDetails } | null> {
    const response = await fetch("/api/profile/details");
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch profile details");
    }
    return response.json();
}

async function fetchPayoutHistory(): Promise<{ payouts: Payout[] }> {
    const response = await fetch("/api/profile/payouts"); 
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch payout history");
    }
    return response.json();
}

async function updateProfileDetails(details: { aboutMe?: string; links?: LinkItem[] }) {
    const response = await fetch('/api/profile/details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details)
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile details.');
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
    const [selectedPlan, setSelectedPlan] = useState<string>("") 
    const { isLoaded, isSignedIn, user } = useUser() 
    const queryClient = useQueryClient() 
    const router = useRouter() 
    const [isDisconnectingStripe, setIsDisconnectingStripe] = useState(false);
    const [isCreatingManageLink, setIsCreatingManageLink] = useState(false);
    const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
    const [disconnectConfirmText, setDisconnectConfirmText] = useState("");
    
    // State for the new About Me form
    const [aboutMe, setAboutMe] = useState('');
    const [links, setLinks] = useState<LinkItem[]>([{ title: '', url: '' }]);

    const { data: profileData, isLoading: isLoadingProfile, isError: isProfileError, error: profileError, refetch: refetchProfileDetails } = useQuery({
        queryKey: ["profileDetails"],
        queryFn: fetchProfileDetails,
        enabled: isLoaded && isSignedIn,
        staleTime: 5 * 60 * 1000,
    });
    
    // Populate form when profile data loads
    useEffect(() => {
        if (profileData?.profile) {
            setAboutMe(profileData.profile.aboutMe || '');
            setLinks(profileData.profile.links && profileData.profile.links.length > 0 ? profileData.profile.links : [{ title: '', url: '' }]);
        }
    }, [profileData]);

    const { data: payoutHistoryData, isLoading: isLoadingPayouts, isError: isPayoutHistoryError, error: payoutHistoryError } = useQuery({
        queryKey: ["payoutHistory"],
        queryFn: fetchPayoutHistory,
        enabled: isLoaded && isSignedIn && !!profileData?.profile.stripeConnectAccountId,
        staleTime: 5 * 60 * 1000,
    });

    const {
        mutate: updateProfileMutation,
        isPending: isUpdateProfilePending,
    } = useMutation({
        mutationFn: updateProfileDetails,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["profileDetails"] });
            toast.success("Profile updated successfully!");
        },
        onError: (e: Error) => {
            toast.error(e.message || "Error updating profile.");
        }
    });

    const {
        mutate: updatePlanMutation,
        isPending: isUpdatePlanPending,
    } = useMutation({ 
        mutationFn: updatePlan, 
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ["profileDetails"]}) 
            toast.success("Subscription plan updated successfully!") 
            refetchProfileDetails(); 
        },
        onError: (e: Error) => {
            toast.error(e.message || "Error updating plan.") 
        }
    })

    const {
        mutate: unsubscribeMutation,
        isPending: isUnsubscribePending,
    } = useMutation({ 
        mutationFn: unsubscribe, 
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ["profileDetails"]}) 
            toast.success("Unsubscribed successfully.");
            refetchProfileDetails(); 
            router.push("/subscribe");
        },
        onError: (e: Error) => {
            toast.error(e.message || "Error unsubscribing.") 
        }
    })

    const disconnectAccountMutation = useMutation<any, Error>({
        mutationFn: async () => {
            const response = await fetch('/api/profile/disconnect-account', {
                method: 'POST',
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to disconnect account.');
            }
            return response.json();
        },
        onSuccess: () => {
            toast.success('Account disconnected successfully. You will be logged out.');
            router.push('/');
        },
        onError: (error: Error) => {
            toast.error(`Error: ${error.message}`);
            setIsDisconnectModalOpen(false);
        }
    });

    const handleLinkChange = (index: number, field: 'title' | 'url', value: string) => {
        const newLinks = [...links];
        newLinks[index][field] = value;
        setLinks(newLinks);
    };

    const addLink = () => setLinks([...links, { title: '', url: '' }]);
    const removeLink = (index: number) => setLinks(links.filter((_, i) => i !== index));
    
    const handleSaveAboutMe = () => {
        updateProfileMutation({ aboutMe, links: links.filter(l => l.title && l.url) });
    };

    const handleDisconnectAccount = () => {
        if (disconnectConfirmText === user?.username) {
            disconnectAccountMutation.mutate();
        } else {
            toast.error("Username does not match.");
        }
    };

    const currentPlanDetails = availablePlans.find(
        plan => plan.planType === profileData?.profile?.subscriptionTier
      )

    function handleUpdatePlan() {
        if (selectedPlan) {
            updatePlanMutation(selectedPlan) 
        }
        setSelectedPlan("") 
    }

    function handleUnsubscribe() {
        if (confirm("Are you sure you want to unsubscribe? You will lose access to premium features at the end of your current billing period.")) { 
            unsubscribeMutation() 
        }
    }

    const handleSetupPayouts = async () => {
        toast.loading("Redirecting to Stripe for setup...");
        try {
            const response = await fetch('/api/stripe/connect-onboard', { method: 'POST' });
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url; 
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

    const handleManageStripeAccount = async () => {
        setIsCreatingManageLink(true);
        toast.loading("Redirecting to your Stripe Dashboard...");
        try {
            const response = await fetch('/api/stripe/manage-account', { method: 'POST' });
            const data = await response.json();
            toast.dismiss();
            if (data.url) {
                window.location.href = data.url;
            } else {
                toast.error(data.error || 'Failed to create dashboard link.');
            }
        } catch (err) {
            toast.dismiss();
            toast.error('An error occurred.');
            console.error("Stripe manage account error:", err);
        } finally {
            setIsCreatingManageLink(false);
        }
    };

    const handleDisconnectStripe = async () => {
        if (!confirm("Are you sure you want to disconnect your Stripe account? You will no longer receive payouts to this account and will need to set it up again if you wish to enable payouts in the future.")) {
            return;
        }
        setIsDisconnectingStripe(true);
        toast.loading("Disconnecting Stripe account...");
        try {
            const response = await fetch('/api/profile/stripe-disconnect', { method: 'POST' });
            const data = await response.json();
            toast.dismiss();
            if (response.ok && data.success) {
                toast.success("Stripe account disconnected successfully!");
                refetchProfileDetails();
            } else {
                toast.error(data.error || 'Failed to disconnect Stripe account.');
            }
        } catch (err: any) {
            toast.dismiss();
            toast.error(err.message || 'An error occurred while disconnecting Stripe.');
            console.error("Stripe disconnect client-side error:", err);
        } finally {
            setIsDisconnectingStripe(false);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('stripe_setup_complete') === 'true') {
            // DISABLED: This toast was showing prematurely before the webhook confirmed the status.
            // toast.success('Stripe account setup complete! Your payout information is being verified by Stripe.');
            refetchProfileDetails(); 
            router.replace('/profile', { scroll: false });
        }
    }, [router, refetchProfileDetails]);


    if (!isLoaded || isLoadingProfile){ 
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Spinner /><span className="ml-2"> Loading...</span>
            </div>
        )
    }

    if (!isSignedIn){ 
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <p> Please sign in to view your profile.</p>
            </div>
        )
    }
    
    const profile = profileData?.profile;

    return (
        <div className="min-h-screen bg-gray-50 p-4">
          <Toaster position="top-center" />
      
          <div className="w-full max-w-6xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden my-8">
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Manage Your Profile</h1>
                    {user?.username && (
                        <Link
                            href={`/profile/${user.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-emerald-500 text-white rounded-md font-medium hover:bg-emerald-600 transition-colors text-sm"
                        >
                            View Public Profile
                        </Link>
                    )}
                </div>
                
                {/* Clerk UserProfile Component */}
                <div className="mb-8">
                    <UserProfile routing="path" path="/profile" appearance={{
                        elements: {
                            card: "shadow-none border border-gray-200",
                            navbar: "hidden",
                            header: "hidden",
                            rootBox: "w-full",
                            profileSection__danger: { 
                                display: "none" 
                            }
                        }
                    }} />
                </div>
                
                {/* Custom Profile Details Form */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
                    <h2 className="text-2xl font-bold text-emerald-700 mb-4">Public Profile Details</h2>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="aboutMe" className="block text-sm font-medium text-gray-700">About Me</label>
                            <textarea
                                id="aboutMe"
                                value={aboutMe}
                                onChange={(e) => setAboutMe(e.target.value)}
                                rows={4}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500"
                                placeholder="Tell us a little about yourself..."
                            />
                        </div>
                        <div>
                            <h3 className="block text-sm font-medium text-gray-700">Links</h3>
                            {links.map((link, index) => (
                                <div key={index} className="flex items-center gap-2 mt-2">
                                    <input
                                        type="text"
                                        placeholder="Link Title (e.g., My Website)"
                                        value={link.title}
                                        onChange={(e) => handleLinkChange(index, 'title', e.target.value)}
                                        className="w-1/3 border border-gray-300 rounded-md shadow-sm py-2 px-3"
                                    />
                                    <input
                                        type="url"
                                        placeholder="URL (e.g., https://...)"
                                        value={link.url}
                                        onChange={(e) => handleLinkChange(index, 'url', e.target.value)}
                                        className="flex-grow border border-gray-300 rounded-md shadow-sm py-2 px-3"
                                    />
                                    <button onClick={() => removeLink(index)} className="text-red-500 hover:text-red-700 p-2">&times;</button>
                                </div>
                            ))}
                            <button onClick={addLink} className="mt-2 text-sm text-emerald-600 hover:text-emerald-800">+ Add Link</button>
                        </div>
                        <div className="text-right">
                            <button
                                onClick={handleSaveAboutMe}
                                disabled={isUpdateProfilePending}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {isUpdateProfilePending ? "Saving..." : "Save Profile Details"}
                            </button>
                        </div>
                    </div>
                </div>

                {isProfileError ? (
                  <p className="text-red-500">Error loading account details: {(profileError as Error)?.message}</p>
                ) : profile ? (
                  <div className="space-y-6">
                    <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
                        <h3 className="text-xl font-semibold mb-2 text-gray-800">My Games</h3>
                        <p className="text-sm text-gray-600 mb-3">Have a game you built? Submit it to the RandomPlayables platform.</p>
                        <div className="flex space-x-3 items-center">
                            <Link href="/profile/submit-game" className="inline-block px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors">
                                Submit a Game
                            </Link>
                            <Link href="/submit-guide" className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">
                                Submission Guide
                            </Link>
                        </div>
                    </div>
                    <div className="mt-6"><GitHubConnectButton /></div>
                    <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
                      <h3 className="text-xl font-semibold mb-2 text-gray-800">Current Plan</h3>
                      {currentPlanDetails && profile.subscriptionActive ? (
                        <>
                          <p><strong>Plan:</strong> {currentPlanDetails.name}</p> 
                          <p><strong>Amount:</strong> ${currentPlanDetails.amount}/{currentPlanDetails.interval}</p> 
                          <p><strong>Status:</strong> <span className="font-semibold text-green-600">ACTIVE</span></p>
                        </>
                      ) : (<p>You are not subscribed to any plan.</p>)}
                    </div>
                    {profile.subscriptionActive && currentPlanDetails && (
                      <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
                        <h3 className="text-xl font-semibold mb-2 text-gray-800">Change Subscription Plan</h3>
                        <>
                          <select id="plan-select" value={selectedPlan} disabled={isUpdatePlanPending} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400" onChange={e => setSelectedPlan(e.target.value)}>
                            <option value="" disabled>Select a New Plan</option>
                            {availablePlans.map(plan => (plan.planType !== profile.subscriptionTier && <option key={plan.planType} value={plan.planType}>{plan.name} — ${plan.amount}/{plan.interval}</option> ))}
                          </select>
                          <button className="mt-3 w-full bg-emerald-500 text-white py-2 rounded-lg disabled:opacity-50" onClick={handleUpdatePlan} disabled={isUpdatePlanPending || !selectedPlan || selectedPlan === profile.subscriptionTier}>{isUpdatePlanPending ? "Updating…" : "Save Change"}</button> 
                        </>
                      </div>
                    )}
                     {profile.subscriptionActive && (<div className="bg-white shadow-md rounded-lg p-4 border border-red-200"><h3 className="text-xl font-semibold mb-2 text-red-600">Cancel Subscription</h3><button onClick={handleUnsubscribe} disabled={isUnsubscribePending} className={`w-full py-2 px-4 rounded-md text-white transition-colors ${isUnsubscribePending ? "bg-red-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"}`}>{isUnsubscribePending ? "Processing…" : "Unsubscribe"}</button> </div>)}
                     {!profile.subscriptionActive && (<div className="bg-white shadow-md rounded-lg p-4 border border-gray-200"><p className="mb-2">You currently do not have an active subscription.</p><button onClick={() => router.push('/subscribe')} className="px-6 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors">View Subscription Plans</button></div>)}
                    <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
                        <h3 className="text-xl font-semibold mb-2 text-gray-800">Payout Settings</h3>
                        {profile.stripeConnectAccountId ? (
                            profile.stripePayoutsEnabled ? (<div><div className="text-green-700 mb-3"><p className="flex items-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.06 0l4-5.5Z" clipRule="evenodd" /></svg>Your payout account is currently enabled by Stripe.</p><p className="text-sm mt-1 pl-7">You can manage your details or update your bank information on Stripe.</p></div><button onClick={handleManageStripeAccount} disabled={isCreatingManageLink} className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50">{isCreatingManageLink ? "Redirecting..." : "Manage Stripe Account"}</button></div>) : (<div className="text-orange-600"><p>⚙️ Your Stripe account setup is in progress or requires more information.</p><p className="text-sm mt-1">Please continue to Stripe to complete your account setup and enable payouts.</p><button onClick={handleSetupPayouts} className="mt-3 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors">Continue Stripe Setup</button></div>)
                        ) : (<div><p className="mb-3">Connect your Stripe account to receive payouts for your contributions.</p><button onClick={handleSetupPayouts} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">Connect Stripe Account</button></div>)}
                    </div>
                    {profile.stripeConnectAccountId && (<div className="bg-white shadow-md rounded-lg p-4 border border-gray-200"><h3 className="text-xl font-semibold mb-2 text-gray-800">Payout History</h3>{isLoadingPayouts ? (<div className="flex items-center"><Spinner /><span className="ml-2">Loading payout history...</span></div>) : isPayoutHistoryError ? (<p className="text-red-500">Error loading payouts: {(payoutHistoryError as Error)?.message}</p>) : payoutHistoryData && payoutHistoryData.payouts.length > 0 ? (<ul className="space-y-2 max-h-60 overflow-y-auto">{payoutHistoryData.payouts.map((payout) => (<li key={payout._id} className="flex justify-between items-center p-2 bg-gray-50 rounded"><div><span className="font-medium">${payout.amount.toFixed(2)}</span><span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${payout.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{payout.status}</span></div><span className="text-sm text-gray-600">{new Date(payout.timestamp).toLocaleDateString()}</span></li>))}</ul>) : (<p>No payouts received yet.</p>)}</div>)}
                    {profile.stripeConnectAccountId && (<div className="bg-white shadow-md rounded-lg p-4 border border-red-200 mt-6"><h3 className="text-xl font-semibold mb-2 text-red-600">Disconnect Stripe Account</h3><p className="text-sm text-gray-600 mb-3">Disconnecting will remove your Stripe account information from our platform for future payouts. You can reconnect at any time.</p><button onClick={handleDisconnectStripe} disabled={isDisconnectingStripe} className={`w-full py-2 px-4 rounded-md text-white transition-colors ${isDisconnectingStripe ? "bg-red-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"}`}>{isDisconnectingStripe ? "Processing…" : "Disconnect Stripe Account"}</button></div>)}
                    <div className="mt-6"><UsageDisplay /></div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
                        <h3 className="text-xl font-semibold mb-2 text-red-700">Danger Zone</h3>
                        <p className="text-sm text-red-600 mb-4">Disconnecting your account is a permanent action and cannot be undone. All your personal data, contributions, and content will be deleted from our platform.</p>
                        <button onClick={() => setIsDisconnectModalOpen(true)} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">Disconnect Account</button>
                    </div>
                  </div>
                ) : ( <p>Could not load profile information.</p> )}
              </div>
          </div>
          {isDisconnectModalOpen && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                    <h3 className="text-lg font-bold mb-4 text-red-700">Are you absolutely sure?</h3>
                    <p className="text-sm text-gray-700 mb-4">This action is irreversible. Your profile, subscriptions, API usage, and personally saved content (like sketches and visualizations) will be permanently deleted. To maintain the integrity of community discussions, your questions and answers will be disassociated from your account and fully anonymized.</p>
                    <p className="text-sm text-gray-700 mb-2">Please type your username <strong className="font-mono">{user?.username}</strong> to confirm.</p>
                    <input type="text" value={disconnectConfirmText} onChange={(e) => setDisconnectConfirmText(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4" />
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setIsDisconnectModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                        <button onClick={handleDisconnectAccount} disabled={disconnectConfirmText !== user?.username || disconnectAccountMutation.isPending} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center">
                            {disconnectAccountMutation.isPending && <Spinner className="w-4 h-4 mr-2" />}
                            {disconnectAccountMutation.isPending ? 'Disconnecting...' : 'I understand, disconnect my account'}
                        </button>
                    </div>
                </div>
            </div>
          )}
        </div>
      )
}