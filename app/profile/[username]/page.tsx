"use client"

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Spinner } from '@/components/spinner';
import ProfileVisualizationCard from './components/ProfileVisualizationCard';
import ProfileSketchCard from './components/ProfileSketchCard';
import ProfileInstrumentCard from './components/ProfileInstrumentCard';

// Types
interface ProfileData {
  username: string;
  userId: string;
  imageUrl?: string;
}

interface Visualization {
  _id: string;
  title: string;
  description: string;
  code: string;
  previewImage?: string;
  createdAt: string;
}

interface Sketch {
  _id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  previewImage?: string;
  createdAt: string;
}

interface Instrument {
  _id: string;
  title: string;
  description: string;
  surveyId: string;
  questionCount: number;
  responseCount: number;
  shareableLink: string;
  createdAt: string;
}

export default function UserProfilePage() {
  const { username } = useParams();
  const { user: currentUser, isLoaded: isUserLoaded } = useUser();
  
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'visualizations' | 'sketches' | 'instruments'>('visualizations');
  
  // Check if this is the current user's profile
  const isOwnProfile = isUserLoaded && currentUser?.username === username;
  
  // Fetch profile data
  useEffect(() => {
    async function fetchProfileData() {
      if (!username) return;
      
      try {
        // For a real implementation, you would fetch profile data from Clerk API
        // For now, we'll just construct basic data from the username
        setProfileData({
          username: username as string,
          userId: isOwnProfile ? currentUser!.id : username as string,
          imageUrl: isOwnProfile ? currentUser?.imageUrl : undefined
        });
      } catch (error) {
        console.error('Error fetching profile data:', error);
      }
    }
    
    if (username) {
      fetchProfileData();
    }
  }, [username, isOwnProfile, currentUser, isUserLoaded]);
  
  // Fetch user content (visualizations, sketches, instruments)
  useEffect(() => {
    async function fetchUserContent() {
      if (!profileData) return;
      
      setLoading(true);
      
      try {
        // Fetch visualizations
        const visRes = await fetch(`/api/profile/visualizations?userId=${profileData.userId}`);
        const visData = await visRes.json();
        setVisualizations(visData.visualizations || []);
        
        // Fetch sketches
        const sketchRes = await fetch(`/api/profile/sketches?userId=${profileData.userId}`);
        const sketchData = await sketchRes.json();
        setSketches(sketchData.sketches || []);
        
        // Fetch instruments
        const instRes = await fetch(`/api/profile/instruments?userId=${profileData.userId}`);
        const instData = await instRes.json();
        setInstruments(instData.instruments || []);
      } catch (error) {
        console.error('Error fetching user content:', error);
      } finally {
        setLoading(false);
      }
    }
    
    if (profileData) {
      fetchUserContent();
    }
  }, [profileData]);
  
  if (!isUserLoaded || !profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
        <span className="ml-2">Loading profile...</span>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center">
          <div className="mr-6">
            {profileData.imageUrl ? (
              <img 
                src={profileData.imageUrl} 
                alt={profileData.username}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 text-xl font-bold">
                {profileData.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          <div>
            <h1 className="text-2xl font-bold">{profileData.username}</h1>
            {/* Additional profile info could go here */}
          </div>
        </div>
      </div>
      
      {/* Content Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'visualizations' 
                  ? 'border-emerald-500 text-emerald-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('visualizations')}
            >
              Visualizations
            </button>
            
            <button
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'sketches' 
                  ? 'border-emerald-500 text-emerald-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('sketches')}
            >
              Sketches
            </button>
            
            <button
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'instruments' 
                  ? 'border-emerald-500 text-emerald-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('instruments')}
            >
              Instruments
            </button>
          </nav>
        </div>
      </div>
      
      {/* Content Display */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
          <span className="ml-2">Loading content...</span>
        </div>
      ) : (
        <>
          {/* Visualizations */}
          {activeTab === 'visualizations' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Visualizations</h2>
              {visualizations.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {isOwnProfile 
                    ? "You haven't created any visualizations yet. Head over to DataLab to get started!" 
                    : `${profileData.username} hasn't shared any visualizations yet.`}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visualizations.map((viz) => (
                    <ProfileVisualizationCard 
                      key={viz._id} 
                      visualization={viz} 
                      isOwner={isOwnProfile}
                      onDelete={() => {
                        // Handle deletion and refresh the list
                        setVisualizations(prevViz => 
                          prevViz.filter(v => v._id !== viz._id)
                        );
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Sketches */}
          {activeTab === 'sketches' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Sketches</h2>
              {sketches.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {isOwnProfile 
                    ? "You haven't created any game sketches yet. Head over to GameLab to create something!" 
                    : `${profileData.username} hasn't shared any game sketches yet.`}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sketches.map((sketch) => (
                    <ProfileSketchCard 
                      key={sketch._id} 
                      sketch={sketch} 
                      isOwner={isOwnProfile}
                      onDelete={() => {
                        setSketches(prevSketches => 
                          prevSketches.filter(s => s._id !== sketch._id)
                        );
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Instruments */}
          {activeTab === 'instruments' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Instruments</h2>
              {instruments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {isOwnProfile 
                    ? "You haven't created any survey instruments yet. Head over to Collect to build one!" 
                    : `${profileData.username} hasn't shared any survey instruments yet.`}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {instruments.map((instrument) => (
                    <ProfileInstrumentCard 
                      key={instrument._id} 
                      instrument={instrument} 
                      isOwner={isOwnProfile}
                      onDelete={() => {
                        setInstruments(prevInst => 
                          prevInst.filter(i => i._id !== instrument._id)
                        );
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}