'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { CodeBlock } from '@/app/gamelab/components/CodeBlock';
import VoteButtons from './VoteButtons';
import MarkdownEditor from './MarkdownEditor';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

type AnswerItemProps = {
  id: string;
  questionId: string;
  body: string;
  isAccepted: boolean;
  upvotes: string[];
  downvotes: string[];
  author: {
    id: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
  currentUserId?: string;
  isQuestionOwner: boolean;
  onAccept: (answerId: string) => void;
};

const AnswerItem = ({
  id,
  questionId,
  body,
  isAccepted,
  upvotes,
  downvotes,
  author,
  createdAt,
  updatedAt,
  currentUserId,
  isQuestionOwner,
  onAccept
}: AnswerItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(body);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const isOwner = currentUserId === author.id;
  const wasEdited = new Date(updatedAt) > new Date(createdAt);
  
  const handleSaveEdit = async () => {
    if (!editedBody.trim()) return;
    
    setIsSaving(true);
    
    try {
      const response = await fetch(`/api/stack/answers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: editedBody,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Ideally, update the answer in parent state instead of reloading
        window.location.reload();
      } else {
        console.error('Failed to update answer:', data.error);
      }
    } catch (error) {
      console.error('Error updating answer:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this answer?')) return;
    
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/stack/answers/${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Ideally, update the answers list in parent state instead of reloading
        window.location.reload();
      } else {
        console.error('Failed to delete answer:', data.error);
      }
    } catch (error) {
      console.error('Error deleting answer:', error);
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <div className={`border-t ${isAccepted ? 'bg-emerald-50' : ''} py-4`}>
      <div className="flex gap-4">
        {/* Vote buttons */}
        <VoteButtons
          id={id}
          type="answer"
          initialUpvotes={upvotes}
          initialDownvotes={downvotes}
          currentUserId={currentUserId}
        />
        
        {/* Content */}
        <div className="flex-1">
          {isEditing ? (
            <div>
              <MarkdownEditor 
                value={editedBody} 
                onChange={setEditedBody} 
                placeholder="Edit your answer..."
              />
              
              <div className="flex justify-end mt-4 space-x-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1 text-sm bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Edits'}
                </button>
              </div>
            </div>
          ) : (
            <div className="prose max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (inline) {
                      return <code className={className} {...props}>{children}</code>;
                    }
                    return match ? (
                      <CodeBlock
                        code={String(children).replace(/\n$/, '')}
                        language={match[1]}
                      />
                    ) : (
                      <code className={className} {...props}>{children}</code>
                    );
                  }
                }}
              >
                {body}
              </ReactMarkdown>
            </div>
          )}
          
          {/* Answer metadata */}
          <div className="flex justify-between items-center mt-4 text-sm">
            <div className="flex items-center space-x-2">
              {isQuestionOwner && (
                <button
                  onClick={() => onAccept(id)}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-md ${
                    isAccepted 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircleIcon className={`h-5 w-5 ${isAccepted ? 'text-emerald-500' : 'text-gray-400'}`} />
                  <span>{isAccepted ? 'Accepted' : 'Accept Answer'}</span>
                </button>
              )}
              
              {isAccepted && !isQuestionOwner && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                  <span>Accepted Answer</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center">
              {isOwner && !isEditing && (
                <div className="flex space-x-2 mr-4">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-gray-500 hover:text-emerald-500"
                    title="Edit answer"
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                  
                  <button
                    onClick={handleDelete}
                    className="text-gray-500 hover:text-red-500"
                    title="Delete answer"
                    disabled={isDeleting}
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              )}
              
              <div className="text-gray-500">
                answered {formatDistanceToNow(new Date(createdAt), { addSuffix: true })} by{' '}
                <Link href={`/profile/${author.username}`} className="text-emerald-600 hover:underline">
                  {author.username}
                </Link>
                {wasEdited && (
                  <span className="ml-2 text-xs text-gray-400">
                    (edited {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnswerItem;