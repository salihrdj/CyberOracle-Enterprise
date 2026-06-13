'use client';

import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface SecureMarkdownProps {
  children: string;
  className?: string;
  allowedElements?: string[];
  allowedAttributes?: Record<string, string[]>;
}

const DEFAULT_ALLOWED_ELEMENTS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li',
  'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
];

const DEFAULT_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  '*': ['class', 'id'],
  a: ['href', 'target', 'rel', 'title'],
  code: ['class'],
  pre: ['class'],
  th: ['scope'],
  td: ['colspan', 'rowspan'],
};

export function SecureMarkdown({
  children,
  className = '',
  allowedElements = DEFAULT_ALLOWED_ELEMENTS,
  allowedAttributes = DEFAULT_ALLOWED_ATTRIBUTES,
}: SecureMarkdownProps) {
  return (
    <div className={`prose-report ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeSanitize, {
            allowedElements,
            allowedAttributes,
            allowedSchemes: ['http', 'https', 'mailto'],
            allowedSchemesByTag: {
              a: ['http', 'https', 'mailto'],
            },
          }],
        ]}
        components={{
          h1: ({ children }) => (
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mt-0 mb-4 pb-2 border-b border-border">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h4 className="text-xs font-bold text-accent-sky uppercase tracking-wider mt-5 mb-2">
              {children}
            </h4>
          ),
          h3: ({ children }) => (
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mt-4 mb-2">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-xs text-txt-dim leading-relaxed mb-3">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-1.5 mb-4 pl-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="space-y-1.5 mb-4 pl-0 list-decimal">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-2 text-xs text-txt-dim leading-relaxed">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-sky/60 shrink-0" />
              <span>{children}</span>
            </li>
          ),
          strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic text-txt">{children}</em>,
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded bg-bg/50 text-accent-sky text-xs font-mono">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-bg/50 rounded-xl p-4 overflow-x-auto mb-4 text-xs">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-accent-sky pl-4 italic text-txt-dim my-4">
              {children}
            </blockquote>
          ),
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-sky hover:text-accent-lavender underline-offset-2 hover:underline"
              {...props}
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border p-2 text-left bg-bg/50 font-bold text-txt">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-border p-2 text-left">{children}</td>
          ),
          hr: () => <hr className="border-border my-4" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}