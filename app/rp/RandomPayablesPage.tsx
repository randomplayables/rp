// "use client"

// import { Spinner } from "@/components/spinner";
// import { useState } from "react";
// import ProbabilityIndicator from "./components/ProbabilityIndicator";
// import PayoutSimulator from "./components/PayoutSimulator";
// import ContributionStats from "./components/ContributionStats";

// export default function RandomPayablesPage() {
//   // State to track active tab
//   const [activeTab, setActiveTab] = useState<'overview' | 'simulate' | 'contribute'>('overview');
  
//   return (
//     <div className="min-h-screen">
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <div className="mb-10">
//           <h1 className="text-3xl font-bold text-gray-900">Random Payables</h1>
//           <p className="mt-2 text-lg text-gray-600">
//             Rewarding community contributions through probability-based distributions
//           </p>
//         </div>
        
//         {/* Tabs */}
//         <div className="mb-8 border-b border-gray-200">
//           <nav className="flex -mb-px space-x-8">
//             <button
//               onClick={() => setActiveTab('overview')}
//               className={`py-4 px-1 border-b-2 font-medium text-sm ${
//                 activeTab === 'overview'
//                   ? 'border-emerald-500 text-emerald-600'
//                   : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//               }`}
//             >
//               Overview
//             </button>
            
//             <button
//               onClick={() => setActiveTab('simulate')}
//               className={`py-4 px-1 border-b-2 font-medium text-sm ${
//                 activeTab === 'simulate'
//                   ? 'border-emerald-500 text-emerald-600'
//                   : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//               }`}
//             >
//               Run Simulation
//             </button>
            
//             <button
//               onClick={() => setActiveTab('contribute')}
//               className={`py-4 px-1 border-b-2 font-medium text-sm ${
//                 activeTab === 'contribute'
//                   ? 'border-emerald-500 text-emerald-600'
//                   : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//               }`}
//             >
//               How to Contribute
//             </button>
//           </nav>
//         </div>
        
//         {/* Tab Content */}
//         <div className="mt-6">
//           {/* Overview Tab */}
//           {activeTab === 'overview' && (
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
//               <div>
//                 <ProbabilityIndicator />
//               </div>
              
//               <div>
//                 <ContributionStats />
//               </div>
              
//               <div className="md:col-span-2">
//                 <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
//                   <h3 className="text-xl font-semibold mb-4">About Random Payables</h3>
                  
//                   <div className="prose max-w-none space-y-4">
//                     <p>
//                       Random Payables is our method for distributing a portion of platform profits back to the community of contributors who make RandomPlayables possible.
//                     </p>
                    
//                     <div>
//                       <h4 className="font-semibold">How It Works</h4>
//                       <ul className="list-disc pl-5 space-y-2 mt-2">
//                         <li>
//                           <strong>Contribute:</strong> Help the platform grow by developing the codebase, peer-reviewing games, creating your own games and content, and participating in community discussions.
//                         </li>
//                         <li>
//                           <strong>Earn Points:</strong> Every contribution you make earns you points. Different types of contributions are assigned different point values, or 'weights', based on the platform's needs.
//                         </li>
//                         <li>
//                           <strong>Win Payouts:</strong> For each dollar in the payout pool, a winner is randomly selected. Your chance of winning is proportional to your contribution points relative to all other contributors. The more you contribute, the higher your odds.
//                         </li>
//                         <li>
//                           <strong>Get Paid:</strong> Payouts are distributed on Fridays. To receive payouts, you must connect a Stripe account via your profile page. You can check your current win probability at any time. The weights for different contributions will evolve over time.
//                         </li>
//                       </ul>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           )}
          
//           {/* Simulation Tab */}
//           {activeTab === 'simulate' && (
//             <div>
//               <PayoutSimulator />
//             </div>
//           )}
          
//           {/* Contribution Tab */}
//           {activeTab === 'contribute' && (
//             <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
//               <div className="prose max-w-none">
//                   <h3 className="text-xl font-semibold mb-4">How to Contribute</h3>
//                   <p>
//                     Your probability of winning in Random Payables is directly proportional to your contributions. Here are the ways you can contribute and increase your chances, ordered by their current importance:
//                   </p>
                  
