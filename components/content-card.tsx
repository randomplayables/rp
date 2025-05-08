"use client"

import Link from "next/link";
import { useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs";

interface IRLInstruction {
  title: string;
  url: string;
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
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();

  // Prepare the game link with authentication token
  const getGameLink = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default link behavior
    
    // Get the user ID from the user object if available
    const userId = user?.id;
    console.log("Opening game link with auth. User ID:", userId);
    
    // If user is logged in, get a token
    if (isSignedIn && userId) {
      try {
        // Get a token from Clerk
        const token = await getToken();
        console.log("Generated auth token:", token ? "Token received" : "No token generated");
        
        // Add the token as a query parameter
        const separator = link.includes('?') ? '&' : '?';
        const authLink = `${link}${separator}authToken=${token}&userId=${userId}`;
        console.log("Opening authenticated game URL:", authLink);
        
        // Open the game in a new window
        window.open(authLink, '_blank');
      } catch (error) {
        console.error('Error getting auth token:', error);
        // Fallback to opening without auth
        console.log("Falling back to unauthenticated link due to error");
        window.open(link, '_blank');
      }
    } else {
      // If not logged in, just open the normal link
      console.log("User not logged in, opening unauthenticated link");
      window.open(link, '_blank');
    }
  };

  // Toggle dropdown for IRL instructions without propagating the click upward.
  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
  };

  // Open the IRL instruction in a new tab.
  const handleInstructionClick = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, "_blank");
    setIsMenuOpen(false);
  };

  return (
    <div className="content-card relative border rounded-lg shadow hover:shadow-lg" style={{ overflow: "visible" }}>
      {/* The entire card is now clickable to open the game with auth */}
      <div 
        className="cursor-pointer" 
        onClick={getGameLink}
      >
        <div
          className="card-image h-48 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${image})` }}
        ></div>
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
              {/* Dropdown list */}
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
    </div>
  );
};

export default ContentCard;