"use client"

import { useEffect, useRef } from 'react';

interface CodeBlockProps {
  code: string;
  language: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const codeRef = useRef<HTMLPreElement>(null);

  // Apply syntax highlighting when the component mounts or code changes
  useEffect(() => {
    // In a real implementation, you might want to use a syntax highlighting library
    // like Prism.js or highlight.js here
  }, [code, language]);

  // Function to copy code to clipboard
  const copyToClipboard = () => {
    if (!navigator.clipboard) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        alert('Code copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy code: ', err);
      }
      
      document.body.removeChild(textArea);
      return;
    }
    
    navigator.clipboard.writeText(code)
      .then(() => {
        alert('Code copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy code: ', err);
      });
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="flex justify-between items-center bg-gray-800 px-4 py-2 rounded-t-lg">
        <span className="text-white text-sm font-mono">{language}</span>
        <button
          onClick={copyToClipboard}
          className="text-white bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
        >
          Copy Code
        </button>
      </div>
      <pre
        ref={codeRef}
        className="bg-gray-900 text-gray-300 p-4 rounded-b-lg overflow-x-auto flex-1"
      >
        <code className={`language-${language} text-sm`}>{code}</code>
      </pre>
    </div>
  );
}