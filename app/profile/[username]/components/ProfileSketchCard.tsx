// "use client"

// import { useState } from 'react';

// interface Sketch {
//   _id: string;
//   title: string;
//   description: string;
//   code: string;
//   language: string;
//   previewImage?: string;
//   createdAt: string;
// }

// interface Props {
//   sketch: Sketch;
//   isOwner: boolean;
//   onDelete: () => void;
// }

// export default function ProfileSketchCard({ sketch, isOwner, onDelete }: Props) {
//   const [isFullscreenMode, setIsFullscreenMode] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);
  
//   const formatDate = (dateString: string) => {
//     const date = new Date(dateString);
//     return date.toLocaleDateString();
//   };
  
//   const handleDelete = async () => {
//     if (!confirm('Are you sure you want to delete this sketch?')) return;
    
//     setIsDeleting(true);
//     try {
//       const response = await fetch(`/api/profile/sketches?id=${sketch._id}`, {
//         method: 'DELETE',
//       });
      
//       if (response.ok) {
//         onDelete();
//       } else {
//         console.error('Failed to delete sketch');
//       }
//     } catch (error) {
//       console.error('Error deleting sketch:', error);
//     } finally {
//       setIsDeleting(false);
//     }
//   };
  
//   // Create an HTML preview from the sketch code
//   const createGameHTML = (code: string, language: string) => {
//     // Similar to the technique used in GameSandbox.tsx
//     if (language === 'html' || code.includes('<!DOCTYPE html>') || code.includes('<html')) {
//       return code;
//     }
    
//     // Wrap in HTML if it's just JavaScript
//     return `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="UTF-8">
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <title>Game Preview</title>
//   <style>
//     body, html { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
//     #game-container { width: 100%; height: 100%; }
//   </style>
// </head>
// <body>
//   <div id="game-container"></div>
//   <script>
//     ${code}
//   </script>
// </body>
// </html>
//     `;
//   };

//   // Function to open the preview in a new tab
//   const openInNewTab = () => {
//     const gameHTML = createGameHTML(sketch.code, sketch.language);
//     const newWindow = window.open('', '_blank');
//     if (newWindow) {
//       newWindow.document.open();
//       newWindow.document.write(gameHTML);
//       newWindow.document.title = sketch.title;
//       newWindow.document.close();
//     }
//   };
  
//   return (
//     <div className="bg-white rounded-lg shadow-md overflow-hidden">
//       {/* Content */}
//       <div className="p-4">
//         <h3 className="font-bold text-lg mb-1">{sketch.title}</h3>
        
//         {sketch.description && (
//           <p className="text-gray-600 text-sm mb-3 line-clamp-2">{sketch.description}</p>
//         )}
        
//         <div className="flex justify-between items-center text-sm text-gray-500">
//           <span>Created: {formatDate(sketch.createdAt)}</span>
          
//           <div className="flex space-x-2">
//             <button
//               onClick={() => setIsFullscreenMode(true)}
//               className="text-emerald-600 hover:text-emerald-700"
//             >
//               Preview
//             </button>
            
//             {isOwner && (
//               <button
//                 onClick={handleDelete}
//                 disabled={isDeleting}
//                 className="text-red-600 hover:text-red-700"
//               >
//                 {isDeleting ? 'Deleting...' : 'Delete'}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Fullscreen Modal */}
//       {isFullscreenMode && (
//         <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 max-w-6xl flex flex-col">
//             <div className="p-4 border-b flex justify-between items-center">
//               <h3 className="text-xl font-bold">{sketch.title}</h3>
//               <button 
//                 onClick={() => setIsFullscreenMode(false)}
//                 className="text-gray-500 hover:text-gray-700"
//               >
//                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//                 </svg>
//               </button>
//             </div>
//             <div className="flex-1 overflow-hidden">
//               <iframe
//                 srcDoc={createGameHTML(sketch.code, sketch.language)}
//                 title="Game Preview"
//                 className="w-full h-full border-none"
//                 sandbox="allow-scripts"
//               />
//             </div>
//             <div className="p-4 border-t flex justify-end space-x-4">
//               <button 
//                 onClick={openInNewTab}
//                 className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
//               >
//                 Open in New Tab
//               </button>
//               <button 
//                 onClick={() => setIsFullscreenMode(false)}
//                 className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
//               >
//                 Close
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// "use client"

// import { useState } from 'react';
// import { SandpackFiles } from '@codesandbox/sandpack-react';

// // Updated interface to reflect the new data model
// interface Sketch {
//   _id: string;
//   title: string;
//   description: string;
//   files: SandpackFiles; // Changed from code/language
//   previewImage?: string;
//   createdAt: string;
// }

// interface Props {
//   sketch: Sketch;
//   isOwner: boolean;
//   onDelete: () => void;
// }

// export default function ProfileSketchCard({ sketch, isOwner, onDelete }: Props) {
//   const [isFullscreenMode, setIsFullscreenMode] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);
  
//   const formatDate = (dateString: string) => {
//     const date = new Date(dateString);
//     return date.toLocaleDateString();
//   };
  
//   const handleDelete = async () => {
//     if (!confirm('Are you sure you want to delete this sketch?')) return;
    
//     setIsDeleting(true);
//     try {
//       const response = await fetch(`/api/profile/sketches?id=${sketch._id}`, {
//         method: 'DELETE',
//       });
      
//       if (response.ok) {
//         onDelete();
//       } else {
//         console.error('Failed to delete sketch');
//       }
//     } catch (error) {
//       console.error('Error deleting sketch:', error);
//     } finally {
//       setIsDeleting(false);
//     }
//   };
  
//   // Updated function to create a preview from the 'files' object
//   const createGameHTML = (files: SandpackFiles): string => {
//     // Find the primary code file
//     let code = '';
//     let language = 'javascript'; // Default language

//     const htmlFile = files['/index.html'];
//     const appFile = files['/src/App.tsx'];

//     if (htmlFile && typeof htmlFile === 'object' && 'code' in htmlFile) {
//         // If there's a full index.html, use it directly
//         return htmlFile.code;
//     } else if (appFile && typeof appFile === 'object' && 'code' in appFile) {
//         // If there is a React App.tsx, it's a TSX sketch
//         // Note: This preview does not transpile TSX, so it will not render React components.
//         // It shows the raw code wrapped in a basic HTML shell to prevent crashing.
//         code = appFile.code;
//         language = 'tsx'; 
//     }
    
//     // Fallback for simple JS sketches
//     if (!code) {
//         const jsFile = Object.values(files).find(file => typeof file === 'object' && 'code' in file && file.code.includes('document.getElementById'));
//         if (jsFile && typeof jsFile === 'object' && 'code' in jsFile) {
//             code = jsFile.code;
//         }
//     }

//     if (!code) return '<p>Could not find a valid entry file to preview.</p>';

//     // Wrap JS in a basic HTML shell for preview
//     return `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="UTF-8">
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <title>Game Preview</title>
//   <style>
//     body, html { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; }
//     #game-container { width: 100%; height: 100%; }
//   </style>
// </head>
// <body>
//   <div id="game-container"></div>
//   <script>
//     // Note: Raw TSX/React code will not execute here. This is a basic preview.
//     // For a fully functional preview, transpilation would be required.
//     try {
//         ${language !== 'tsx' ? code : `document.body.innerText = "Cannot preview React/TSX component directly. Code is available in a new tab.";`}
//     } catch(e) {
//         document.body.innerText = "Error previewing script: " + e.message;
//     }
//   </script>
// </body>
// </html>
//     `;
//   };

//   // Function to open the preview in a new tab
//   const openInNewTab = () => {
//     const gameHTML = createGameHTML(sketch.files);
//     const newWindow = window.open('', '_blank');
//     if (newWindow) {
//       newWindow.document.open();
//       newWindow.document.write(gameHTML);
//       newWindow.document.title = sketch.title;
//       newWindow.document.close();
//     }
//   };
  
//   return (
//     <div className="bg-white rounded-lg shadow-md overflow-hidden">
//       {/* Content */}
//       <div className="p-4">
//         <h3 className="font-bold text-lg mb-1">{sketch.title}</h3>
        
//         {sketch.description && (
//           <p className="text-gray-600 text-sm mb-3 line-clamp-2">{sketch.description}</p>
//         )}
        
//         <div className="flex justify-between items-center text-sm text-gray-500">
//           <span>Created: {formatDate(sketch.createdAt)}</span>
          
//           <div className="flex space-x-2">
//             <button
//               onClick={() => setIsFullscreenMode(true)}
//               className="text-emerald-600 hover:text-emerald-700"
//             >
//               Preview
//             </button>
            
//             {isOwner && (
//               <button
//                 onClick={handleDelete}
//                 disabled={isDeleting}
//                 className="text-red-600 hover:text-red-700"
//               >
//                 {isDeleting ? 'Deleting...' : 'Delete'}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Fullscreen Modal */}
//       {isFullscreenMode && (
//         <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 max-w-6xl flex flex-col">
//             <div className="p-4 border-b flex justify-between items-center">
//               <h3 className="text-xl font-bold">{sketch.title}</h3>
//               <button 
//                 onClick={() => setIsFullscreenMode(false)}
//                 className="text-gray-500 hover:text-gray-700"
//               >
//                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//                 </svg>
//               </button>
//             </div>
//             <div className="flex-1 overflow-hidden">
//               <iframe
//                 srcDoc={createGameHTML(sketch.files)}
//                 title="Game Preview"
//                 className="w-full h-full border-none"
//                 sandbox="allow-scripts"
//               />
//             </div>
//             <div className="p-4 border-t flex justify-end space-x-4">
//               <button 
//                 onClick={openInNewTab}
//                 className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
//               >
//                 Open in New Tab
//               </button>
//               <button 
//                 onClick={() => setIsFullscreenMode(false)}
//                 className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
//               >
//                 Close
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// "use client"

// import { useState } from 'react';
// import { SandpackFiles } from '@codesandbox/sandpack-react';
// import { Spinner } from '@/components/spinner';

// // Updated interface to reflect the new data model
// interface Sketch {
//   _id: string;
//   title: string;
//   description: string;
//   files: SandpackFiles;
//   previewImage?: string;
//   createdAt: string;
//   isPublic: boolean; // isPublic is needed for the API check
//   userId: string;    // userId is needed for the API check
// }

// interface Props {
//   sketch: Sketch;
//   isOwner: boolean;
//   onDelete: () => void;
// }

// export default function ProfileSketchCard({ sketch, isOwner, onDelete }: Props) {
//   const [isFullscreenMode, setIsFullscreenMode] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);
//   const [isTranspiling, setIsTranspiling] = useState(false);
//   const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  
//   const formatDate = (dateString: string) => {
//     const date = new Date(dateString);
//     return date.toLocaleDateString();
//   };
  
//   const handleDelete = async () => {
//     if (!confirm('Are you sure you want to delete this sketch?')) return;
    
//     setIsDeleting(true);
//     try {
//       const response = await fetch(`/api/profile/sketches?id=${sketch._id}`, {
//         method: 'DELETE',
//       });
      
//       if (response.ok) {
//         onDelete();
//       } else {
//         console.error('Failed to delete sketch');
//       }
//     } catch (error) {
//       console.error('Error deleting sketch:', error);
//     } finally {
//       setIsDeleting(false);
//     }
//   };
  
//   const createReactPreviewHtml = (compiledJs: string) => {
//     return `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <title>${sketch.title}</title>
//   <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin="anonymous"><\/script>
//   <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin="anonymous"><\/script>
//   <style>body,html{margin:0;padding:0;overflow:hidden;width:100%;height:100%}#root{width:100%;height:100%}</style>
// </head>
// <body>
//   <div id="root"></div>
//   <script>
//     try {
//       ${compiledJs}
//       const App = window.App; // The compiled code should expose App on the window object
//       if (App && document.getElementById('root')) {
//         ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
//       } else {
//         throw new Error('Main "App" component not found after transpilation.');
//       }
//     } catch (err) {
//       console.error('Error rendering React component:', err);
//       document.getElementById('root').innerHTML = '<div style="color:red;padding:20px;">Render Error: ' + err.message + '</div>';
//     }
//   <\/script>
// </body>
// </html>`;
//   };

