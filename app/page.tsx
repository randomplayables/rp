// import ContentCard from "../components/content-card";
// import { connectToDatabase } from "@/lib/mongodb";
// import Game from "@/models/Game";
// import { IGame } from "@/types/Game";

// export default async function HomePage() {
//   await connectToDatabase();

//   const data = await Game
//     .find({}, { _id: 0, __v: 0 })
//     .lean<IGame[]>();

//   const plainData = JSON.parse(JSON.stringify(data));

//   return (
//     <div className="px-4 py-8 sm:py-12 lg:py-16 max-w-7xl mx-auto">
//       <section>
//         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
//           {plainData.map((item: IGame) => (
//             <ContentCard {...item} key={item.gameId} />
//           ))}
//         </div>
//       </section>
//     </div>
//   );
// }



// "use client"

// import { useState, useEffect } from 'react';
// import ContentCard from "../components/content-card";
// import { IGame } from "@/types/Game";
// import { Spinner } from '@/components/spinner';

// export default function HomePage() {
//   const [allGames, setAllGames] = useState<IGame[]>([]);
//   const [filteredGames, setFilteredGames] = useState<IGame[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [searchQuery, setSearchQuery] = useState('');

//   // Fetch games on component mount
//   useEffect(() => {
//     const fetchGames = async () => {
//       setIsLoading(true);
//       try {
//         const response = await fetch('/api/games');
//         if (!response.ok) {
//           throw new Error('Failed to fetch games');
//         }
//         const data = await response.json();
//         setAllGames(data);
//         setFilteredGames(data);
//       } catch (error) {
//         console.error(error);
//       } finally {
//         setIsLoading(false);
//       }
//     };
//     fetchGames();
//   }, []);

//   // Filter games based on search query
//   useEffect(() => {
//     const query = searchQuery.toLowerCase().trim();
//     if (!query) {
//       setFilteredGames(allGames);
//       return;
//     }

//     const filtered = allGames.filter(game => {
//       const nameMatch = game.name.toLowerCase().includes(query);
//       const descriptionMatch = game.description?.toLowerCase().includes(query);
//       const tagsMatch = game.tags?.some(tag => tag.toLowerCase().includes(query));
//       return nameMatch || descriptionMatch || tagsMatch;
//     });

//     setFilteredGames(filtered);
//   }, [searchQuery, allGames]);

//   return (
//     <div className="px-4 py-8 sm:py-12 lg:py-16 max-w-7xl mx-auto">
//       {/* Search Bar */}
//       <div className="mb-12">
//         <input
//           type="text"
//           value={searchQuery}
//           onChange={(e) => setSearchQuery(e.target.value)}
//           placeholder="Search for games by name, tag, or description..."
//           className="w-full max-w-2xl mx-auto block px-4 py-3 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
//         />
//       </div>

//       <section>
//         {isLoading ? (
//           <div className="flex justify-center items-center py-20">
//             <Spinner className="h-10 w-10" />
//             <span className="ml-3 text-lg text-gray-600">Loading games...</span>
//           </div>
//         ) : filteredGames.length > 0 ? (
//           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
//             {filteredGames.map((item: IGame) => (
//               <ContentCard {...item} key={item.gameId} />
//             ))}
//           </div>
//         ) : (
//           <div className="text-center py-20">
//             <h2 className="text-2xl font-semibold text-gray-700">No games found</h2>
//             <p className="mt-2 text-gray-500">Try adjusting your search query or check back later!</p>
//           </div>
//         )}
//       </section>
//     </div>
//   );
// }



"use client"

import { useState, useEffect } from 'react';
import ContentCard from "../components/content-card";
import { IGame } from "@/types/Game";
import { Spinner } from '@/components/spinner';

export default function HomePage() {
  const [allGames, setAllGames] = useState<IGame[]>([]);
  const [filteredGames, setFilteredGames] = useState<IGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch games on component mount
  useEffect(() => {
    const fetchGames = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/games');
        if (!response.ok) {
          throw new Error('Failed to fetch games');
        }
        const data = await response.json();
        setAllGames(data);
        setFilteredGames(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGames();
  }, []);

  // Filter games based on search query
  useEffect(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      setFilteredGames(allGames);
      return;
    }

    const filtered = allGames.filter(game => {
      const nameMatch = game.name.toLowerCase().includes(query);
      const descriptionMatch = game.description?.toLowerCase().includes(query);
      const tagsMatch = game.tags?.some(tag => tag.toLowerCase().includes(query));
      return nameMatch || descriptionMatch || tagsMatch;
    });

    setFilteredGames(filtered);
  }, [searchQuery, allGames]);

  return (
    <div className="px-4 py-8 sm:py-12 lg:py-16 max-w-7xl mx-auto">
      {/* Search Bar */}
      <div className="mb-16">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for games by name, tag, or description..."
          className="w-full max-w-2xl mx-auto block px-4 py-3 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <section>
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Spinner className="h-10 w-10" />
            <span className="ml-3 text-lg text-gray-600">Loading games...</span>
          </div>
        ) : filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredGames.map((item: IGame) => (
              <ContentCard {...item} key={item.gameId} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold text-gray-700">No games found</h2>
            <p className="mt-2 text-gray-500">Try adjusting your search query or check back later!</p>
          </div>
        )}
      </section>
    </div>
  );
}