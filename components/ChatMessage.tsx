'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[80%]">
          <div className="text-sm whitespace-pre-wrap">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="bg-gray-700 text-white rounded-lg px-4 py-2 max-w-[85%]">
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');
                const inline = !match;
                
                if (!inline && match) {
                  return (
                    <div className="relative group">
                      <div className="flex items-center justify-between bg-gray-800 px-3 py-1 rounded-t text-xs">
                        <span className="text-gray-400">{match[1]}</span>
                        <button
                          onClick={() => copyToClipboard(codeString)}
                          className="text-gray-400 hover:text-white transition-colors"
                          title="Copy code"
                        >
                          {copied ? '✓ Copied!' : '📋 Copy'}
                        </button>
                      </div>
                      <pre className="!mt-0 !rounded-t-none overflow-x-auto">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    </div>
                  );
                }
                
                return (
                  <code className="bg-gray-800 px-1 py-0.5 rounded text-sm" {...props}>
                    {children}
                  </code>
                );
              },
              p({ children }) {
                return <p className="mb-2 last:mb-0">{children}</p>;
              },
              ul({ children }) {
                return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
              },
              ol({ children }) {
                return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
              },
              li({ children }) {
                return <li className="text-sm">{children}</li>;
              },
              h1({ children }) {
                return <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h1>;
              },
              h2({ children }) {
                return <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>;
              },
              h3({ children }) {
                return <h3 className="text-base font-bold mb-1 mt-2 first:mt-0">{children}</h3>;
              },
              blockquote({ children }) {
                return (
                  <blockquote className="border-l-4 border-gray-600 pl-3 italic my-2">
                    {children}
                  </blockquote>
                );
              },
              a({ href, children }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
