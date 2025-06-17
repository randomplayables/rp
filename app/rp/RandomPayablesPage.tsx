"use client"

import { Spinner } from "@/components/spinner";
import { useState } from "react";
import ProbabilityIndicator from "./components/ProbabilityIndicator";
import PayoutSimulator from "./components/PayoutSimulator";
import ContributionStats from "./components/ContributionStats";

export default function RandomPayablesPage() {
  // State to track active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'simulate' | 'contribute'>('overview');
  
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
          </nav>
        </div>
        
        {/* Tab Content */}
        <div className="mt-6">
          {/* Overview Tab */}
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
                  
                  <div className="prose max-w-none">
                    <p>
                      Random Payables is a way for RandomPlayables to distribute a portion of its profits back to the 
                      community of contributors who help make the platform possible.
                    </p>
                    
                    <h4>How it works:</h4>
                    
                    <ol>
                      <li>
                        <strong>Contribute to the platform:</strong> Create games, develop code, and participate in 
                        discussions.
                      </li>
                      <li>
                        <strong>Earn contribution points:</strong> Each type of contribution earns you points, with 
                        different weights based on the effort involved.
                      </li>
                      <li>
                        <strong>Win payouts probabilistically:</strong> For each dollar in the payout pool, winners are 
                        selected randomly, with probabilities proportional to contribution points.
                      </li>
                    </ol>
                    
                    <p>
                      Your probability of winning is directly related to your contribution level compared to all other 
                      contributors. The more you contribute, the higher your chance of winning payouts.
                    </p>
                    
                    <p>
                      Payouts are distributed on a regular schedule, and you can check your current probability of 
                      winning at any time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Simulation Tab */}
          {activeTab === 'simulate' && (
            <div>
              <PayoutSimulator />
            </div>
          )}
          
          {/* Contribution Tab */}
          {activeTab === 'contribute' && (
            <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
              <h3 className="text-xl font-semibold mb-4">How to Increase Your Win Probability</h3>
              
              <div className="prose max-w-none">
                <p>
                  Your probability of winning in Random Payables is directly proportional to your contributions to 
                  the RandomPlayables platform. Here are the ways you can contribute and increase your chances:
                </p>
                
                <h4>Code Contributions</h4>
                <p>
                  Submit code improvements, bug fixes, and new features to the RandomPlayables codebase. Code 
                  contributions are weighted highly in the probability calculations.
                </p>
                <ul>
                  <li>Submit pull requests to the platform repositories</li>
                  <li>Fix bugs and implement feature requests</li>
                  <li>Improve performance and accessibility</li>
                </ul>
                
                <h4>Content Creation</h4>
                <p>
                  Create and share games, visualizations, and other content on the platform. Quality content that 
                  engages other users earns substantial contribution points.
                </p>
                <ul>
                  <li>Create new games in GameLab</li>
                  <li>Build visualizations in DataLab</li>
                  <li>Design survey instruments in Collect</li>
                </ul>
                
                <h4>Community Engagement</h4>
                <p>
                  Participate actively in the RandomPlayables community. Help others, answer questions, and 
                  contribute to discussions.
                </p>
                <ul>
                  <li>Answer questions in Stack</li>
                  <li>Provide feedback on other users' content</li>
                  <li>Participate in community events and challenges</li>
                </ul>
                
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 mt-6">
                  <h5 className="text-emerald-800 font-medium">Point Distribution</h5>
                  <p className="text-emerald-700 text-sm">
                    The exact weighting of different contribution types may be adjusted over time to ensure 
                    fairness and incentivize valuable contributions. Currently, code contributions have 
                    the highest weight, followed by content creation and community engagement.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}