//                   <div className="space-y-6 mt-6">
//                     <div>
//                       <h4 className="font-bold text-lg">GitHub Platform & Peer Review Contributions</h4>
//                       <p>Improving the platform's core code and reviewing community games are the most impactful ways to contribute and are heavily weighted.</p>
//                       <ul className="list-disc pl-5 mt-2 space-y-1">
//                           <li><strong>Platform Development:</strong> Submit code improvements, bug fixes, and new features to the official RandomPlayables repository: <a href="https://github.com/randomplayables/rp" target="_blank" rel="noopener noreferrer">https://github.com/randomplayables/rp</a>.</li>
//                           <li><strong>Peer Review:</strong> Contribute to approved community games by submitting pull requests to their code repositories. Merged pull requests count as peer review contributions.</li>
//                       </ul>
//                     </div>
                    
//                     <div>
//                       <h4 className="font-bold text-lg">Game Publications</h4>
//                       <p>Getting a game approved and published on the platform is another highly-weighted activity that provides significant value to the community.</p>
//                       <ul className="list-disc pl-5 mt-2 space-y-1">
//                           <li>Submit your game for review through your profile page.</li>
//                           <li>Ensure the game is well-documented, functional, and aligns with the platform's mission.</li>
//                       </ul>
//                     </div>

//                     <div>
//                       <h4 className="font-bold text-lg">Content Creation</h4>
//                       <p>Create and share original content on the platform to earn contribution points.</p>
//                       <ul className="list-disc pl-5 mt-2 space-y-1">
//                           <li>Create new game sketches in GameLab.</li>
//                           <li>Build data visualizations in DataLab.</li>
//                           <li>Design survey instruments in Collect.</li>
//                       </ul>
//                     </div>
                    
//                     <div>
//                       <h4 className="font-bold text-lg">Community Engagement</h4>
//                       <p>Actively participating in the community helps other users and contributes to discussions.</p>
//                       <ul className="list-disc pl-5 mt-2 space-y-1">
//                           <li>Answer questions and provide feedback in the Stack.</li>
//                           <li>Participate in community events and challenges.</li>
//                       </ul>
//                     </div>

//                   </div>
                
//                   <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 mt-8">
//                     <h5 className="text-emerald-800 font-medium">Point Distribution</h5>
//                     <p className="text-emerald-700 text-sm">
//                       The exact weighting of different contribution types may be adjusted over time to ensure 
//                       fairness and incentivize valuable contributions. You can see the current point breakdown on the "Overview" tab.
//                     </p>
//                   </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }









"use client"

import { Spinner } from "@/components/spinner";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import ProbabilityIndicator from "./components/ProbabilityIndicator";
import PayoutSimulator from "./components/PayoutSimulator";
import ContributionStats from "./components/ContributionStats";
import PointTransferForm from "./components/PointTransferForm";
import { IUserContribution } from "@/models/RandomPayables";

