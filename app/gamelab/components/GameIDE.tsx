"use client";

import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackFiles,
} from "@codesandbox/sandpack-react";

const defaultFiles: SandpackFiles = {
  "/index.html": {
    code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React Game</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
  },
  "/src/index.tsx": {
    code: `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
  },
  "/src/App.tsx": {
    code: `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  const handleButtonClick = () => {
    const newCount = count + 1;
    setCount(newCount);
    // Send data to the parent window (GameLabPage)
    if (window.parent) {
      window.parent.postMessage({
        type: 'GAMELAB_DATA',
        payload: { event: 'increment', newCount, timestamp: new Date().toISOString() }
      }, '*');
    }
  };

  return (
    <div className="App">
      <h1>Hello, GameLab IDE!</h1>
      <h2>This is a simple counter example.</h2>
      <p>Clicking the button also sends data to the GameLab page.</p>
      <button onClick={handleButtonClick}>
        Count is {count}
      </button>
    </div>
  );
}`,
    active: true,
  },
  "/src/styles.css": {
    code: `body {
  font-family: sans-serif;
  -webkit-font-smoothing: auto;
  -moz-font-smoothing: auto;
  -moz-osx-font-smoothing: grayscale;
  font-smoothing: auto;
  text-rendering: optimizeLegibility;
  font-smooth: always;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
}

.App {
  margin: 20px;
  text-align: center;
}

h1 {
  color: #10B981;
}

button {
  background-color: #10B981;
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 15px;
}
button:hover {
  background-color: #059669;
}
`,
  },
  "/package.json": {
    code: JSON.stringify({
      dependencies: {
        react: "^18.0.0",
        "react-dom": "^18.0.0",
        "react-scripts": "^5.0.0",
      },
    }),
    hidden: true,
  },
};

interface GameIDEProps {
    files?: SandpackFiles;
    [x: string]: any; // Allow other SandpackProvider props to be passed through
}

export default function GameIDE({ files = defaultFiles, ...props }: GameIDEProps) {
  return (
    <SandpackProvider 
        template="react-ts" 
        files={files}
        {...props}
        >
      <SandpackLayout className="w-full h-full border rounded-lg overflow-hidden">
        <SandpackCodeEditor showTabs closableTabs />
        <SandpackPreview />
      </SandpackLayout>
    </SandpackProvider>
  );
}