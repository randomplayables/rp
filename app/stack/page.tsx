'use client'

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import QuestionCard from '@/components/stack/QuestionCard';
import Pagination from '@/components/stack/Pagination';

export default function StackPage() {
  const searchParams = useSearchParams();
  const tag = searchParams.get('tag');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  
  const [questions, setQuestions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search || '');
  const [popularTags, setPopularTags] = useState([]);
  
  // Fetch questions based on filters
  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      
      try {
        // Build query params
        const params = new URLSearchParams();
        if (tag) params.set('tag', tag);
        if (search) params.set('search', search);
        params.set('page', page.toString());
        params.set('limit', '10');
        
        const response = await fetch(`/api/stack/questions?${params.toString()}`);
        const data = await response.json();
        
        setQuestions(data.questions || []);
        setPagination(data.pagination || { total: 0, page: 1, limit: 10, pages: 0 });
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchQuestions();
  }, [tag, search, page]);
  
  // Fetch popular tags
  useEffect(() => {
    const fetchPopularTags = async () => {
      try {
        // This would be a real API endpoint in the full implementation
        // For now, we'll just use some placeholder tags
        setPopularTags(['javascript', 'python', 'react', 'math', 'algorithm', 'data-science']);
      } catch (error) {
        console.error('Error fetching popular tags:', error);
      }
    };
    
    fetchPopularTags();
  }, []);
  
  const handleSearch = (e) => {
    e.preventDefault();
    
    // Build URL with search parameter
    const params = new URLSearchParams();
    if (searchInput) params.set('search', searchInput);
    if (tag) params.set('tag', tag);
    
    // Navigate to the new URL
    window.location.href = `/stack?${params.toString()}`;
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">RandomPlayables Stack</h1>
        <Link href="/stack/questions/ask" className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors">
          Ask Question
        </Link>
      </div>
      
      {/* Search and filter section */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search questions..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Search
          </button>
        </form>
        
        {/* Active filters */}
        {(tag || search) && (
          <div className="flex items-center gap-2 mb-4">
            <FunnelIcon className="h-5 w-5 text-gray-500" />
            <div className="text-sm text-gray-500">Active filters:</div>
            
            {tag && (
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-sm">
                Tag: {tag}
                <Link href={search ? `/stack?search=${search}` : '/stack'} className="ml-1">
                  ×
                </Link>
              </div>
            )}
            
            {search && (
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-sm">
                Search: {search}
                <Link href={tag ? `/stack?tag=${tag}` : '/stack'} className="ml-1">
                  ×
                </Link>
              </div>
            )}
            
            <Link href="/stack" className="text-sm text-emerald-600 hover:underline">
              Clear all
            </Link>
          </div>
        )}
      </div>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main content */}
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold">{tag ? `Questions tagged with [${tag}]` : 'All Questions'}</h2>
              <p className="text-gray-500">{pagination.total || 0} questions</p>
            </div>
            
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
                <p className="mt-2 text-gray-500">Loading questions...</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">No questions found. Be the first to ask a question!</p>
                <Link href="/stack/questions/ask" className="mt-4 inline-block px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors">
                  Ask Question
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {questions.map((question) => (
                  <div key={question._id} className="p-4">
                    <QuestionCard
                      id={question._id}
                      title={question.title}
                      body={question.body}
                      tags={question.tags}
                      upvotes={question.upvotes.length}
                      downvotes={question.downvotes.length}
                      answers={0} // This would come from the API in the full implementation
                      views={question.views}
                      author={question.username}
                      createdAt={question.createdAt}
                      hasAcceptedAnswer={!!question.acceptedAnswerId}
                    />
                  </div>
                ))}
              </div>
            )}
            
            {/* Pagination */}
            <div className="p-4 border-t">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
              />
            </div>
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="lg:w-80">
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h3 className="text-lg font-semibold mb-3">Popular Tags</h3>
            <div className="flex flex-wrap gap-2">
              {popularTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/stack?tag=${tag}`}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-full"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-emerald-800 mb-2">About Stack</h3>
            <p className="text-emerald-700 text-sm mb-3">
              RandomPlayables Stack is a community for game creators and mathematics enthusiasts to ask questions and share knowledge.
            </p>
            <ul className="text-sm text-emerald-700 list-disc pl-5 mb-3">
              <li>Ask questions about games on our platform</li>
              <li>Discuss mathematical concepts and implementations</li>
              <li>Share code snippets and solutions</li>
              <li>Help others by answering their questions</li>
            </ul>
            <Link
              href="/stack/questions/ask"
              className="block w-full text-center py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors"
            >
              Ask Your First Question
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}



