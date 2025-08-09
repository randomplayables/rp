'use client';

import { Suspense, useEffect, useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import QuestionCard from '@/components/stack/QuestionCard';
import Pagination from '@/components/stack/Pagination';

interface IQuestion {
  _id: string;
  title: string;
  body: string;
  tags: string[];
  upvotes: string[];
  downvotes: string[];
  views: number;
  username: string;
  createdAt: string;
  acceptedAnswerId?: string;
}

function StackPageInner() {
  const searchParams = useSearchParams();
  const tag = searchParams.get('tag');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [questions, setQuestions] = useState<IQuestion[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    pages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search || '');

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
        setPagination(
          data.pagination || { total: 0, page: 1, limit: 10, pages: 0 }
        );
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [tag, search, page]);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
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
        <h1 className="text-3xl font-bold text-gray-800">Random Playables Stack</h1>
        <Link
          href="/stack/questions/ask"
          className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors"
        >
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
              placeholder="Search questions."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Search
          </button>
          <div className="px-3 py-2 border border-gray-200 rounded-md flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              {tag ? `Tag: ${tag}` : 'All tags'}
            </span>
          </div>
        </form>
      </div>

      {/* Questions list */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-gray-500">Loading…</div>
        ) : questions.length === 0 ? (
          <div className="text-gray-600">No questions found.</div>
        ) : (
          questions.map((q) => (
            <QuestionCard
              key={q._id}
              id={q._id}
              title={q.title}
              body={q.body}
              tags={q.tags}
              upvotes={q.upvotes?.length || 0}
              downvotes={q.downvotes?.length || 0}
              answers={0}
              views={q.views || 0}
              author={q.username}
              createdAt={q.createdAt}
              hasAcceptedAnswer={Boolean(q.acceptedAnswerId)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="mt-8">
        <Pagination
          total={pagination.total}
          page={pagination.page}
          limit={pagination.limit}
          pages={pagination.pages}
          basePath="/stack"
          extraQuery={tag ? { tag } : search ? { search } : undefined}
        />
      </div>
    </div>
  );
}

export default function StackPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading…</div>}>
      <StackPageInner />
    </Suspense>
  );
}