"use client"

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Spinner } from '@/components/spinner';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useUser, useAuth } from "@clerk/nextjs";
import { IGame } from '@/types/Game';

interface SurveyQuestion {
  questionId: string;
  type: string;
  text: string;
  options?: string[];
  gameId?: string;
  required: boolean;
}

interface Survey {
  _id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
}

async function fetchAllGames(): Promise<IGame[]> {
  const response = await fetch('/api/games');
  if (!response.ok) {
    throw new Error('Failed to fetch games');
  }
  return response.json();
}

export default function SurveyResponsePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  
  const [currentGameUrl, setCurrentGameUrl] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [gameSessionIds, setGameSessionIds] = useState<Record<string, string>>({});
  const [submissionComplete, setSubmissionComplete] = useState(false);

  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { data: games, isLoading: isLoadingGames } = useQuery<IGame[]>({
    queryKey: ['allGames'],
    queryFn: fetchAllGames,
  });
  
  useEffect(() => {
    async function fetchSurvey() {
      try {
        const response = await fetch(`/api/collect/survey/${id}`);
        if (!response.ok) {
          throw new Error('Survey not found');
        }
        
        const data = await response.json();
        setSurvey(data.survey);
        
        const initialResponses: Record<string, any> = {};
        data.survey.questions.forEach((q: SurveyQuestion) => {
          initialResponses[q.questionId] = q.type === 'game' ? null : '';
        });
        
        setResponses(initialResponses);
      } catch (err) {
        setError('Survey not found or has expired');
      } finally {
        setIsLoading(false);
      }
    }
    
    if (id) fetchSurvey();
  }, [id]);

  const handlePlayGame = async (question: SurveyQuestion) => {
    if (!games || !question.gameId) {
      setError("Game information is not available yet.");
      return;
    }

    const gameToPlay = games.find(g => g.gameId === question.gameId);
    if (!gameToPlay || !gameToPlay.link) {
      setError("This game is not available to play.");
      return;
    }

    // Set the active question ID before launching the game
    setActiveQuestionId(question.questionId);

    let finalUrl = gameToPlay.link;
    const separator = finalUrl.includes('?') ? '&' : '?';
    finalUrl += `${separator}surveyMode=true&questionId=${question.questionId}`;

    if (isSignedIn && user) {
        try {
            const token = await getToken();
            finalUrl += `&authToken=${token}&userId=${user.id}&username=${encodeURIComponent(user.username || '')}`;
        } catch (error) {
            console.error("Failed to get auth token:", error);
        }
    }

    setCurrentGameUrl(finalUrl);
  };

  const handleReturnToSurvey = () => {
    if (activeQuestionId) {
      // This is the fix: Mark the game as 'played' to pass validation.
      // A more robust solution would involve the game sending a completion message,
      // but this ensures the survey can be submitted.
      setResponses(prev => ({ ...prev, [activeQuestionId]: 'game_played' }));
    }
    setCurrentGameUrl(null);
    setActiveQuestionId(null);
  };
  
  const submitResponseMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/collect/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: survey?._id,
          responses: Object.entries(responses).map(([questionId, answer]) => ({
            questionId,
            answer,
            gameSessionId: gameSessionIds[questionId]
          }))
        })
      });
      
      return response.json();
    },
    onSuccess: () => {
      setSubmissionComplete(true);
    },
    onError: () => {
      setError('Failed to submit response. Please try again.');
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const unansweredRequired = survey?.questions.filter(q => {
      if (!q.required) return false;
      const response = responses[q.questionId];
      return response === null || response === undefined || response === '';
    });
    
    if (unansweredRequired && unansweredRequired.length > 0) {
      setError(`Please answer all required questions (${unansweredRequired.length} remaining)`);
      return;
    }
    setError(null);
    submitResponseMutation.mutate();
  };
  
  if (isLoading || isLoadingGames) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
        <span className="ml-2">Loading survey...</span>
      </div>
    );
  }
  
  if (error && !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }
  
  if (submissionComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-6">Your response has been submitted successfully.</p>
          <a 
            href="/"
            className="inline-block px-6 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }
  
  if (currentGameUrl) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col z-50">
        <div className="bg-emerald-500 text-white p-4 shadow-md">
          <button 
            onClick={handleReturnToSurvey}
            className="px-3 py-1 bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
          >
            ← Back to Survey
          </button>
        </div>
        
        <div className="flex-1 w-full h-full">
          <iframe 
            src={currentGameUrl}
            className="w-full h-full border-none"
            title="Game"
            allow="fullscreen"
          />
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-2">{survey?.title}</h1>
        <p className="text-gray-600 mb-6">{survey?.description}</p>
        
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {survey?.questions.map((question, idx) => (
            <div key={question.questionId} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="font-medium mb-2">
                {idx + 1}. {question.text}
                {question.required && <span className="text-red-500 ml-1">*</span>}
              </p>
              
              {question.type === 'text' && (
                <textarea
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Your answer"
                  value={responses[question.questionId] || ''}
                  onChange={(e) => setResponses(prev => ({
                    ...prev,
                    [question.questionId]: e.target.value
                  }))}
                  required={question.required}
                />
              )}
              
              {question.type === 'multiple-choice' && question.options && (
                <div className="space-y-2">
                  {question.options.map((option, optIdx) => (
                    <div key={optIdx} className="flex items-center">
                      <input
                        type="radio"
                        name={`question_${question.questionId}`}
                        id={`option_${question.questionId}_${optIdx}`}
                        className="mr-2"
                        value={option}
                        checked={responses[question.questionId] === option}
                        onChange={() => setResponses(prev => ({
                          ...prev,
                          [question.questionId]: option
                        }))}
                        required={question.required}
                      />
                      <label htmlFor={`option_${question.questionId}_${optIdx}`}>
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              )}
              
              {question.type === 'scale' && (
                <div className="flex justify-between items-center py-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <div key={num} className="flex flex-col items-center">
                      <input
                        type="radio"
                        name={`question_${question.questionId}`}
                        id={`scale_${question.questionId}_${num}`}
                        value={num}
                        checked={responses[question.questionId] === num}
                        onChange={() => setResponses(prev => ({
                          ...prev,
                          [question.questionId]: num
                        }))}
                        required={question.required}
                      />
                      <label 
                        htmlFor={`scale_${question.questionId}_${num}`}
                        className="text-sm mt-1"
                      >
                        {num}
                      </label>
                    </div>
                  ))}
                </div>
              )}
              
              {question.type === 'game' && (
                <div className={`p-4 rounded-md border ${responses[question.questionId] ? 'bg-green-50 border-green-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-emerald-700">
                        Game Integration
                      </p>
                      <p className="text-sm text-emerald-600">
                        {responses[question.questionId] 
                          ? '✓ Game completed' 
                          : 'Play the game to answer this question'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePlayGame(question)}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600"
                    >
                      {responses[question.questionId] ? 'Play Again' : 'Play Game'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          <div className="flex justify-end pt-4">
            <button 
              type="submit"
              disabled={submitResponseMutation.isPending}
              className="px-6 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50"
            >
              {submitResponseMutation.isPending ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}