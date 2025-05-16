"use client"

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface StackItem {
  _id: string;
  title?: string; // For questions
  body: string;
  upvotes: string[];
  downvotes: string[];
  createdAt: string;
  isAccepted?: boolean; // For answers
  questionId?: string; // For answers
}

interface Props {
  item: StackItem;
  type: 'question' | 'answer';
}

export default function ProfileStackCard({ item, type }: Props) {
  const [expanded, setExpanded] = useState(false);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  };
  
  // Calculate vote count
  const voteCount = item.upvotes.length - item.downvotes.length;
  
  // Truncate the body for display
  const truncatedBody = item.body.length > 150 
    ? item.body.substring(0, 150) + '...' 
    : item.body;
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4">
        {type === 'question' && item.title && (
          <Link href={`/stack/questions/${item._id}`} className="font-bold text-lg text-emerald-600 hover:text-emerald-700 mb-1 block">
            {item.title}
          </Link>
        )}
        
        {type === 'answer' && item.questionId && (
          <Link href={`/stack/questions/${item.questionId}`} className="text-emerald-600 hover:text-emerald-700 text-sm mb-1 block">
            View question
          </Link>
        )}
        
        <p className="text-gray-600 text-sm mb-3">
          {expanded ? item.body : truncatedBody}
          {item.body.length > 150 && (
            <button 
              onClick={() => setExpanded(!expanded)} 
              className="text-emerald-600 hover:text-emerald-700 ml-1"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </p>
        
        <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
          <div className="flex items-center">
            <span className={`${voteCount > 0 ? 'text-emerald-600' : voteCount < 0 ? 'text-red-600' : ''} mr-2`}>
              {voteCount} votes
            </span>
            {item.isAccepted && (
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs">
                Accepted Answer
              </span>
            )}
          </div>
          
          <span>{formatDate(item.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}