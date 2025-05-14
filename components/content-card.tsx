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
  codeUrl?: string;  // New prop for GitHub repo
  authorUsername?: string;  // New prop for author's username
}

const ContentCard = ({ id, image, name, year, link, irlInstructions, codeUrl, authorUsername }: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();

  // Prepare the game link with authentication token
  const getGameLink = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default link behavior
    
    // Get the user ID and username from the user object if available
    const userId = user?.id;
    const username = user?.username;
    console.log("Opening game link with auth. User ID:", userId, "Username:", username);
    
    // If user is logged in, get a token
    if (isSignedIn && userId) {
      try {
        // Get a token from Clerk
        const token = await getToken();
        console.log("Generated auth token:", token ? "Token received" : "No token generated");
        
        // Add the token, userId, and username as query parameters
        const separator = link.includes('?') ? '&' : '?';
        const authLink = `${link}${separator}authToken=${token}&userId=${userId}${username ? `&username=${encodeURIComponent(username)}` : ''}`;
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

  // New handler for code repository
  const handleCodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (codeUrl) {
      window.open(codeUrl, "_blank");
    }
  };

  // New handler for author profile
  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (authorUsername) {
      window.open(`/profile/${authorUsername}`, "_blank");
    }
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
          <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
            {/* Black dot for IRL instructions */}
            {irlInstructions && irlInstructions.length > 0 && (
              <div className="relative">
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
            
            {/* Red dot for code repository */}
            {codeUrl && (
              <div className="relative">
                <button
                  onClick={handleCodeClick}
                  className="w-3 h-3 bg-red-600 rounded-full focus:outline-none"
                  title="View Source Code"
                ></button>
              </div>
            )}
            
            {/* Green dot for author profile */}
            {authorUsername && (
              <div className="relative">
                <button
                  onClick={handleAuthorClick}
                  className="w-3 h-3 bg-green-600 rounded-full focus:outline-none"
                  title="View Author Profile"
                ></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentCard;