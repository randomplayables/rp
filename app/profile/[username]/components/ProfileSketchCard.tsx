"use client"

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  SandpackFiles,
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
  useSandpack,
  SandpackProviderProps,
} from '@codesandbox/sandpack-react';

interface Sketch {
  _id: string;
  title: string;
  description: string;
  files: SandpackFiles;
  previewImage?: string;
  createdAt: string;
  isPublic: boolean; 
  userId: string;
  sketchGameId?: string;
}

interface Props {
  sketch: Sketch;
  isOwner: boolean;
  onDelete: () => void;
}

const SketchPlayer = ({ sketch, showCode }: { sketch: Sketch, showCode: boolean }) => {
  const { sandpack } = useSandpack();
  const { updateFile } = sandpack;
  const { user, isSignedIn } = useUser();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const sessionEffectRan = useRef(false);

  useEffect(() => {
    // BUG FIX: Duplicate Session Creation
    // This effect now uses a ref to ensure it only runs once in Strict Mode.
    if (sessionEffectRan.current === true && process.env.NODE_ENV === 'development') {
        return;
    }

    const createSession = async () => {
      if (!sketch.sketchGameId) {
        setIsLoadingSession(false);
        return;
      }

      setIsLoadingSession(true);
      try {
        const response = await fetch('/api/sketch/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sketchGameId: sketch.sketchGameId,
            passedUserId: isSignedIn ? user.id : undefined,
            passedUsername: isSignedIn ? user.username : undefined,
          })
        });

        if (response.ok) {
          const data = await response.json();
          setSessionId(data.sessionId);
          console.log(`Created sketch session ${data.sessionId} for sketch game ${sketch.sketchGameId}`);
        } else {
          console.error("Failed to create sketch game session");
        }
      } catch (error) {
        console.error("Error creating sketch game session:", error);
      } finally {
        setIsLoadingSession(false);
      }
    };

    createSession();

    return () => {
        if(process.env.NODE_ENV === 'development') {
            sessionEffectRan.current = true;
        }
    }
  }, [sketch.sketchGameId, user, isSignedIn]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GAMELAB_DATA' && event.data.payload && sessionId) {
        const payloadFromGame = event.data.payload;
        
        // The parent listener augments the data with the session ID before sending
        const dataToSave = {
            sessionId: sessionId,
            roundData: payloadFromGame,
            roundNumber: payloadFromGame.roundNumber
        };

        fetch('/api/sketch/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave)
        }).then(response => {
          if (!response.ok) {
            console.error("Failed to save sketch game data");
          } else {
            console.log("Successfully saved sketch data for session:", sessionId)
          }
        }).catch(err => {
          console.error("Error saving sketch game data:", err);
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [sessionId]);

  if (isLoadingSession) {
    return <div className="flex items-center justify-center h-full"><p>Loading session...</p></div>;
  }

  if (showCode) {
    return (
      <SandpackLayout>
        <SandpackCodeEditor readOnly />
        <SandpackPreview showNavigator={true} showOpenInCodeSandbox={false} />
      </SandpackLayout>
    );
  }

  return (
    <SandpackLayout>
      <SandpackPreview showNavigator={true} showOpenInCodeSandbox={false} />
    </SandpackLayout>
  );
};


export default function ProfileSketchCard({ sketch, isOwner, onDelete }: Props) {
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCodeInModal, setShowCodeInModal] = useState(false);
  
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

  const getSandpackSetup = () => {
    const readOnlyFiles: SandpackFiles = {};
    for (const path in sketch.files) {
        const file = sketch.files[path];
        const code = typeof file === 'string' ? file : file.code;
        readOnlyFiles[path] = {
            code,
            readOnly: true,
            // hidden: path.includes('communication.js') // We'll handle injection manually
        };
    }

    const template: SandpackProviderProps['template'] = sketch.files && sketch.files['/src/App.tsx'] ? 'react-ts' : 'static';

    const communicationScript = `
        window.sendDataToGameLab = function(data) {
            console.log('Sketch (in Sandpack) sending data to platform:', data);
            window.parent.postMessage({ type: 'GAMELAB_DATA', payload: data }, '*');
        };
    `;

    if (template === 'react-ts') {
        readOnlyFiles['/src/communication.js'] = { code: communicationScript, hidden: true };
        const entryFilePath = '/src/index.tsx'; // Assuming this is the entry for React sketches
        if (readOnlyFiles[entryFilePath]) {
            const entryFile = readOnlyFiles[entryFilePath];
            if (typeof entryFile === 'object' && 'code' in entryFile) {
                // Prepend the import if it's not already there
                if (!entryFile.code.includes("import './communication.js'")) {
                    entryFile.code = `import './communication.js';\n${entryFile.code}`;
                }
            }
        }
    } else { // Static (Vanilla JS) template
        const indexPath = '/index.html';
        const indexHtmlFile = readOnlyFiles[indexPath];
        if (indexHtmlFile && typeof indexHtmlFile === 'object' && 'code' in indexHtmlFile) {
            let htmlCode = indexHtmlFile.code;
            // Inject the script into the head
            if (htmlCode.includes('</head>')) {
                htmlCode = htmlCode.replace('</head>', `<script>${communicationScript}<\/script></head>`);
            } else {
                htmlCode = `<head><script>${communicationScript}<\/script></head>` + htmlCode;
            }
            readOnlyFiles[indexPath] = { ...indexHtmlFile, code: htmlCode };
        }
    }
    
    return { files: readOnlyFiles, template };
  }

  const { files: sandpackFiles, template: sandpackTemplate } = getSandpackSetup();
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4">
        <h3 className="font-bold text-lg mb-1">{sketch.title}</h3>
        
        {sketch.description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{sketch.description}</p>
        )}
        
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Created: {formatDate(sketch.createdAt)}</span>
          
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setShowCodeInModal(false);
                setIsFullscreenMode(true);
              }}
              className="text-emerald-600 hover:text-emerald-700"
              disabled={!sketch.sketchGameId}
              title={sketch.sketchGameId ? "Preview Sketch" : "Sketch cannot be played (missing game link)"}
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

      {isFullscreenMode && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-11/12 max-h-[90vh] max-w-6xl flex flex-col">
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
                    template={sandpackTemplate}
                    theme="light"
                    files={sandpackFiles}
                >
                    <SketchPlayer sketch={sketch} showCode={showCodeInModal} />
                </SandpackProvider>
            </div>

            <div className="p-4 border-t flex justify-between items-center">
              <button 
                onClick={() => setShowCodeInModal(!showCodeInModal)}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                {showCodeInModal ? 'Hide Code' : 'Show Code'}
              </button>
              <button 
                onClick={() => setIsFullscreenMode(false)}
                className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
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