"use client"

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Spinner } from '@/components/spinner';
import ProfileVisualizationCard from './components/ProfileVisualizationCard';
import ProfileSketchCard from './components/ProfileSketchCard';
import ProfileInstrumentCard from './components/ProfileInstrumentCard';
import ProfileStackCard from './components/ProfileStackCard';
import ContentCard from '@/components/content-card';
import Link from 'next/link';

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
  files: any; // Changed from code/language
  previewImage?: string;
  createdAt: string;
  isPublic: boolean; // Added
  userId: string; // Added
  sketchGameId?: string; // Added
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

// Add Game type
interface Game {
  gameId: string;
  image: string;
  name: string;
  year: number;
  link: string;
  irlInstructions?: { title: string; url: string }[];
  codeUrl?: string;
  authorUsername?: string;
}

export default function UserProfilePage() {
  const { username } = useParams();
  const { user: currentUser, isLoaded: isUserLoaded } = useUser();
  
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [games, setGames] = useState<Game[]>([]); // Add games state
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stackLoading, setStackLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'visualizations' | 'sketches' | 'instruments' | 'games' | 'stack'>('visualizations');
  
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
  
  // Fetch user content (visualizations, sketches, instruments, games)
  useEffect(() => {
    async function fetchUserContent() {
      if (!profileData) return;
      
      setLoading(true);
      
      try {
        // If it's your own profile, filter by userId; otherwise by username
        const paramKey = isOwnProfile ? 'userId' : 'username';
        const paramValue = isOwnProfile ? profileData.userId : profileData.username;
        
        // Build the API URLs
        const visUrl = `/api/profile/visualizations?${paramKey}=${paramValue}`;
        const sketchUrl = `/api/profile/sketches?${paramKey}=${paramValue}`;
        const instUrl = `/api/profile/instruments?${paramKey}=${paramValue}`;
        
        // Fetch all content in parallel
        const [visRes, sketchRes, instRes, gamesRes] = await Promise.all([
          fetch(visUrl),
          fetch(sketchUrl),
          fetch(instUrl),
          // Games already uses authorUsername
          fetch(`/api/games?authorUsername=${profileData.username}`)
        ]);
        
        // Parse responses in parallel
        const [visData, sketchData, instData, gamesData] = await Promise.all([
          visRes.json(),
          sketchRes.json(),
          instRes.json(),
          gamesRes.json()
        ]);
        
        setVisualizations(visData.visualizations || []);
        setSketches(sketchData.sketches || []);
        setInstruments(instData.instruments || []);
        setGames(gamesData || []);
      } catch (error) {
        console.error('Error fetching user content:', error);
      } finally {
        setLoading(false);
      }
    }
    
    if (profileData) {
      fetchUserContent();
    }
  }, [profileData, isOwnProfile]);
  
  // Fetch Stack data when that tab is selected
  useEffect(() => {
    if (activeTab === 'stack' && profileData) {
      fetchStackData(profileData.userId);
    }
  }, [activeTab, profileData]);

  // Function to fetch Stack data
  const fetchStackData = async (userId: string) => {
    setStackLoading(true);
    try {
      // Use the same approach as other content types
      const paramKey = isOwnProfile ? 'userId' : 'username';
      const paramValue = isOwnProfile ? userId : profileData?.username;

      // Fetch user's questions
      const questionsRes = await fetch(`/api/stack/questions?${paramKey}=${paramValue}`);
      const questionsData = await questionsRes.json();
      setQuestions(questionsData.questions || []);
      
      // Fetch user's answers
      const answersRes = await fetch(`/api/stack/answers?${paramKey}=${paramValue}`);
      const answersData = await answersRes.json();
      setAnswers(answersData.answers || []);
    } catch (error) {
      console.error('Error fetching stack data:', error);
    } finally {
      setStackLoading(false);
    }
  };
  
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
            {/* Add Games tab */}
            <button
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'games' 
                  ? 'border-emerald-500 text-emerald-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('games')}
            >
              Games
            </button>
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
            <button
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'stack' 
                  ? 'border-emerald-500 text-emerald-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('stack')}
            >
              Stacks
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
          {/* Games - New section */}
          {activeTab === 'games' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Games</h2>
              {games.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {isOwnProfile 
                    ? "You haven't published any games yet." 
                    : `${profileData.username} hasn't published any games yet.`}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {games.map((game) => (
                    <ContentCard 
                      key={game.gameId} 
                      {...game}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
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
          {/* Stack Section */}
          {activeTab === 'stack' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Stack Activity</h2>
              {stackLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                  <span className="ml-2">Loading stack activity...</span>
                </div>
              ) : (
                <>
                  {questions.length === 0 && answers.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      {isOwnProfile 
                        ? "You haven't asked any questions or posted any answers yet." 
                        : `${profileData.username} hasn't asked any questions or posted any answers yet.`}
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {questions.length > 0 && (
                        <div>
                          <h3 className="text-lg font-medium mb-3">Questions</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {questions.slice(0, 4).map((question) => (
                              <ProfileStackCard 
                                key={question._id} 
                                item={question} 
                                type="question" 
                              />
                            ))}
                          </div>
                          {questions.length > 4 && (
                            <div className="mt-2 text-right">
                              <Link href={`/stack?userId=${profileData.userId}`} className="text-emerald-600 hover:underline">
                                View all {questions.length} questions
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {answers.length > 0 && (
                        <div>
                          <h3 className="text-lg font-medium mb-3">Answers</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {answers.slice(0, 4).map((answer) => (
                              <ProfileStackCard 
                                key={answer._id} 
                                item={answer} 
                                type="answer" 
                              />
                            ))}
                          </div>
                          {answers.length > 4 && (
                            <div className="mt-2 text-right">
                              <Link href={`/stack?userId=${profileData.userId}`} className="text-emerald-600 hover:underline">
                                View all {answers.length} answers
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}