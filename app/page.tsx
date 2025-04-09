import Image from "next/image"
import Link from "next/link";
import data from "../data/data.json"
import ContentCard from "../components/content-card"

export default function HomePage() {
  return (
    <div className="px-4 py-8 sm:py-12 lg:py-16 max-w-7xl mx-auto">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-emerald-400 to-emerald-600 text-white rounded-lg mb-12 p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Random Playables</h1>
      </section>

      <section>
        <div  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {data.map((item) => {
            return<ContentCard {...item} key={item.id}/>
          })}
        </div>
      </section>
    </div>
  );
}