//   const handlePreview = async () => {
//     setIsFullscreenMode(true);
//     setIsTranspiling(true);
//     setPreviewHtml(null);

//     const appFile = sketch.files['/src/App.tsx'];
//     if (!appFile || typeof appFile !== 'object' || !('code' in appFile)) {
//         setPreviewHtml('<p>Preview not available: Main sketch file (/src/App.tsx) is missing.</p>');
//         setIsTranspiling(false);
//         return;
//     }

//     try {
//         const response = await fetch('/api/gamelab/transpile', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ 
//                 code: appFile.code,
//                 sketchId: sketch._id // Send sketchId for access check
//             })
//         });

//         if (!response.ok) {
//             const err = await response.json();
//             throw new Error(err.error || 'Failed to transpile code.');
//         }

//         const { compiledCode } = await response.json();
//         const html = createReactPreviewHtml(compiledCode);
//         setPreviewHtml(html);

//     } catch (error) {
//         const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
//         setPreviewHtml(`<div style="color:red;padding:20px;">${errorMessage}</div>`);
//         console.error('Preview error:', error);
//     } finally {
//         setIsTranspiling(false);
//     }
//   };
  
//   const openInNewTab = () => {
//     if (!previewHtml) return;
//     const newWindow = window.open('', '_blank');
//     if (newWindow) {
//       newWindow.document.open();
//       newWindow.document.write(previewHtml);
//       newWindow.document.title = sketch.title;
//       newWindow.document.close();
//     }
//   };
  
//   return (
//     <div className="bg-white rounded-lg shadow-md overflow-hidden">
//       {/* Content */}
//       <div className="p-4">
//         <h3 className="font-bold text-lg mb-1">{sketch.title}</h3>
        
//         {sketch.description && (
//           <p className="text-gray-600 text-sm mb-3 line-clamp-2">{sketch.description}</p>
//         )}
        
//         <div className="flex justify-between items-center text-sm text-gray-500">
//           <span>Created: {formatDate(sketch.createdAt)}</span>
          
//           <div className="flex space-x-2">
//             <button
//               onClick={handlePreview}
//               className="text-emerald-600 hover:text-emerald-700"
//             >
//               Preview
//             </button>
            
//             {isOwner && (
//               <button
//                 onClick={handleDelete}
//                 disabled={isDeleting}
//                 className="text-red-600 hover:text-red-700"
//               >
//                 {isDeleting ? 'Deleting...' : 'Delete'}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Fullscreen Modal */}
//       {isFullscreenMode && (
//         <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 max-w-6xl flex flex-col">
//             <div className="p-4 border-b flex justify-between items-center">
//               <h3 className="text-xl font-bold">{sketch.title}</h3>
//               <button 
//                 onClick={() => setIsFullscreenMode(false)}
//                 className="text-gray-500 hover:text-gray-700"
//               >
//                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//                 </svg>
//               </button>
//             </div>
//             <div className="flex-1 overflow-hidden bg-gray-100 flex items-center justify-center">
//               {isTranspiling ? (
//                   <Spinner className="w-10 h-10" />
//               ) : (
//                 <iframe
//                     srcDoc={previewHtml || ''}
//                     title="Game Preview"
//                     className="w-full h-full border-none bg-white"
//                     sandbox="allow-scripts"
//                 />
//               )}
//             </div>
//             <div className="p-4 border-t flex justify-end space-x-4">
//               <button 
//                 onClick={openInNewTab}
//                 className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50"
//                 disabled={!previewHtml || isTranspiling}
//               >
//                 Open in New Tab
//               </button>
//               <button 
//                 onClick={() => setIsFullscreenMode(false)}
//                 className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
//               >
//                 Close
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// "use client"

// import { useState } from 'react';
// import { SandpackFile, SandpackFiles } from '@codesandbox/sandpack-react';
// import { Spinner } from '@/components/spinner';

// interface Sketch {
//   _id: string;
//   title: string;
//   description: string;
//   files: SandpackFiles;
//   previewImage?: string;
//   createdAt: string;
//   isPublic: boolean;
//   userId: string;
// }

