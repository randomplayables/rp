'use client';

import { useState } from 'react';
import { Tab } from '@headlessui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '@/app/gamelab/components/CodeBlock';

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
};

const MarkdownEditor = ({
  value,
  onChange,
  placeholder = 'Write your content here using Markdown...',
  minHeight = '200px'
}: MarkdownEditorProps) => {
  const [selectedTab, setSelectedTab] = useState(0);
  
  return (
    <div className="border border-gray-300 rounded-md overflow-hidden">
      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        <Tab.List className="flex bg-gray-100 border-b border-gray-300">
          <Tab className={({ selected }) => 
            `py-2 px-4 text-sm font-medium focus:outline-none ${
              selected 
                ? 'border-b-2 border-emerald-500 text-emerald-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`
          }>
            Write
          </Tab>
          <Tab className={({ selected }) => 
            `py-2 px-4 text-sm font-medium focus:outline-none ${
              selected 
                ? 'border-b-2 border-emerald-500 text-emerald-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`
          }>
            Preview
          </Tab>
        </Tab.List>
        
        <Tab.Panels>
          {/* Write Panel */}
          <Tab.Panel>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full p-4 focus:outline-none resize-y"
              style={{ minHeight }}
            />
          </Tab.Panel>
          
          {/* Preview Panel */}
          <Tab.Panel>
            <div className="p-4 prose max-w-none" style={{ minHeight }}>
              {value ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code(props: any) {
                      const { node, inline, className, children, ...rest } = props;
                      const match = /language-(\w+)/.exec(className || '');
                      if (inline) {
                        return <code className={className} {...rest}>{children}</code>;
                      }
                      return match ? (
                        <CodeBlock
                          code={String(children).replace(/\n$/, '')}
                          language={match[1]}
                        />
                      ) : (
                        <code className={className} {...rest}>{children}</code>
                      );
                    }
                  }}
                >
                  {value}
                </ReactMarkdown>
              ) : (
                <p className="text-gray-400 italic">Nothing to preview</p>
              )}
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
      
      <div className="bg-gray-50 p-2 border-t border-gray-300">
        <p className="text-xs text-gray-500">
          Supports <strong>Markdown</strong> formatting. You can use bold, italic, lists, code blocks, etc.
        </p>
      </div>
    </div>
  );
};

export default MarkdownEditor;