export default function RandomPayablesPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'simulate' | 'contribute' | 'transfer'>('overview');
  const { user, isLoaded } = useUser();
  const [myContribution, setMyContribution] = useState<IUserContribution | null>(null);
  const [isLoadingContribution, setIsLoadingContribution] = useState(true);

  const fetchMyContribution = useCallback(async () => {
    if (isLoaded && user) {
      setIsLoadingContribution(true);
      try {
        const response = await fetch('/api/rp/contribution');
        if (response.ok) {
          const data = await response.json();
          if (data.userContribution) {
            setMyContribution(data.userContribution);
          } else {
            setMyContribution(null);
          }
        } else {
          setMyContribution(null);
        }
      } catch (error) {
        console.error("Failed to fetch contribution data", error);
        setMyContribution(null);
      } finally {
        setIsLoadingContribution(false);
      }
    } else if (isLoaded) {
      setIsLoadingContribution(false);
    }
  }, [isLoaded, user]);

  useEffect(() => {
    fetchMyContribution();
  }, [fetchMyContribution]);

  const handleTransferSuccess = () => {
    // Refetch contribution data after a successful transfer
    fetchMyContribution();
  };
  
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Random Payables</h1>
          <p className="mt-2 text-lg text-gray-600">
            Rewarding community contributions through probability-based distributions
          </p>
        </div>
        
        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="flex -mb-px space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            
            <button
              onClick={() => setActiveTab('simulate')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'simulate'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Run Simulation
            </button>
            
            <button
              onClick={() => setActiveTab('contribute')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'contribute'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              How to Contribute
            </button>
            <button
              onClick={() => setActiveTab('transfer')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'transfer'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Transfer Points
            </button>
          </nav>
        </div>
        
        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <ProbabilityIndicator />
              </div>
              
              <div>
                <ContributionStats />
              </div>
              
              <div className="md:col-span-2">
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                  <h3 className="text-xl font-semibold mb-4">About Random Payables</h3>
                  
                  <div className="prose max-w-none space-y-4">
                    <p>
                      Random Payables is our method for distributing a portion of platform profits back to the community of contributors who make RandomPlayables possible.
                    </p>
                    
                    <div>
                      <h4 className="font-semibold">How It Works</h4>
                      <ul className="list-disc pl-5 space-y-2 mt-2">
                        <li>
                          <strong>Contribute:</strong> Help the platform grow by developing the codebase, peer-reviewing games, creating your own games and content, and participating in community discussions.
                        </li>
                        <li>
                          <strong>Earn Points:</strong> Every contribution you make earns you points. Different types of contributions are assigned different point values, or 'weights', based on the platform's needs.
                        </li>
                        <li>
                          <strong>Win Payouts:</strong> For each dollar in the payout pool, a winner is randomly selected. Your chance of winning is proportional to your contribution points relative to all other contributors. The more you contribute, the higher your odds.
                        </li>
                        <li>
                          <strong>Get Paid:</strong> Payouts are distributed on Fridays. To receive payouts, you must connect a Stripe account via your profile page. You can check your current win probability at any time. The weights for different contributions will evolve over time.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'simulate' && (
            <div>
              <PayoutSimulator />
            </div>
          )}
          
          {activeTab === 'contribute' && (
            <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
              <div className="prose max-w-none">
                  <h3 className="text-xl font-semibold mb-4">How to Contribute</h3>
                  <p>
                    Your probability of winning in Random Payables is directly proportional to your contributions. Here are the ways you can contribute and increase your chances, ordered by their current importance:
                  </p>
                  
                  <div className="space-y-6 mt-6">
                    <div>
                      <h4 className="font-bold text-lg">GitHub Platform & Peer Review Contributions</h4>
                      <p>Improving the platform's core code and reviewing community games are the most impactful ways to contribute and are heavily weighted.</p>
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                          <li><strong>Platform Development:</strong> Submit code improvements, bug fixes, and new features to the official RandomPlayables repository: <a href="https://github.com/randomplayables/rp" target="_blank" rel="noopener noreferrer">https://github.com/randomplayables/rp</a>.</li>
                          <li><strong>Peer Review:</strong> Contribute to approved community games by submitting pull requests to their code repositories. Merged pull requests count as peer review contributions.</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-lg">Game Publications</h4>
                      <p>Getting a game approved and published on the platform is another highly-weighted activity that provides significant value to the community.</p>
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                          <li>Submit your game for review through your profile page.</li>
                          <li>Ensure the game is well-documented, functional, and aligns with the platform's mission.</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-bold text-lg">Content Creation</h4>
                      <p>Create and share original content on the platform to earn contribution points.</p>
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                          <li>Create new game sketches in GameLab.</li>
                          <li>Build data visualizations in DataLab.</li>
                          <li>Design survey instruments in Collect.</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-lg">Community Engagement</h4>
                      <p>Actively participating in the community helps other users and contributes to discussions.</p>
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                          <li>Answer questions and provide feedback in the Stack.</li>
                          <li>Participate in community events and challenges.</li>
                      </ul>
                    </div>

                  </div>
                
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 mt-8">
                    <h5 className="text-emerald-800 font-medium">Point Distribution</h5>
                    <p className="text-emerald-700 text-sm">
                      The exact weighting of different contribution types may be adjusted over time to ensure 
                      fairness and incentivize valuable contributions. You can see the current point breakdown on the "Overview" tab.
                    </p>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'transfer' && (
            isLoaded ? (
              isLoadingContribution ? (
                <div className="flex justify-center items-center p-8">
                  <Spinner />
                  <span className="ml-2">Loading your contribution data...</span>
                </div>
              ) : user ? (
                <PointTransferForm userContribution={myContribution} onTransferSuccess={handleTransferSuccess} />
              ) : (
                <div className="text-center p-8 bg-gray-50 rounded-lg">
                    <p>Please sign in to transfer points.</p>
                </div>
              )
            ) : (
              <div className="flex justify-center items-center p-8">
                <Spinner />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}