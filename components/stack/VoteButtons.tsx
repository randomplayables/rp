'use client';

import { useState } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';

type VoteButtonsProps = {
  id: string;
  type: 'question' | 'answer';
  initialUpvotes: string[];
  initialDownvotes: string[];
  currentUserId?: string;
};

const VoteButtons = ({
  id,
  type,
  initialUpvotes,
  initialDownvotes,
  currentUserId
}: VoteButtonsProps) => {
  const [upvotes, setUpvotes] = useState<string[]>(initialUpvotes);
  const [downvotes, setDownvotes] = useState<string[]>(initialDownvotes);
  const [isVoting, setIsVoting] = useState(false);
  
  const hasUpvoted = currentUserId ? upvotes.includes(currentUserId) : false;
  const hasDownvoted = currentUserId ? downvotes.includes(currentUserId) : false;
  const voteCount = upvotes.length - downvotes.length;
  
  const handleVote = async (voteType: 'up' | 'down') => {
    if (!currentUserId) {
      // Redirect to login or show login modal
      alert('Please sign in to vote');
      return;
    }
    
    if (isVoting) return;
    
    setIsVoting(true);
    
    try {
      const response = await fetch('/api/stack/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          type,
          voteType,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update local state to reflect server state
        // We could optimize this by calculating locally, but using server response is more accurate
        // in case of concurrent updates
        if (data.userVote === 'up') {
          setUpvotes([...upvotes, currentUserId].filter((id, index, self) => self.indexOf(id) === index));
          setDownvotes(downvotes.filter(id => id !== currentUserId));
        } else if (data.userVote === 'down') {
          setDownvotes([...downvotes, currentUserId].filter((id, index, self) => self.indexOf(id) === index));
          setUpvotes(upvotes.filter(id => id !== currentUserId));
        } else {
          // No vote (removed)
          setUpvotes(upvotes.filter(id => id !== currentUserId));
          setDownvotes(downvotes.filter(id => id !== currentUserId));
        }
      } else {
        console.error('Vote failed:', data.error);
      }
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setIsVoting(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => handleVote('up')}
        disabled={isVoting}
        className={`p-1 rounded ${
          hasUpvoted ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-gray-100'
        }`}
        aria-label="Upvote"
      >
        <ChevronUpIcon className="h-6 w-6" />
      </button>
      
      <div className={`text-center py-1 font-bold ${
        voteCount > 0 ? 'text-emerald-600' : 
        voteCount < 0 ? 'text-red-600' : 'text-gray-600'
      }`}>
        {voteCount}
      </div>
      
      <button
        onClick={() => handleVote('down')}
        disabled={isVoting}
        className={`p-1 rounded ${
          hasDownvoted ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100'
        }`}
        aria-label="Downvote"
      >
        <ChevronDownIcon className="h-6 w-6" />
      </button>
    </div>
  );
};

export default VoteButtons;
