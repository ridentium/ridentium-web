'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Mic, MicOff, Volume2, VolumeX, ChevronDown } from 'lucide-react'

// ── Tipi ──────────────────────────────────────────────────────────────────────

type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  userName: string
  userRole: string
  alertCount?: number
  tasksCount?: number
}

// ── Configurazione per ruolo ───────────────────────────────────────────────────

function getRoleConfig(role: string, firstName: string, alertCount: number, tasksCount: number) {
  const base = { firstName }

  const configs: Record<string, { welcome: string; proactive: string | null; suggestions: string[] }> = {
    admin: {
      welcome: `Ciao ${firstName}! Sono Lina, la tua assistente. Puoi chiedermi qualsiasi cosa sul gestionale.`,
      proactive: alertCount > 0
        ? `Ho notato ${alertCount} prodott${alertCount === 1 ? 'o' : 'i'} sotto soglia. Vuoi che prepari gli ordini ai fornitori?`
        : tasksCount > 0
        ? `Ci sono ${tasksCount} task aperti. Vuoi un riepilogo o devo assegnarne qualcuno?`
        : null,
      suggestions: [
        'Cosa è sotto soglia nel magazzino?',
        'Mostrami i task urgenti aperti',
        'Chi è il personale attivo oggi?',
        'Quanti riordini sono aperti?',
      ],
    },
    manager: {
      welcome: `Ciao ${firstName}! Sono Lina. Posso aiutarti con il magazzino, i task e il team.`,
      proactive: alertCount > 0
        ? `Attenzione: ${alertCount} prodott${alertCount === 1 ? 'o richiede' : 'i richiedono'} un riordine urgente.`
        : tasksCount > 0
        ? `Ci sono ${tasksCount} task non completati. Devo assegnarne qualcuno?`
        : null,
      suggestions: [
        'Prodotti sotto soglia da ordinare',
        'Task del team da completare',
        'Riepilogo riordini aperti',
        'Chi ha task in scadenza?',
      ],
    },
    aso: {
      welcome: `Ciao ${firstName}! Sono Lina. Puoi chiedermi dei materiali, dei task o dei protocolli.`,
      proactive: tasksCount > 0
        ? `Hai ${tasksCount} task assegnat${tasksCount === 1 ? 'o' : 'i'}. Vuoi che te li mostri?`
        : null,
      suggestions: [
        'Quali materiali sono quasi esauriti?',
        'I miei task di oggi',
        'Protocolli di sterilizzazione',
        'Come richiedere un riordine',
      ],
    },
    segretaria: {
      welcome: `Ciao ${firstName}! Sono Lina. Posso aiutarti con i riordini, i fornitori e le pratiche quotidiane.`,
      proactive: alertCount > 0
        ? `Ci sono ${alertCount} materiali in esaurimento. Devo aiutarti a preparare gli ordini?`
        : null,
      suggestions: [
        'Materiali da ordinare oggi',
        'Lista fornitori e contatti',
        'Riordini aperti da evadere',
        'Come creare una richiesta di riordine',
      ],
    },
  }

  return configs[role] ?? configs.admin
}

// ── Avatar animato ─────────────────────────────────────────────────────────────

