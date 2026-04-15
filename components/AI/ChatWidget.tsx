'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { Bot, X, Send, Loader2, ChevronDown, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  userName: string
  userRole: string
}

export default function ChatWidget({ userName, userRole }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && messages.length === 0) {
      // Messaggio di benvenuto
      setMessages([{
        role: 'assistant',
        content: `Ciao ${userName.split(' ')[0]}! 👋 Sono **RIDA**, il tuo assistente per il gestionale RIDENTIUM.\n\nPosso aiutarti a:\n• Consultare le scorte del magazzino\n• Creare e gestire task\n• Verificare riordini e fornitori\n• ${['admin', 'manager'].includes(userRole) ? 'Creare ordini e riordini' : 'Richiedere riordini'}`,
      }])
    }
  }, [open, userName, userRole, messages.length])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)
    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setLoading(true)

    try {
      // Invia solo i messaggi reali (non il benvenuto)
      const apiMessages = newMessages
        .filter(m => !(m.role === 'assistant' && m.content.includes('Sono **RIDA**')))
        .map(m => ({ role: m.role, content: m.content }))

      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, sessionId }),
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error ?? 'Errore sconosciuto')
      }

      const data = await resp.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.risposta }])
      if (data.sessionId) setSessionId(data.sessionId)
    } catch (err: any) {
      setError(err.message ?? 'Errore di connessione')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Errore: ${err.message ?? 'Impossibile contattare il server'}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Bottone flottante */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200"
        style={{ background: open ? '#1A1714' : '#C9A84C', border: '1px solid rgba(201,168,76,0.4)' }}
        title="RIDA — Assistente AI"
      >
        {open
          ? <ChevronDown size={20} className="text-cream" />
          : <Sparkles size={20} className="text-obsidian" />
        }
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-40 flex flex-col rounded-xl shadow-2xl overflow-hidden"
          style={{
            width: 'min(400px, calc(100vw - 32px))',
            height: 'min(560px, calc(100vh - 120px))',
            background: '#141210',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-obsidian-light/30"
               style={{ background: '#1A1714' }}>
            <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center flex-shrink-0">
              <Bot size={15} className="text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cream">RIDA</p>
              <p className="text-xs text-stone/70">Assistente RIDENTIUM</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 text-stone hover:text-cream transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed"
                  style={msg.role === 'user'
                    ? { background: '#C9A84C', color: '#0D0D0B' }
                    : { background: '#1A1714', color: '#E8DCC8', border: '1px solid rgba(255,255,255,0.06)' }
                  }
                >
                  <FormattedMessage content={msg.content} />
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl text-sm" style={{ background: '#1A1714', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 text-stone">
                    <Loader2 size={13} className="animate-spin" />
                    <span className="text-xs">RIDA sta elaborando…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-obsidian-light/20" style={{ background: '#141210' }}>
            <div className="flex items-end gap-2 rounded-lg p-2" style={{ background: '#1A1714', border: '1px solid rgba(255,255,255,0.08)' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Scrivi un messaggio…"
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent text-cream text-sm resize-none outline-none placeholder-stone/50 max-h-28"
                style={{ lineHeight: '1.4' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                style={{ background: input.trim() && !loading ? '#C9A84C' : 'transparent' }}
              >
                <Send size={14} className={input.trim() && !loading ? 'text-obsidian' : 'text-stone'} />
              </button>
            </div>
            <p className="text-xs text-stone/40 mt-1.5 text-center">
              Invio con Enter · Shift+Enter per andare a capo
            </p>
          </div>
        </div>
      )}
    </>
  )
}

// Componente per formattare il testo markdown semplice
function FormattedMessage({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*|\n)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        if (part === '\n') return <br key={i} />
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}
