"use client"

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { IGame } from '@/types/Game';

interface QuestionEditorProps {
  questionId: string;
  initialData: {
    type: string;
    text: string;
    options?: string[];
    gameId?: string;
    required: boolean;
  };
  onUpdate: (questionId: string, data: any) => void;
  onDelete: (questionId: string) => void;
  index: number;
}

async function fetchGames() {
  const response = await fetch('/api/games');
  const data = await response.json();
  return data;
}

export default function QuestionEditor({
  questionId,
  initialData,
  onUpdate,
  onDelete,
  index
}: QuestionEditorProps) {
  const [questionData, setQuestionData] = useState(initialData);
  const [newOption, setNewOption] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch available games
  const { data: games } = useQuery<IGame[]>({
    queryKey: ['availableGames'],
    queryFn: fetchGames
  });
  
  // Create a debounced version of onUpdate
  // This prevents too many updates when user is typing quickly
  const debouncedUpdate = debounce((data) => {
    onUpdate(questionId, data);
  }, 300);

  // Update local state and trigger debounced update to parent
  const updateQuestionData = (newData: any) => {
    setQuestionData(newData);
    debouncedUpdate(newData);
  };

  const handleTypeChange = (type: string) => {
    // Reset options when type changes
    const newData = {
      ...questionData,
      type,
    };
    
    // Initialize options if switching to multiple choice
    if (type === 'multiple-choice' && (!questionData.options || questionData.options.length === 0)) {
      newData.options = ['Option 1'];
    }
    
    updateQuestionData(newData);
  };

  const handleAddOption = () => {
    if (!newOption.trim()) {
      setError('Option cannot be empty');
      return;
    }
    
    const newData = {
      ...questionData,
      options: [...(questionData.options || []), newOption.trim()]
    };
    
    updateQuestionData(newData);
    setNewOption('');
    setError(null);
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = [...(questionData.options || [])];
    newOptions.splice(index, 1);
    
    updateQuestionData({
      ...questionData,
      options: newOptions
    });
  };

  const handleGameChange = (gameId: string) => {
    updateQuestionData({
      ...questionData,
      gameId
    });
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-lg">Question {index + 1}</h3>
        
        <div className="flex space-x-2">
          <select
            value={questionData.type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
          >
            <option value="text">Text Answer</option>
            <option value="multiple-choice">Multiple Choice</option>
            <option value="scale">Scale (1-5)</option>
            <option value="game">Game Integration</option>
          </select>
          
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={questionData.required}
              onChange={(e) => updateQuestionData({
                ...questionData,
                required: e.target.checked
              })}
              className="mr-1"
            />
            Required
          </label>
        </div>
      </div>
      
      {/* Question Text */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Question Text
        </label>
        <input
          type="text"
          value={questionData.text}
          onChange={(e) => updateQuestionData({
            ...questionData,
            text: e.target.value
          })}
          placeholder="Enter your question"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      
      {/* Multiple Choice Options */}
      {questionData.type === 'multiple-choice' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Answer Options
          </label>
          
          <ul className="mb-3 space-y-2">
            {questionData.options?.map((option, idx) => (
              <li key={idx} className="flex items-center">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...(questionData.options || [])];
                    newOptions[idx] = e.target.value;
                    updateQuestionData({
                      ...questionData,
                      options: newOptions
                    });
                  }}
                  className="flex-1 px-3 py-1 border border-gray-300 rounded-md mr-2"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveOption(idx)}
                  className="text-red-500 hover:text-red-700"
                  aria-label="Remove option"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          
          <div className="flex">
            <input
              type="text"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              placeholder="Add new option"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddOption}
              className="px-3 py-2 bg-emerald-500 text-white rounded-r-md hover:bg-emerald-600"
            >
              Add
            </button>
          </div>
          
          {error && (
            <p className="text-red-500 text-sm mt-1">{error}</p>
          )}
        </div>
      )}
      
      {/* Scale Options */}
      {questionData.type === 'scale' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scale Options
          </label>
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="flex justify-between items-center">
              <div className="text-center">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-800 mb-1">1</div>
                <span className="text-xs">Strongly Disagree</span>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-800 mb-1">2</div>
                <span className="text-xs">Disagree</span>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-800 mb-1">3</div>
                <span className="text-xs">Neutral</span>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-800 mb-1">4</div>
                <span className="text-xs">Agree</span>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-800 mb-1">5</div>
                <span className="text-xs">Strongly Agree</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Respondents will rate on a scale from 1 to 5
          </p>
        </div>
      )}
      
      {/* Game Selection */}
      {questionData.type === 'game' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Game
          </label>
          <select
            value={questionData.gameId || ''}
            onChange={(e) => handleGameChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">-- Select a game --</option>
            {games?.map((game) => (
              <option key={game.gameId} value={game.gameId}>
                {game.name}
              </option>
            ))}
          </select>
          
          {questionData.gameId && (
            <div className="mt-2 p-3 bg-emerald-50 rounded-md border border-emerald-100">
              <h4 className="font-medium text-emerald-700 mb-1">
                Game Integration Info
              </h4>
              <p className="text-sm text-gray-600">
                The selected game will be embedded in your survey. Participants will play the game
                and their gameplay data will be recorded as part of their survey response.
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Delete Button */}
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={() => onDelete(questionId)}
          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Delete Question
        </button>
      </div>
    </div>
  );
}