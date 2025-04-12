import Link from "next/link";

interface Props {
    "id": number,
    "image": string,
    "name": string,
    "year": number,
    "link": string
}

const ContentCard = ({ id, image, name, year, link }: Props) => {
    return (
      <Link href={link} target="_blank" rel="noopener noreferrer" className="block">
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
          <div 
            className="h-48 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${image})` }}
          ></div>
          <div className="p-4">
            <h3 className="font-bold text-lg mb-2">{name}</h3>
          </div>
        </div>
      </Link>
    );
  }

export default ContentCard