// interface Props {
//   sketch: Sketch;
//   isOwner: boolean;
//   onDelete: () => void;
// }

// export default function ProfileSketchCard({ sketch, isOwner, onDelete }: Props) {
//   const [isFullscreenMode, setIsFullscreenMode] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);
//   const [isTranspiling, setIsTranspiling] = useState(false);
//   const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  
//   const formatDate = (dateString: string) => {
//     const date = new Date(dateString);
//     return date.toLocaleDateString();
//   };
  
//   const handleDelete = async () => {
//     if (!confirm('Are you sure you want to delete this sketch?')) return;
    
//     setIsDeleting(true);
//     try {
//       const response = await fetch(`/api/profile/sketches?id=${sketch._id}`, {
//         method: 'DELETE',
//       });
      
//       if (response.ok) {
//         onDelete();
//       } else {
//         console.error('Failed to delete sketch');
//       }
//     } catch (error) {
//       console.error('Error deleting sketch:', error);
//     } finally {
//       setIsDeleting(false);
//     }
//   };
  
//   const createReactPreviewHtml = (compiledJs: string) => {
//     return `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <title>${sketch.title}</title>
//   <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin="anonymous"><\/script>
//   <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin="anonymous"><\/script>
//   <style>body,html{margin:0;padding:0;overflow:hidden;width:100%;height:100%}#root{width:100%;height:100%}</style>
// </head>
// <body>
//   <div id="root"></div>
//   <script>
//     try {
//       ${compiledJs}
//       const App = window.App; // The compiled code should expose App on the window object
//       if (App && document.getElementById('root')) {
//         ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
//       } else {
//         throw new Error('Main "App" component not found after transpilation.');
//       }
//     } catch (err) {
//       console.error('Error rendering React component:', err);
//       document.getElementById('root').innerHTML = '<div style="color:red;padding:20px;">Render Error: ' + err.message + '</div>';
//     }
//   <\/script>
// </body>
// </html>`;
//   };

//   const handlePreview = async () => {
//     setIsFullscreenMode(true);
//     setIsTranspiling(true);
//     setPreviewHtml(null);

//     const appFile = sketch.files['/src/App.tsx'];
//     let tsxCode = '';

//     // Correctly extract code whether it's a string or a SandpackFile object
//     if (appFile) {
//         if (typeof appFile === 'string') {
//             tsxCode = appFile;
//         } else if (typeof appFile === 'object' && 'code' in appFile) {
//             tsxCode = appFile.code;
//         }
//     }

//     if (!tsxCode) {
//         setPreviewHtml('<p>Preview not available: Main sketch file (/src/App.tsx) is missing.</p>');
//         setIsTranspiling(false);
//         return;
//     }

//     try {
//         const response = await fetch('/api/gamelab/transpile', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ 
//                 code: tsxCode,
//                 sketchId: sketch._id 
//             })
//         });

//         if (!response.ok) {
//             const err = await response.json();
//             throw new Error(err.error || 'Failed to transpile code.');
//         }

//         const { compiledCode } = await response.json();
//         const html = createReactPreviewHtml(compiledCode);
//         setPreviewHtml(html);

//     } catch (error) {
//         const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
//         setPreviewHtml(`<div style="color:red;padding:20px;">${errorMessage}</div>`);
//         console.error('Preview error:', error);
//     } finally {
//         setIsTranspiling(false);
//     }
//   };
  
//   const openInNewTab = () => {
//     if (!previewHtml) return;
//     const newWindow = window.open('', '_blank');
//     if (newWindow) {
//       newWindow.document.open();
//       newWindow.document.write(previewHtml);
//       newWindow.document.title = sketch.title;
//       newWindow.document.close();
//     }
//   };
  
//   return (
//     <div className="bg-white rounded-lg shadow-md overflow-hidden">
//       {/* Content */}
//       <div className="p-4">
//         <h3 className="font-bold text-lg mb-1">{sketch.title}</h3>
        
//         {sketch.description && (
//           <p className="text-gray-600 text-sm mb-3 line-clamp-2">{sketch.description}</p>
//         )}
        
