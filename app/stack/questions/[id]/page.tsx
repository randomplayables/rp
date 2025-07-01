'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { EyeIcon, ArrowUpTrayIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUser } from '@clerk/nextjs';
import { CodeBlock } from '@/app/gamelab/components/CodeBlock';
import VoteButtons from '@/components/stack/VoteButtons';
import AnswerItem from '@/components/stack/AnswerItem';
import MarkdownEditor from '@/components/stack/MarkdownEditor';

export default function QuestionPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const questionId = params.id as string;
  
  const [question, setQuestion] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [newAnswer, setNewAnswer] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Fetch question and answers data
  useEffect(() => {
    const fetchQuestionData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/stack/questions/${questionId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Question not found');
          } else {
            setError('Failed to load question');
          }
          return;
        }
        
        const data = await response.json();
        setQuestion(data.question);
        setAnswers(data.answers || []);
        
        // Initialize edit form with current values
        setEditTitle(data.question.title);
        setEditBody(data.question.body);
        setEditTags(data.question.tags || []);
      } catch (err) {
        console.error('Error fetching question:', err);
        setError('An error occurred while loading the question');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (questionId) {
      fetchQuestionData();
    }
  }, [questionId]);
  
  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newAnswer.trim()) {
      setAnswerError('Answer cannot be empty');
      return;
    }
    
    if (newAnswer.length < 30) {
      setAnswerError('Answer must be at least 30 characters');
      return;
    }
    
    setIsSubmittingAnswer(true);
    setAnswerError(null);
    
    try {
      const response = await fetch('/api/stack/answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId,
          body: newAnswer,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh the page to show the new answer
        window.location.reload();
      } else {
        setAnswerError(data.error || 'Failed to submit answer');
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
      setAnswerError('An error occurred while submitting your answer');
    } finally {
      setIsSubmittingAnswer(false);
    }
  };
  
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editTitle.trim() || !editBody.trim()) {
      return;
    }
    
    setIsSubmittingEdit(true);
    
    try {
      const response = await fetch(`/api/stack/questions/${questionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editTitle,
          body: editBody,
          tags: editTags,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update the UI with the edited question
        setQuestion({
          ...question,
          title: editTitle,
          body: editBody,
          tags: editTags,
          updatedAt: new Date().toISOString(),
        });
        setIsEditing(false);
      } else {
        console.error('Failed to update question:', data.error);
      }
    } catch (err) {
      console.error('Error updating question:', err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };
  
  const handleDeleteQuestion = async () => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/stack/questions/${questionId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Redirect to the questions list
        router.push('/stack');
      } else {
        console.error('Failed to delete question:', data.error);
      }
    } catch (err) {
      console.error('Error deleting question:', err);
    } finally {
      setIsDeleting(false);
    }
  };
  
  const handleAcceptAnswer = async (answerId: string) => {
    try {
      const response = await fetch('/api/stack/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId,
          answerId,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update UI to reflect accepted answer
        // If toggling off, data.accepted will be false
        const newAnswers = answers.map(answer => ({
          ...answer,
          isAccepted: answer._id === answerId ? data.accepted : false
        }));
        
        setAnswers(newAnswers);
        
        // Also update the question's acceptedAnswerId
        setQuestion({
          ...question,
          acceptedAnswerId: data.accepted ? answerId : null
        });
      } else {
        console.error('Failed to accept answer:', data.error);
      }
    } catch (err) {
      console.error('Error accepting answer:', err);
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        <p className="mt-4 text-gray-500">Loading question...</p>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error}</p>
          <Link href="/stack" className="mt-4 inline-block text-emerald-600 hover:underline">
            Back to all questions
          </Link>
        </div>
      </div>
    );
  }
  
  if (!question) {
    return null;
  }
  
  const isOwner = isLoaded && user?.id === question.userId;
  const wasEdited = new Date(question.updatedAt) > new Date(question.createdAt);
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Question Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-3xl font-bold w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          ) : (
            <h1 className="text-3xl font-bold text-gray-800">{question.title}</h1>
          )}
          
          <Link href="/stack" className="text-emerald-600 hover:underline mt-1">
            Back to all questions
          </Link>
        </div>
        
        <div className="flex items-center text-sm text-gray-500 mt-2">
          <div className="flex items-center mr-4">
            <EyeIcon className="h-4 w-4 mr-1" />
            {question.views} views
          </div>
          <div>
            Asked {formatDistanceToNow(new Date(question.createdAt), { addSuffix: true })}
            {wasEdited && (
              <span className="ml-2 text-gray-400">
                (edited {formatDistanceToNow(new Date(question.updatedAt), { addSuffix: true })})
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Question and Answers */}
      <div className="bg-white rounded-lg shadow-sm mb-8">
        {/* Question Body */}
        <div className="p-6 border-b">
          <div className="flex gap-6">
            {/* Vote buttons */}
            <VoteButtons
              id={questionId}
              type="question"
              initialUpvotes={question.upvotes || []}
              initialDownvotes={question.downvotes || []}
              currentUserId={user?.id}
            />
            
            {/* Question content */}
            <div className="flex-1">
              {isEditing ? (
                <MarkdownEditor
                  value={editBody}
                  onChange={setEditBody}
                  placeholder="Edit your question..."
                  minHeight="200px"
                />
              ) : (
                <div className="prose max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return match ? (
                          <CodeBlock
                            code={String(children).replace(/\n$/, '')}
                            language={match[1]}
                          />
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {question.body}
                  </ReactMarkdown>
                </div>
              )}
              
              {/* Tags */}
              {isEditing ? (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={editTags.join(', ')}
                    onChange={(e) => setEditTags(e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
                    placeholder="e.g. javascript, react, mathematics"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 mt-6">
                  {question.tags && question.tags.map((tag: string) => (
                    <Link
                      key={tag}
                      href={`/stack?tag=${tag}`}
                      className="px-2.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-full"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              )}
              
              {/* User information and edit controls */}
              <div className="flex justify-between items-center mt-6">
                <div className="flex items-center text-sm">
                  <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-md">
                    <Link href={`/profile/${question.username}`} className="font-medium hover:underline">
                      {question.username}
                    </Link>
                  </div>
                </div>
                
                {isOwner && !isEditing && (
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center text-sm text-gray-500 hover:text-emerald-500"
                    >
                      <PencilSquareIcon className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    
                    <button
                      onClick={handleDeleteQuestion}
                      className="flex items-center text-sm text-gray-500 hover:text-red-500"
                      disabled={isDeleting}
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                  </div>
                )}
                
                {isEditing && (
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                      disabled={isSubmittingEdit}
                    >
                      Cancel
                    </button>
                    
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1 text-sm bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50"
                      disabled={isSubmittingEdit}
                    >
                      {isSubmittingEdit ? 'Saving...' : 'Save Edits'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Answers Section */}
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold mb-4">{answers.length} Answers</h2>
          
          {answers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No answers yet. Be the first to answer this question!</p>
            </div>
          ) : (
            <div>
              {answers.map((answer) => (
                <AnswerItem
                  key={answer._id}
                  id={answer._id}
                  questionId={questionId}
                  body={answer.body}
                  isAccepted={answer.isAccepted}
                  upvotes={answer.upvotes}
                  downvotes={answer.downvotes}
                  author={{
                    id: answer.userId,
                    username: answer.username
                  }}
                  createdAt={answer.createdAt}
                  updatedAt={answer.updatedAt}
                  currentUserId={user?.id}
                  isQuestionOwner={isOwner}
                  onAccept={handleAcceptAnswer}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Your Answer Form */}
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Your Answer</h2>
          
          {isLoaded && user ? (
            <form onSubmit={handleSubmitAnswer}>
              <MarkdownEditor
                value={newAnswer}
                onChange={setNewAnswer}
                placeholder="Write your answer here..."
                minHeight="200px"
              />
              
              {answerError && (
                <div className="mt-2 text-sm text-red-600">{answerError}</div>
              )}
              
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingAnswer}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50 flex items-center"
                >
                  {isSubmittingAnswer ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Posting...
                    </>
                  ) : (
                    <>
                      <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                      Post Your Answer
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <p className="text-gray-700 mb-4">You must be signed in to answer questions.</p>
              <Link
                href="/sign-up"
                className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 inline-block"
              >
                Sign Up / Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}