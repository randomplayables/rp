import ContentCard from "../components/content-card";
import { connectToDatabase } from "@/lib/mongodb";
import Game from "@/models/Game";
import { IGame } from "@/types/Game";

export default async function HomePage() {
  await connectToDatabase();

  const data = await Game
    .find({}, { _id: 0, __v: 0 })
    .lean<IGame[]>();

  return (
    <div className="px-4 py-8 sm:py-12 lg:py-16 max-w-7xl mx-auto">
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {data.map((item) => (
            <ContentCard {...item} key={item.gameId} />
          ))}
        </div>
      </section>
    </div>
  );
}