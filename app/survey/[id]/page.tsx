"use client"

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Spinner } from '@/components/spinner';
import { useMutation } from '@tanstack/react-query';

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

export default function SurveyResponsePage() {
  // Use the useParams hook instead of direct parameter access
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [gameSessionIds, setGameSessionIds] = useState<Record<string, string>>({});
  const [submissionComplete, setSubmissionComplete] = useState(false);
  
  // Fetch the survey data
  useEffect(() => {
    async function fetchSurvey() {
      try {
        const response = await fetch(`/api/collect/survey/${id}`);
        if (!response.ok) {
          throw new Error('Survey not found');
        }
        
        const data = await response.json();
        setSurvey(data.survey);
        
        // Initialize responses object
        const initialResponses: Record<string, any> = {};
        data.survey.questions.forEach((q: SurveyQuestion) => {
          if (q.type === 'multiple-choice') {
            initialResponses[q.questionId] = '';
          } else if (q.type === 'scale') {
            initialResponses[q.questionId] = null;
          } else if (q.type === 'text') {
            initialResponses[q.questionId] = '';
          } else if (q.type === 'game') {
            initialResponses[q.questionId] = null;
          }
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
  
  // Handle game completion
  const handleGameComplete = (questionId: string, gameSessionId: string, gameData: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: gameData
    }));
    
    setGameSessionIds(prev => ({
      ...prev,
      [questionId]: gameSessionId
    }));
    
    setCurrentGameId(null);
  };
  
  // Submit survey response
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
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const unansweredRequired = survey?.questions.filter(q => {
      if (!q.required) return false;
      
      const response = responses[q.questionId];
      if (response === null || response === undefined || response === '') return true;
      
      return false;
    });
    
    if (unansweredRequired && unansweredRequired.length > 0) {
      setError(`Please answer all required questions (${unansweredRequired.length} remaining)`);
      return;
    }
    
    submitResponseMutation.mutate();
  };
  
  if (isLoading) {
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
  
  if (currentGameId) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="bg-emerald-500 text-white p-4">
          <button 
            onClick={() => setCurrentGameId(null)}
            className="px-3 py-1 bg-emerald-600 rounded-md"
          >
            ← Back to Survey
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <iframe 
            src={`${process.env.NEXT_PUBLIC_BASE_URL}/games/${currentGameId}?surveyMode=true`}
            className="w-full h-full border-none"
            title="Game"
          />
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-2">{survey?.title}</h1>
        <p className="text-gray-600 mb-6">{survey?.description}</p>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          {survey?.questions.map((question, idx) => (
            <div key={question.questionId} className="mb-6 p-4 bg-gray-50 rounded-lg">
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
                <div className="bg-emerald-50 p-4 rounded-md border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-emerald-700">
                        Game Integration
                      </p>
                      <p className="text-sm text-emerald-600">
                        {gameSessionIds[question.questionId] 
                          ? '✓ Game completed' 
                          : 'Play the game to answer this question'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentGameId(question.gameId || null)}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600"
                    >
                      {gameSessionIds[question.questionId] ? 'Play Again' : 'Play Game'}
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