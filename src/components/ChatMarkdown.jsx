import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const elements = ['p', 'br', 'strong', 'em', 'del', 'a', 'ul', 'ol', 'li', 'blockquote', 'hr', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td']
const components = {
  a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
  table: ({ children }) => <div className="chat-table-scroll" role="region" aria-label="Answer table" tabIndex={0}><table>{children}</table></div>,
}

export default function ChatMarkdown({ children }) {
  return <div className="chat-markdown"><Markdown remarkPlugins={[remarkGfm]} allowedElements={elements} skipHtml components={components}>{children}</Markdown></div>
}
