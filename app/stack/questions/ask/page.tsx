'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MarkdownEditor from '@/components/stack/MarkdownEditor';
import TagsInput from '@/components/stack/TagsInput';

export default function AskQuestionPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    body?: string;
    tags?: string;
  }>({});
  
  const validateForm = () => {
    const newErrors: any = {};
    
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.length < 15) {
      newErrors.title = 'Title must be at least 15 characters';
    }
    
    if (!body.trim()) {
      newErrors.body = 'Question details are required';
    } else if (body.length < 30) {
      newErrors.body = 'Question details must be at least 30 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/stack/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          tags,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.question?.id) {
        // Redirect to the new question
        router.push(`/stack/questions/${data.question.id}`);
      } else {
        setErrors({ ...errors, title: data.error || 'Failed to create question' });
      }
    } catch (error) {
      console.error('Error creating question:', error);
      setErrors({ ...errors, title: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Ask a Question</h1>
        <p className="text-gray-600 mt-2">
          Get help and share knowledge with the RandomPlayables community
        </p>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title input */}
          <div>
            <label htmlFor="title" className="block font-medium text-gray-700 mb-1">
              Title
            </label>
            <p className="text-sm text-gray-500 mb-2">
              Be specific and imagine you're asking a question to another person
            </p>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., How do I calculate the Manhattan distance in Gotham Loops?"
              className={`w-full px-4 py-2 border ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              } rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500`}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}
          </div>
          
          {/* Body input */}
          <div>
            <label htmlFor="body" className="block font-medium text-gray-700 mb-1">
              Question Details
            </label>
            <p className="text-sm text-gray-500 mb-2">
              Include all the information someone would need to answer your question
            </p>
            <MarkdownEditor
              value={body}
              onChange={setBody}
              placeholder="Enter the details of your question here..."
              minHeight="300px"
            />
            {errors.body && (
              <p className="mt-1 text-sm text-red-600">{errors.body}</p>
            )}
          </div>
          
          {/* Tags input */}
          <div>
            <label htmlFor="tags" className="block font-medium text-gray-700 mb-1">
              Tags
            </label>
            <p className="text-sm text-gray-500 mb-2">
              Add up to 5 tags to describe what your question is about
            </p>
            <TagsInput
              initialTags={tags}
              onChange={setTags}
              placeholder="e.g., javascript, react, mathematics"
              maxTags={5}
            />
            {errors.tags && (
              <p className="mt-1 text-sm text-red-600">{errors.tags}</p>
            )}
          </div>
          
          {/* Submit buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Link
              href="/stack"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Posting...' : 'Post Your Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}