function LinaOrb({ state, size = 56, onClick }: { state: AvatarState; size?: number; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <>
      <style>{`
        @keyframes lina-idle   { 0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,.35),0 4px 20px rgba(201,168,76,.2)} 50%{box-shadow:0 0 0 8px rgba(201,168,76,0),0 4px 24px rgba(201,168,76,.35)} }
        @keyframes lina-listen { 0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,.7)} 50%{box-shadow:0 0 0 14px rgba(201,168,76,0)} }
        @keyframes lina-think  { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes lina-bar1   { 0%,100%{height:5px} 50%{height:14px} }
        @keyframes lina-bar2   { 0%,100%{height:10px} 50%{height:5px} }
        @keyframes lina-bar3   { 0%,100%{height:7px} 50%{height:16px} }
      `}</style>
      <Tag
        onClick={onClick}
        aria-label={onClick ? 'Apri Lina' : undefined}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 38%, #E8C566, #9A7220)',
          border: `${size > 40 ? 2.5 : 2}px solid rgba(201,168,76,0.75)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          cursor: onClick ? 'pointer' : 'default',
          position: 'relative',
          animation: state === 'idle'      ? 'lina-idle 3s ease-in-out infinite' :
                     state === 'listening' ? 'lina-listen 1s ease-in-out infinite' : 'none',
          transition: 'box-shadow 0.3s ease',
        }}
      >
        {/* Stato thinking: ring rotante */}
        {state === 'thinking' && (
          <div style={{
            position: 'absolute', inset: -4,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: '#C9A84C',
            animation: 'lina-think 0.8s linear infinite',
          }} />
        )}

        {/* Stato speaking: equalizzatore */}
        {state === 'speaking' ? (
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {[
              { anim: 'lina-bar1 0.6s ease-in-out infinite' },
              { anim: 'lina-bar2 0.6s ease-in-out 0.1s infinite' },
              { anim: 'lina-bar3 0.6s ease-in-out 0.2s infinite' },
            ].map((b, i) => (
              <div key={i} style={{
                width: size > 40 ? 4 : 3,
                height: 8, borderRadius: 2,
                background: '#0D0D0B',
                animation: b.anim,
              }} />
            ))}
          </div>
        ) : (
          /* Lettera L in stati non-speaking */
          <span style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: size > 40 ? '1.3rem' : '0.95rem',
            fontWeight: 600,
            color: '#0D0D0B',
            lineHeight: 1,
            userSelect: 'none',
          }}>L</span>
        )}
      </Tag>
    </>
  )
}

// ── Messaggio formattato ───────────────────────────────────────────────────────

function FmtMsg({ content }: { content: string }) {
  return (
    <span>
      {content.split(/(\*\*[^*]+\*\*|\n)/g).map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> :
        p === '\n' ? <br key={i} /> : <span key={i}>{p}</span>
      )}
    </span>
  )
}

// ── ChatWidget principale ──────────────────────────────────────────────────────

export default function ChatWidget({ userName, userRole, alertCount = 0, tasksCount = 0 }: Props) {
  const firstName = userName.split(' ')[0]
  const config = getRoleConfig(userRole, firstName, alertCount, tasksCount)

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [avatarState, setAvatarState] = useState<AvatarState>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [proactiveMsg, setProactiveMsg] = useState<string | null>(null)

  // Carica preferenza voce da localStorage al mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setVoiceEnabled(localStorage.getItem('lina-voice') === 'true')
    }
  }, [])
  const [proactiveVisible, setProactiveVisible] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)

  // Supporto voce
  const voiceSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  // Ascolta evento globale lina:open dalla LinaBriefingCard
  useEffect(() => {
    const handler = () => setOpen(true)
    document.addEventListener('lina:open', handler)
    return () => document.removeEventListener('lina:open', handler)
  }, [])

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Focus input quando si apre
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100) }, [open])

  // Messaggio di benvenuto
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', content: config.welcome }])
    }
  }, [open])

  // Notifica proattiva — una volta per sessione
  useEffect(() => {
    if (!config.proactive) return
    const key = `lina-proactive-${new Date().toDateString()}-${userRole}`
    if (sessionStorage.getItem(key)) return

    const t = setTimeout(() => {
      setProactiveMsg(config.proactive)
      setProactiveVisible(true)
      sessionStorage.setItem(key, '1')
    }, 4000)
    return () => clearTimeout(t)
  }, [])

  // Nasconde proattiva quando si apre la chat
  useEffect(() => { if (open) setProactiveVisible(false) }, [open])

  // ── Voce output (text-to-speech) ──────────────────────────────────────────

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const clean = text.replace(/\*\*/g, '').replace(/\n/g, ' ')
    const utter = new SpeechSynthesisUtterance(clean)
    utter.lang = 'it-IT'
    utter.rate = 1.05
    utter.pitch = 1.1
    utter.onstart = () => setAvatarState('speaking')
    utter.onend = () => setAvatarState('idle')
    utter.onerror = () => setAvatarState('idle')
    window.speechSynthesis.speak(utter)
  }, [voiceEnabled])

  // ── Voce input (speech-to-text) ────────────────────────────────────────────

  function toggleMic() {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      setAvatarState('idle')
      return
    }
    if (!voiceSupported) return

    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    const r = new SR()
    r.lang = 'it-IT'
    r.continuous = false
    r.interimResults = false
    r.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      // Auto-invia dopo trascrizione
      setTimeout(() => sendMessage(transcript), 300)
    }
    r.onend = () => { setIsListening(false); setAvatarState('idle') }
    r.onerror = () => { setIsListening(false); setAvatarState('idle') }
    r.start()
    recognitionRef.current = r
    setIsListening(true)
    setAvatarState('listening')
  }

  // ── Invio messaggio ────────────────────────────────────────────────────────

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text || avatarState === 'thinking') return

    setInput('')
    window.speechSynthesis?.cancel()

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setAvatarState('thinking')

    try {
      const apiMessages = newMessages
        .filter(m => !(m.role === 'assistant' && m.content === config.welcome))
        .map(m => ({ role: m.role, content: m.content }))

      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, sessionId }),
      })

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? 'Errore')

      const reply = data.risposta as string
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      if (data.sessionId) setSessionId(data.sessionId)

      // Parla la risposta se la voce è attiva
      speak(reply)
      if (!voiceEnabled) setAvatarState('idle')

    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${err.message ?? 'Errore di connessione'}`,
      }])
      setAvatarState('idle')
    }
  }

  // Apri chat con messaggio proattivo precaricato
  function openWithProactive() {
    if (proactiveMsg) {
      setMessages([
        { role: 'assistant', content: config.welcome },
        { role: 'assistant', content: proactiveMsg },
      ])
    }
    setProactiveVisible(false)
    setOpen(true)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Notifica proattiva */}
      {proactiveVisible && !open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 41,
          background: '#1A1714', border: '1px solid rgba(201,168,76,0.35)',
          borderRadius: 12, padding: '12px 14px', maxWidth: 280,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'lina-idle 0s ease', // No animation here, just shadow
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <LinaOrb state="idle" size={32} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.7rem', color: 'rgba(201,168,76,0.7)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Lina
              </p>
              <p style={{ fontSize: '0.8rem', color: '#E8DCC8', lineHeight: 1.4 }}>
                {proactiveMsg}
              </p>
              <button
                onClick={openWithProactive}
                style={{
                  marginTop: 8, fontSize: '0.7rem', color: '#C9A84C',
                  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                }}
              >
                Rispondi →
              </button>
            </div>
            <button
              onClick={() => setProactiveVisible(false)}
              style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bottone avatar flottante */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 40 }}>
        <LinaOrb
          state={open ? 'idle' : avatarState}
          size={56}
          onClick={open ? () => setOpen(false) : () => setOpen(true)}
        />
        {/* Badge proattivo */}
        {proactiveVisible && !open && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            width: 14, height: 14, borderRadius: '50%',
            background: '#C9A84C', border: '2px solid #0D0D0B',
          }} />
        )}
        {/* Chevron quando aperta */}
        {open && (
          <div style={{
            position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(201,168,76,0.5)',
          }}>
            <ChevronDown size={14} />
          </div>
        )}
      </div>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 96, right: 24, zIndex: 40,
          width: `min(420px, calc(100vw - 32px))`,
          height: `min(580px, calc(100vh - 130px))`,
          background: '#141210',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
            background: '#1A1714',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <LinaOrb state={avatarState} size={40} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#E8DCC8', margin: 0 }}>Lina</p>
              <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                {avatarState === 'idle'      ? 'Pronta ad aiutarti' :
                 avatarState === 'listening' ? '● In ascolto…' :
                 avatarState === 'thinking'  ? 'Sto elaborando…' :
                                              '▶ Sto parlando…'}
              </p>
            </div>
            {/* Toggle voce */}
            <button
              onClick={() => {
                const next = !voiceEnabled
                setVoiceEnabled(next)
                localStorage.setItem('lina-voice', String(next))
                if (!next) window.speechSynthesis?.cancel()
              }}
              title={voiceEnabled ? 'Disattiva voce' : 'Attiva voce'}
              style={{
                background: voiceEnabled ? 'rgba(201,168,76,0.15)' : 'transparent',
                border: `1px solid ${voiceEnabled ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
                color: voiceEnabled ? '#C9A84C' : 'rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem',
              }}
            >
              {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>Voce</span>
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4 }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Messaggi */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Suggerimenti se chat vuota */}
            {messages.length <= 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {config.suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    style={{
                      fontSize: '0.7rem', color: 'rgba(201,168,76,0.8)',
                      background: 'rgba(201,168,76,0.06)',
                      border: '1px solid rgba(201,168,76,0.2)',
                      borderRadius: 20, padding: '5px 10px', cursor: 'pointer',
                      textAlign: 'left', lineHeight: 1.3,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
                {msg.role === 'assistant' && <LinaOrb state="idle" size={24} />}
                <div style={{
                  maxWidth: '83%',
                  padding: '9px 12px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                  background: msg.role === 'user' ? '#C9A84C' : '#1F1C18',
                  color: msg.role === 'user' ? '#0D0D0B' : '#E8DCC8',
                  fontSize: '0.83rem',
                  lineHeight: 1.5,
                  border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <FmtMsg content={msg.content} />
                </div>
              </div>
            ))}

            {/* Indicatore thinking */}
            {avatarState === 'thinking' && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
                <LinaOrb state="thinking" size={24} />
                <div style={{
                  padding: '9px 12px', borderRadius: '4px 14px 14px 14px',
                  background: '#1F1C18', border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)',
                }}>
                  Lina sta elaborando…
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: '#141210',
          }}>
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 8,
              background: '#1A1714', borderRadius: 12,
              border: `1px solid ${isListening ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.07)'}`,
              padding: '8px 10px',
              transition: 'border-color 0.2s',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder={isListening ? '● In ascolto…' : 'Scrivi o parla…'}
                rows={1}
                disabled={avatarState === 'thinking'}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#E8DCC8', fontSize: '0.83rem', resize: 'none',
                  maxHeight: 100, lineHeight: 1.4,
                  placeholder: 'test',
                }}
              />

              {/* Mic */}
              {voiceSupported && (
                <button
                  onClick={toggleMic}
                  title={isListening ? 'Stop ascolto' : 'Parla con Lina'}
                  style={{
                    background: isListening ? 'rgba(239,68,68,0.2)' : 'transparent',
                    border: `1px solid ${isListening ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8, padding: 6, cursor: 'pointer',
                    color: isListening ? '#ef4444' : 'rgba(255,255,255,0.3)',
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                    transition: 'all 0.2s',
                  }}
                >
                  {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              )}

              {/* Send */}
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || avatarState === 'thinking'}
                style={{
                  background: input.trim() && avatarState !== 'thinking' ? '#C9A84C' : 'rgba(255,255,255,0.05)',
                  border: 'none', borderRadius: 8, padding: 6,
                  cursor: input.trim() ? 'pointer' : 'default',
                  color: input.trim() && avatarState !== 'thinking' ? '#0D0D0B' : 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                  transition: 'all 0.2s',
                }}
              >
                <Send size={15} />
              </button>
            </div>

            <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 6 }}>
              Enter per inviare · {voiceSupported ? 'Mic per parlare · ' : ''}Voce {voiceEnabled ? 'attiva' : 'disattiva'}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
