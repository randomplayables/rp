import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

type QuestionCardProps = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  answers: number;
  views: number;
  author: string;
  createdAt: string;
  hasAcceptedAnswer: boolean;
};

const QuestionCard = ({
  id,
  title,
  body,
  tags,
  upvotes,
  downvotes,
  answers,
  views,
  author,
  createdAt,
  hasAcceptedAnswer
}: QuestionCardProps) => {
  const voteCount = upvotes - downvotes;
  const createdTime = new Date(createdAt);
  
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Stats column */}
        <div className="flex flex-col items-center gap-2 min-w-[60px]">
          <div className="text-center">
            <div className="text-lg font-bold">{voteCount}</div>
            <div className="text-xs text-gray-500">votes</div>
          </div>
          
          <div className="text-center">
            <div className={`text-lg font-bold ${hasAcceptedAnswer ? 'text-emerald-500' : ''}`}>
              {answers}
            </div>
            <div className="text-xs text-gray-500">answers</div>
          </div>
          
          <div className="text-center">
            <div className="text-xs text-gray-500">{views} views</div>
          </div>
        </div>
        
        {/* Content column */}
        <div className="flex-1">
          <Link href={`/stack/questions/${id}`} className="block">
            <h3 className="text-lg font-semibold text-emerald-600 hover:text-emerald-700 mb-2">
              {title}
            </h3>
          </Link>
          
          <p className="text-gray-700 mb-3 line-clamp-2">{body}</p>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <Link 
                key={tag} 
                href={`/stack?tag=${tag}`} 
                className="px-2.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-full"
              >
                {tag}
              </Link>
            ))}
          </div>
          
          <div className="flex justify-end text-xs text-gray-500">
            <span>
              asked {formatDistanceToNow(createdTime, { addSuffix: true })} by{' '}
              <Link href={`/profile/${author}`} className="text-emerald-600 hover:underline">
                {author}
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionCard;