// "use client"

// import Link from "next/link";
// import { useState } from "react";
// import { useUser, useAuth } from "@clerk/nextjs";

// interface IRLInstruction {
//   title: string;
//   url: string;
// }

// interface Props {
//   gameId: string;
//   image: string;
//   name: string;
//   year: number;
//   link: string;
//   irlInstructions?: IRLInstruction[];
//   codeUrl?: string;
//   authorUsername?: string;
//   description?: string;
//   aiUsageDetails?: {
//     modelType: string;
//     isPaid: boolean;
//   };
// }

// const ContentCard = ({ gameId, image, name, year, link, irlInstructions, codeUrl, authorUsername, description, aiUsageDetails }: Props) => {
//   const [isMenuOpen, setIsMenuOpen] = useState(false);
//   const [isDescriptionVisible, setIsDescriptionVisible] = useState(false); // New state for description
//   const { user, isSignedIn } = useUser();
//   const { getToken } = useAuth();

//   const getGameLink = async (e: React.MouseEvent) => {
//     e.preventDefault();
    
//     // AI Usage and Subscription Checks
//     if (aiUsageDetails) {
//       if (aiUsageDetails.isPaid) {
//         if (!isSignedIn) {
//           alert('This is a premium AI game and requires an active subscription. Please sign in to play.');
//           return;
//         }
//         try {
//           const subCheckResponse = await fetch(`/api/check-subscription?userId=${user.id}`);
//           const subData = await subCheckResponse.json();
//           if (!subData.subscriptionActive) {
//             alert('This game requires an active subscription to play.');
//             return;
//           }
//         } catch (error) {
//           console.error("Subscription check failed:", error);
//           alert('Could not verify your subscription status. Please try again later.');
//           return;
//         }
//       }
      
//       const confirmed = window.confirm('This game uses AI models and may consume your monthly API credits. Do you want to continue?');
//       if (!confirmed) {
//         return;
//       }
//     }

//     // Proceed with existing logic if checks pass
//     const userId = user?.id;
//     const username = user?.username;
//     console.log("Opening game link with auth. User ID:", userId, "Username:", username);
    
//     if (isSignedIn && userId) {
//       try {
//         const token = await getToken();
//         console.log("Generated auth token:", token ? "Token received" : "No token generated");
        
//         const separator = link.includes('?') ? '&' : '?';
//         const authLink = `${link}${separator}authToken=${token}&userId=${userId}${username ? `&username=${encodeURIComponent(username)}` : ''}`;
//         console.log("Opening authenticated game URL:", authLink);
        
//         window.open(authLink, '_blank');
//       } catch (error) {
//         console.error('Error getting auth token:', error);
//         console.log("Falling back to unauthenticated link due to error");
//         window.open(link, '_blank');
//       }
//     } else {
//       console.log("User not logged in, opening unauthenticated link");
//       window.open(link, '_blank');
//     }
//   };

//   const toggleMenu = (e: React.MouseEvent) => {
//     e.stopPropagation();
//     setIsMenuOpen((prev) => !prev);
//   };

//   const handleInstructionClick = (url: string, e: React.MouseEvent) => {
//     e.stopPropagation();
//     window.open(url, "_blank");
//     setIsMenuOpen(false);
//   };

//   const handleCodeClick = (e: React.MouseEvent) => {
//     e.stopPropagation();
//     if (codeUrl) {
//       window.open(codeUrl, "_blank");
//     }
//   };

//   const handleAuthorClick = (e: React.MouseEvent) => {
//     e.stopPropagation();
//     if (authorUsername) {
//       window.open(`/profile/${authorUsername}`, "_blank");
//     }
//   };
  
//   // New handler for the description dot
//   const toggleDescription = (e: React.MouseEvent) => {
//     e.stopPropagation();
//     setIsDescriptionVisible((prev) => !prev);
//   };

//   return (
//     // FIX 2: Removed overflow-hidden from this container
//     <div className="content-card relative border rounded-lg shadow hover:shadow-lg">
//       <div 
//         className="cursor-pointer" 
//         onClick={getGameLink}
//       >
//         {/* FIX 2: Added rounded-t-lg to the image div */}
//         <div
//           className="card-image h-48 w-full bg-cover bg-center rounded-t-lg"
//           style={{ backgroundImage: `url(${image})` }}
//         ></div>
//         <div className="card-info p-4 flex items-center justify-between">
//           <h3 className="font-bold text-lg">{name}</h3>
//           <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
//             {/* Gold dot for description */}
//             {description && (
//                 <div className="relative">
//                     <button
//                         onClick={toggleDescription}
//                         className="w-3 h-3 bg-amber-500 rounded-full focus:outline-none"
//                         title="View Description"
//                     ></button>
//                     {isDescriptionVisible && (
//                         <div className="absolute right-0 mt-2 w-64 p-3 bg-white border border-gray-200 rounded shadow-lg z-50">
//                             <p className="text-sm text-gray-700">{description}</p>
//                         </div>
//                     )}
//                 </div>
//             )}

//             {/* Black dot for IRL instructions */}
//             {/* FIX 1: Updated conditional check */}
//             {irlInstructions && irlInstructions.some(inst => inst.title && inst.url) && (
//               <div className="relative">
//                 <button
//                   onClick={toggleMenu}
//                   className="w-3 h-3 bg-black rounded-full focus:outline-none"
//                   title="View IRL Instructions"
//                 ></button>
//                 {isMenuOpen && (
//                   <ul className="absolute right-0 mt-2 bg-white border border-gray-200 rounded shadow-lg z-50">
//                     {irlInstructions.map((instruction, index) => (
//                       <li
//                         key={index}
//                         onClick={(e) => handleInstructionClick(instruction.url, e)}
//                         className="cursor-pointer px-2 py-1 hover:bg-gray-200"
//                       >
//                         {instruction.title}
//                       </li>
//                     ))}
//                   </ul>
//                 )}
//               </div>
//             )}
            
//             {/* Red dot for code repository */}
//             {codeUrl && (
//               <div className="relative">
//                 <button
//                   onClick={handleCodeClick}
//                   className="w-3 h-3 bg-red-600 rounded-full focus:outline-none"
//                   title="View Source Code"
//                 ></button>
//               </div>
//             )}
            
//             {/* Green dot for author profile */}
//             {authorUsername && (
//               <div className="relative">
//                 <button
//                   onClick={handleAuthorClick}
//                   className="w-3 h-3 bg-green-600 rounded-full focus:outline-none"
//                   title="View Author Profile"
//                 ></button>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ContentCard;




"use client"