//         <div className="flex justify-between items-center text-sm text-gray-500">
//           <span>Created: {formatDate(sketch.createdAt)}</span>
          
//           <div className="flex space-x-2">
//             <button
//               onClick={handlePreview}
//               className="text-emerald-600 hover:text-emerald-700"
//             >
//               Preview
//             </button>
            
//             {isOwner && (
//               <button
//                 onClick={handleDelete}
//                 disabled={isDeleting}
//                 className="text-red-600 hover:text-red-700"
//               >
//                 {isDeleting ? 'Deleting...' : 'Delete'}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Fullscreen Modal */}
//       {isFullscreenMode && (
//         <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 max-w-6xl flex flex-col">
//             <div className="p-4 border-b flex justify-between items-center">
//               <h3 className="text-xl font-bold">{sketch.title}</h3>
//               <button 
//                 onClick={() => setIsFullscreenMode(false)}
//                 className="text-gray-500 hover:text-gray-700"
//               >
//                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//                 </svg>
//               </button>
//             </div>
//             <div className="flex-1 overflow-hidden bg-gray-100 flex items-center justify-center">
//               {isTranspiling ? (
//                   <Spinner className="w-10 h-10" />
//               ) : (
//                 <iframe
//                     srcDoc={previewHtml || ''}
//                     title="Game Preview"
//                     className="w-full h-full border-none bg-white"
//                     sandbox="allow-scripts"
//                 />
//               )}
//             </div>
//             <div className="p-4 border-t flex justify-end space-x-4">
//               <button 
//                 onClick={openInNewTab}
//                 className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50"
//                 disabled={!previewHtml || isTranspiling}
//               >
//                 Open in New Tab
//               </button>
//               <button 
//                 onClick={() => setIsFullscreenMode(false)}
//                 className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
//               >
//                 Close
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

"use client"

import { useState } from 'react';
import {
  SandpackFiles,
  SandpackProvider,
  SandpackLayout,
  SandpackPreview
} from '@codesandbox/sandpack-react';

// The interface remains the same
interface Sketch {
  _id: string;
  title: string;
  description: string;
  files: SandpackFiles;
  previewImage?: string;
  createdAt: string;
  isPublic: boolean; 
  userId: string;    
}

interface Props {
  sketch: Sketch;
  isOwner: boolean;
  onDelete: () => void;
}

export default function ProfileSketchCard({ sketch, isOwner, onDelete }: Props) {
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this sketch?')) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/profile/sketches?id=${sketch._id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        onDelete();
      } else {
        console.error('Failed to delete sketch');
      }
    } catch (error) {
      console.error('Error deleting sketch:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Function to prepare files for the read-only preview
  const getReadOnlyFiles = (): SandpackFiles => {
    const readOnlyFiles: SandpackFiles = {};
    for (const path in sketch.files) {
        const file = sketch.files[path];
        const code = typeof file === 'string' ? file : file.code;
        readOnlyFiles[path] = {
            code,
            readOnly: true
        };
    }
    return readOnlyFiles;
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-lg mb-1">{sketch.title}</h3>
        
        {sketch.description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{sketch.description}</p>
        )}
        
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Created: {formatDate(sketch.createdAt)}</span>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setIsFullscreenMode(true)}
              className="text-emerald-600 hover:text-emerald-700"
            >
              Preview
            </button>
            
            {isOwner && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600 hover:text-red-700"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Modal with Sandpack */}
      {isFullscreenMode && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 max-w-6xl flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">{sketch.title}</h3>
              <button 
                onClick={() => setIsFullscreenMode(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 relative">
                <SandpackProvider
                    template="react-ts"
                    theme="light"
                    files={getReadOnlyFiles()} // Use the read-only files
                    // The invalid 'options' prop has been removed
                >
                    <SandpackLayout>
                        <SandpackPreview 
                            showNavigator={true}
                            showOpenInCodeSandbox={false}
                        />
                    </SandpackLayout>
                </SandpackProvider>
            </div>

            <div className="p-4 border-t flex justify-end space-x-4">
              <button 
                onClick={() => setIsFullscreenMode(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}