'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

type ExtraQuery = Record<string, string> | undefined;

interface PaginationProps {
  // Preferred props (current API)
  currentPage?: number;
  totalPages?: number;

  // Legacy/alternate props (to keep existing calls type-safe)
  total?: number;   // total item count
  page?: number;    // current page index (1-based)
  limit?: number;   // page size
  pages?: number;   // total pages
  basePath?: string; // optional base path override (unused—router handles path)
  extraQuery?: ExtraQuery; // optional extra query (unused—searchParams covers this)
}

const Pagination = (props: PaginationProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Normalize inputs so both signatures are supported
  const normalizedCurrentPage =
    props.currentPage ??
    props.page ??
    1;

  const normalizedTotalPages =
    props.totalPages ??
    props.pages ??
    // Fallback compute from total+limit if provided; otherwise 1
    (props.total != null && props.limit ? Math.max(1, Math.ceil(props.total / props.limit)) : 1);

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    return `${pathname}?${params.toString()}`;
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > normalizedTotalPages) return;
    router.push(createPageUrl(page));
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: Array<number | '.'> = [];
    const maxPagesToShow = 7; // Show at most 7 page numbers

    if (normalizedTotalPages <= maxPagesToShow) {
      for (let i = 1; i <= normalizedTotalPages; i++) pages.push(i);
    } else {
      pages.push(1);

      const leftSide = Math.floor(maxPagesToShow / 2);
      const rightSide = maxPagesToShow - leftSide - 1;

      let startPage = Math.max(2, normalizedCurrentPage - leftSide);
      let endPage = Math.min(normalizedTotalPages - 1, normalizedCurrentPage + rightSide);

      if (startPage <= 2) endPage = Math.min(normalizedTotalPages - 1, maxPagesToShow - 1);
      if (endPage >= normalizedTotalPages - 1) startPage = Math.max(2, normalizedTotalPages - maxPagesToShow + 1);

      if (startPage > 2) pages.push('.');
      for (let i = startPage; i <= endPage; i++) pages.push(i);
      if (endPage < normalizedTotalPages - 1) pages.push('.');
      if (!pages.includes(normalizedTotalPages)) pages.push(normalizedTotalPages);
    }

    return pages;
  };

  if (normalizedTotalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center space-x-1 mt-4">
      <button
        onClick={() => goToPage(normalizedCurrentPage - 1)}
        disabled={normalizedCurrentPage === 1}
        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>

      <div className="flex space-x-1">
        {getPageNumbers().map((page, index) =>
          page === '.' ? (
            <span key={`ellipsis-${index}`} className="px-3 py-1">
              ...
            </span>
          ) : (
            <button
              key={`page-${page}`}
              onClick={() => goToPage(page as number)}
              className={`px-3 py-1 rounded ${
                normalizedCurrentPage === page
                  ? 'bg-emerald-500 text-white'
                  : 'border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          ),
        )}
      </div>

      <button
        onClick={() => goToPage(normalizedCurrentPage + 1)}
        disabled={normalizedCurrentPage === normalizedTotalPages}
        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;