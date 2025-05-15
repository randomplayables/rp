// components/stack/Pagination.tsx
'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

const Pagination = ({ currentPage, totalPages }: PaginationProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    return `${pathname}?${params.toString()}`;
  };
  
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    router.push(createPageUrl(page));
  };
  
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 7; // Show at most 7 page numbers
    
    if (totalPages <= maxPagesToShow) {
      // If total pages is less than max, show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always include first and last page
      pages.push(1);
      
      // Add pages around current page
      const leftSide = Math.floor(maxPagesToShow / 2);
      const rightSide = maxPagesToShow - leftSide - 1;
      
      // Determine start and end pages
      let startPage = Math.max(2, currentPage - leftSide);
      let endPage = Math.min(totalPages - 1, currentPage + rightSide);
      
      // Adjust if we're close to start or end
      if (startPage <= 2) {
        endPage = Math.min(totalPages - 1, maxPagesToShow - 1);
      }
      if (endPage >= totalPages - 1) {
        startPage = Math.max(2, totalPages - maxPagesToShow + 1);
      }
      
      // Add ellipsis at start if needed
      if (startPage > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Add ellipsis at end if needed
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      
      // Add last page if not already added
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };
  
  if (totalPages <= 1) return null;
  
  return (
    <div className="flex justify-center items-center space-x-1 mt-4">
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>
      
      <div className="flex space-x-1">
        {getPageNumbers().map((page, index) => (
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="px-3 py-1">...</span>
          ) : (
            <button
              key={`page-${page}`}
              onClick={() => goToPage(page as number)}
              className={`px-3 py-1 rounded ${
                currentPage === page
                  ? 'bg-emerald-500 text-white'
                  : 'border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          )
        ))}
      </div>
      
      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;