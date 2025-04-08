

interface Props {
    "id": number,
    "image": string,
    "name": string,
    "year": number
}

const ContentCard = ({ id, image, name, year }: Props) => {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
        <div 
          className="h-48 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${image})` }}
        ></div>
        <div className="p-4">
          <h3 className="font-bold text-lg mb-2">{name}</h3>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Year: {year}</span>
            <span>ID: {id}</span>
          </div>
        </div>
      </div>
    );
  }

export default ContentCard