"use client"

import Link from "next/link";
import { useState } from "react";

interface IRLInstruction {
  title: string;
  url: string; // Instead of inline content, a URL that shows the IRL instructions
}

interface Props {
  id: number;
  image: string;
  name: string;
  year: number;
  link: string;
  irlInstructions?: IRLInstruction[];
}

const ContentCard = ({ id, image, name, year, link, irlInstructions }: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Toggle dropdown for IRL instructions without propagating the click upward.
  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
  };

  // Open the IRL instruction in a new tab.
  const handleInstructionClick = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Open the instruction link in a new tab
    window.open(url, "_blank");
    // Optionally, you can close the menu after clicking:
    setIsMenuOpen(false);
  };

  return (
    <div className="content-card relative border rounded-lg shadow hover:shadow-lg" style={{ overflow: "visible" }}>
      {/* Only the image is wrapped in a link to open the game */}
      <Link href={link}>
        <div
          className="card-image h-48 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${image})` }}
        ></div>
      </Link>
      <div className="card-info p-4 flex items-center justify-between">
        <h3 className="font-bold text-lg">{name}</h3>
        {irlInstructions && irlInstructions.length > 0 && (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            {/* Black dot button */}
            <button
              onClick={toggleMenu}
              className="w-3 h-3 bg-black rounded-full focus:outline-none"
              title="View IRL Instructions"
            ></button>
            {/* Dropdown list, absolutely positioned so it’s not clipped */}
            {isMenuOpen && (
              <ul className="absolute right-0 mt-2 bg-white border border-gray-200 rounded shadow-lg z-50">
                {irlInstructions.map((instruction, index) => (
                  <li
                    key={index}
                    onClick={(e) => handleInstructionClick(instruction.url, e)}
                    className="cursor-pointer px-2 py-1 hover:bg-gray-200"
                  >
                    {instruction.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentCard;