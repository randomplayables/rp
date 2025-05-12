import React from 'react';

interface SurveyQuestion {
  questionId: string;
  type: string;
  text: string;
  options?: string[];
  gameId?: string;
  required: boolean;
}

interface SurveyPreviewProps {
  survey: {
    title: string;
    description: string;
    questions: SurveyQuestion[];
  };
}

export default function SurveyPreview({ survey }: SurveyPreviewProps) {
  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
      <h1 className="text-2xl font-bold mb-2">{survey.title || 'Untitled Survey'}</h1>
      <p className="text-gray-600 mb-6">{survey.description || 'No description provided.'}</p>
      
      {survey.questions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No questions added yet. Click "Edit Survey" to add questions.
        </div>
      ) : (
        <div className="space-y-6">
          {survey.questions.map((question, idx) => (
            <div key={question.questionId} className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium mb-2">
                {idx + 1}. {question.text}
                {question.required && <span className="text-red-500 ml-1">*</span>}
              </p>
              
              {question.type === 'text' && (
                <textarea
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Your answer"
                  disabled
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
                        disabled
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
                        disabled
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
                        Game Integration: {question.gameId}
                      </p>
                      <p className="text-sm text-emerald-600">
                        Play the game to answer this question
                      </p>
                    </div>
                    <button className="px-4 py-2 bg-emerald-500 text-white rounded-md opacity-50 cursor-not-allowed">
                      Play Game
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          <div className="flex justify-end pt-4">
            <button className="px-6 py-2 bg-emerald-500 text-white rounded-md opacity-50 cursor-not-allowed">
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}