'use client';

import { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';

interface TagsInputProps {
  initialTags?: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

const TagsInput = ({
  initialTags = [],
  onChange,
  placeholder = 'Add tags...',
  maxTags = 5
}: TagsInputProps) => {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    onChange(tags);
  }, [tags, onChange]);
  
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (!trimmedTag) return;
    
    // Don't add duplicates or exceed max tags
    if (tags.includes(trimmedTag) || tags.length >= maxTags) return;
    
    setTags([...tags, trimmedTag]);
    setInput('');
  };
  
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      // Remove the last tag when backspace is pressed on empty input
      removeTag(tags[tags.length - 1]);
    }
  };
  
  const handleContainerClick = () => {
    // Focus the input when the container is clicked
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  
  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded-md min-h-[42px] focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500"
    >
      {tags.map(tag => (
        <div
          key={tag}
          className="flex items-center bg-emerald-100 text-emerald-800 px-2 py-1 text-sm rounded-md"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-1 text-emerald-600 hover:text-emerald-800"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
      
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input) addTag(input);
        }}
        placeholder={tags.length === 0 ? placeholder : tags.length >= maxTags ? 'Max tags reached' : 'Add more tags...'}
        className="flex-1 min-w-[120px] outline-none border-none p-1 bg-transparent"
        disabled={tags.length >= maxTags}
      />
      
      {tags.length > 0 && (
        <div className="w-full mt-1 text-xs text-gray-500">
          Press Enter or Comma to add tags
        </div>
      )}
    </div>
  );
};

export default TagsInput;