import Link from "next/link";
import { useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs";

interface IRLInstruction {
  title: string;
  url: string;
}

interface Props {
  gameId: string;
  image: string;
  name: string;
  year: number;
  link: string;
  irlInstructions?: IRLInstruction[];
  codeUrl?: string;
  authorUsername?: string;
  description?: string;
  tags?: string[];
  aiUsageDetails?: {
    modelType: string;
    isPaid: boolean;
  };
}

const ContentCard = ({ gameId, image, name, year, link, irlInstructions, codeUrl, authorUsername, description, tags, aiUsageDetails }: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDescriptionVisible, setIsDescriptionVisible] = useState(false);
  const [isTagsVisible, setIsTagsVisible] = useState(false);
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();

  const getGameLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    // AI Usage and Subscription Checks
    if (aiUsageDetails) {
      if (aiUsageDetails.isPaid) {
        if (!isSignedIn) {
          alert('This is a premium AI game and requires an active subscription. Please sign in to play.');
          return;
        }
        try {
          const subCheckResponse = await fetch(`/api/check-subscription?userId=${user.id}`);
          const subData = await subCheckResponse.json();
          if (!subData.subscriptionActive) {
            alert('This game requires an active subscription to play.');
            return;
          }
        } catch (error) {
          console.error("Subscription check failed:", error);
          alert('Could not verify your subscription status. Please try again later.');
          return;
        }
      }
      
      const confirmed = window.confirm('This game uses AI models and may consume your monthly API credits. Do you want to continue?');
      if (!confirmed) {
        return;
      }
    }

    // Proceed with existing logic if checks pass
    const userId = user?.id;
    const username = user?.username;
    console.log("Opening game link with auth. User ID:", userId, "Username:", username);
    
    if (isSignedIn && userId) {
      try {
        const token = await getToken();
        console.log("Generated auth token:", token ? "Token received" : "No token generated");
        
        const separator = link.includes('?') ? '&' : '?';
        const authLink = `${link}${separator}authToken=${token}&userId=${userId}${username ? `&username=${encodeURIComponent(username)}` : ''}`;
        console.log("Opening authenticated game URL:", authLink);
        
        window.open(authLink, '_blank');
      } catch (error) {
        console.error('Error getting auth token:', error);
        console.log("Falling back to unauthenticated link due to error");
        window.open(link, '_blank');
      }
    } else {
      console.log("User not logged in, opening unauthenticated link");
      window.open(link, '_blank');
    }
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
    setIsDescriptionVisible(false); // Close other popovers
    setIsTagsVisible(false); // Close other popovers
  };

  const handleInstructionClick = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, "_blank");
    setIsMenuOpen(false);
  };

  const handleCodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (codeUrl) {
      window.open(codeUrl, "_blank");
    }
  };

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (authorUsername) {
      window.open(`/profile/${authorUsername}`, "_blank");
    }
  };
  
  const toggleDescription = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDescriptionVisible((prev) => !prev);
    setIsMenuOpen(false); // Close other popovers
    setIsTagsVisible(false); // Close other popovers
  };

  const toggleTags = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTagsVisible((prev) => !prev);
    setIsMenuOpen(false); // Close other popovers
    setIsDescriptionVisible(false); // Close other popovers
  };

  return (
    <div className="content-card relative border rounded-lg shadow hover:shadow-lg">
      <div 
        className="cursor-pointer" 
        onClick={getGameLink}
      >
        <div
          className="card-image h-48 w-full bg-cover bg-center rounded-t-lg"
          style={{ backgroundImage: `url(${image})` }}
        ></div>
        <div className="card-info p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg">{name}</h3>
          <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
            {/* White dot for tags */}
            {tags && tags.length > 0 && (
                <div className="relative">
                    <button
                        onClick={toggleTags}
                        className="w-3 h-3 bg-white border border-black rounded-full focus:outline-none"
                        title="View Tags"
                    ></button>
                    {isTagsVisible && (
                        <div className="absolute right-0 mt-2 w-48 p-3 bg-white border border-gray-200 rounded shadow-lg z-50">
                            <h4 className="text-sm font-semibold mb-2">Tags</h4>
                            <div className="flex flex-wrap gap-1">
                                {tags.map(tag => (
                                    <span key={tag} className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded-full">{tag}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {description && (
                <div className="relative">
                    <button
                        onClick={toggleDescription}
                        className="w-3 h-3 bg-amber-500 rounded-full focus:outline-none"
                        title="View Description"
                    ></button>
                    {isDescriptionVisible && (
                        <div className="absolute right-0 mt-2 w-64 p-3 bg-white border border-gray-200 rounded shadow-lg z-50">
                            <p className="text-sm text-gray-700">{description}</p>
                        </div>
                    )}
                </div>
            )}

            {irlInstructions && irlInstructions.some(inst => inst.title && inst.url) && (
              <div className="relative">
                <button
                  onClick={toggleMenu}
                  className="w-3 h-3 bg-black rounded-full focus:outline-none"
                  title="View IRL Instructions"
                ></button>
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
            
            {codeUrl && (
              <div className="relative">
                <button
                  onClick={handleCodeClick}
                  className="w-3 h-3 bg-red-600 rounded-full focus:outline-none"
                  title="View Source Code"
                ></button>
              </div>
            )}
            
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