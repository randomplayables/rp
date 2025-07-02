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
import ReactMarkdown from 'react-markdown';

// Types
interface LinkItem {
    title: string;
    url: string;
}

interface ProfileData {
  username: string;
  imageUrl?: string | null;
  aboutMe?: string | null;
  links?: LinkItem[] | null;
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
  files: any;
  previewImage?: string;
  createdAt: string;
  isPublic: boolean;
  userId: string;
  sketchGameId?: string;
}

interface Instrument {
  _id:string;
  title: string;
  description: string;
  surveyId: string;
  questionCount: number;
  responseCount: number;
  shareableLink: string;
  createdAt: string;
}

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
  const { username: usernameFromParams } = useParams();
  // Ensure username is always a string for simplicity
  const username = Array.isArray(usernameFromParams) ? usernameFromParams[0] : usernameFromParams;

  const { user: currentUser, isLoaded: isUserLoaded } = useUser();
  
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stackLoading, setStackLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'visualizations' | 'sketches' | 'instruments' | 'games' | 'stack'>('visualizations');
  
  const isOwnProfile = isUserLoaded && currentUser?.username === username;
  
  useEffect(() => {
    // Add a guard clause to prevent fetching on Clerk's internal routes
    const reservedPaths = ['security'];
    if (username && reservedPaths.includes(username)) {
        setLoading(false);
        return;
    }

    async function fetchProfileAndContent() {
      if (!username) return;
      
      setLoading(true);
      
      try {
        const profileRes = await fetch(`/api/profile/details?username=${username}`);
        if (profileRes.ok) {
            const data = await profileRes.json();
            setProfileData(data.profile);
        } else {
            console.error('Failed to fetch profile data');
        }

        const paramValue = username;
        const [visRes, sketchRes, instRes, gamesRes] = await Promise.all([
          fetch(`/api/profile/visualizations?username=${paramValue}`),
          fetch(`/api/profile/sketches?username=${paramValue}`),
          fetch(`/api/profile/instruments?username=${paramValue}`),
          fetch(`/api/games?authorUsername=${paramValue}`)
        ]);
        
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
    
    if (username) {
        fetchProfileAndContent();
    }
  }, [username]);
  
  useEffect(() => {
    if (activeTab === 'stack' && profileData) {
      fetchStackData(profileData.username);
    }
  }, [activeTab, profileData]);

  const fetchStackData = async (profileUsername: string) => {
    setStackLoading(true);
    try {
      const questionsRes = await fetch(`/api/stack/questions?username=${profileUsername}`);
      const questionsData = await questionsRes.json();
      setQuestions(questionsData.questions || []);
      
      const answersRes = await fetch(`/api/stack/answers?username=${profileUsername}`);
      const answersData = await answersRes.json();
      setAnswers(answersData.answers || []);
    } catch (error) {
      console.error('Error fetching stack data:', error);
    } finally {
      setStackLoading(false);
    }
  };
  
  // --- Simplified and Corrected Render Logic ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
        <span className="ml-2">Loading profile...</span>
      </div>
    );
  }

  if (!profileData) {
    // This now correctly handles both non-existent users and the "security" path case.
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Profile not found.</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-center">
          <div className="mr-0 sm:mr-6 mb-4 sm:mb-0 flex-shrink-0">
            {profileData.imageUrl ? (
              <img 
                src={profileData.imageUrl} 
                alt={profileData.username}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 text-3xl font-bold">
                {profileData.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold">{profileData.username}</h1>
            {profileData.aboutMe && (
                <div className="prose prose-sm mt-2 text-gray-600">
                    <ReactMarkdown>{profileData.aboutMe}</ReactMarkdown>
                </div>
            )}
            {profileData.links && profileData.links.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-4 justify-center sm:justify-start">
                    {profileData.links.map((link, index) => (
                        <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline">
                            {link.title}
                        </a>
                    ))}
                </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            <button
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${ activeTab === 'games' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('games')}
            >Games</button>
            <button
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${ activeTab === 'visualizations' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('visualizations')}
            >Visualizations</button>
            <button
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${ activeTab === 'sketches' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('sketches')}
            >Sketches</button>
            <button
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${ activeTab === 'instruments' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('instruments')}
            >Instruments</button>
            <button
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${ activeTab === 'stack' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('stack')}
            >Stacks</button>
          </nav>
        </div>
      </div>
      
        <>
          {activeTab === 'games' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Games</h2>
              {games.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{`${profileData.username} hasn't published any games yet.`}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {games.map((game) => ( <ContentCard key={game.gameId} {...game}/> ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'visualizations' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Visualizations</h2>
              {visualizations.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{`${profileData.username} hasn't shared any visualizations yet.`}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visualizations.map((viz) => ( <ProfileVisualizationCard key={viz._id} visualization={viz} isOwner={isOwnProfile} onDelete={() => setVisualizations(prev => prev.filter(v => v._id !== viz._id))} /> ))}
                </div>
              )}
            </div>
          )}    
          {activeTab === 'sketches' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Sketches</h2>
              {sketches.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{`${profileData.username} hasn't shared any game sketches yet.`}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sketches.map((sketch) => ( <ProfileSketchCard key={sketch._id} sketch={sketch} isOwner={isOwnProfile} onDelete={() => setSketches(prev => prev.filter(s => s._id !== sketch._id))} /> ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'instruments' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Instruments</h2>
              {instruments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{`${profileData.username} hasn't shared any survey instruments yet.`}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {instruments.map((instrument) => ( <ProfileInstrumentCard key={instrument._id} instrument={instrument} isOwner={isOwnProfile} onDelete={() => setInstruments(prev => prev.filter(i => i._id !== instrument._id))} /> ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'stack' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Stack Activity</h2>
              {stackLoading ? (
                <div className="flex justify-center py-12"><Spinner /><span className="ml-2">Loading stack activity...</span></div>
              ) : (
                <>
                  {questions.length === 0 && answers.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">{`${profileData.username} hasn't asked any questions or posted any answers yet.`}</p>
                  ) : (
                    <div className="space-y-6">
                      {questions.length > 0 && (
                        <div>
                          <h3 className="text-lg font-medium mb-3">Questions</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {questions.slice(0, 4).map((question) => ( <ProfileStackCard key={question._id} item={question} type="question" /> ))}
                          </div>
                          {questions.length > 4 && (<div className="mt-2 text-right"><Link href={`/stack?userId=${profileData.username}`} className="text-emerald-600 hover:underline">View all {questions.length} questions</Link></div>)}
                        </div>
                      )}
                      
                      {answers.length > 0 && (
                        <div>
                          <h3 className="text-lg font-medium mb-3">Answers</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {answers.slice(0, 4).map((answer) => ( <ProfileStackCard key={answer._id} item={answer} type="answer" />))}
                          </div>
                          {answers.length > 4 && (<div className="mt-2 text-right"><Link href={`/stack?userId=${profileData.username}`} className="text-emerald-600 hover:underline">View all {answers.length} answers</Link></div>)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
    </div>
  );
}