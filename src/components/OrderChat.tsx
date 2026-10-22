import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChatMessage } from '../lib/api'
import { api } from '../lib/api'
import { Icon, Spinner } from './Bits'

type Props = {
  mode: 'customer' | 'admin'
  code: string
  /** مطلوب في وضع العميل فقط */
  phone?: string
  /** بيتنادى بعد ما المسؤول يفتح المحادثة (الرسائل بتتعلّم كمقروءة) */
  onRead?: () => void
}

const MAX_LENGTH = 1000
const POLL_MS = 8000

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function OrderChat({ mode, code, phone, onRead }: Props) {
  const isAdmin = mode === 'admin'
  const listPath = isAdmin
    ? `/api/admin/orders/${code}/messages`
    : `/api/orders/${code}/messages?phone=${encodeURIComponent(phone || '')}`
  const sendPath = isAdmin ? `/api/admin/orders/${code}/messages` : `/api/orders/${code}/messages`

  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const readNotified = useRef(false)
  const onReadRef = useRef(onRead)
  onReadRef.current = onRead

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ messages: ChatMessage[] }>(listPath)
      setMessages((current) => {
        // ما نغيّرش الحالة لو مفيش رسائل جديدة (يمنع إعادة الرسم والتمرير)
        if (current && current.length === result.messages.length && current[current.length - 1]?.id === result.messages[result.messages.length - 1]?.id) {
          return current
        }
        return result.messages
      })
      setError('')
      if (isAdmin && !readNotified.current) {
        readNotified.current = true
        onReadRef.current?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحميل المحادثة')
    }
  }, [listPath, isAdmin])

  useEffect(() => {
    readNotified.current = false
    setMessages(null)
    void load()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [messages?.length])

  async function send(event?: FormEvent) {
    event?.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      await api.post(sendPath, isAdmin ? { body } : { phone, body })
      setText('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال الرسالة')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-3">
        <Icon name="chat" className="h-5 w-5 text-brand-600" />
        <h2 className="text-sm font-extrabold">{isAdmin ? 'محادثة العميل' : 'تواصل مع المتجر بخصوص طلبك'}</h2>
        <span className="ms-auto inline-flex items-center gap-1 text-[11px] font-bold text-stone-400">
          <Icon name="lock" className="h-3.5 w-3.5" />
          محادثة خاصة
        </span>
      </div>

      <div ref={boxRef} className="h-72 space-y-3 overflow-y-auto bg-stone-50/60 p-4">
        {messages === null && !error && (
          <div className="grid h-full place-items-center">
            <Spinner className="h-6 w-6 text-stone-400" />
          </div>
        )}

        {messages !== null && messages.length === 0 && (
          <div className="grid h-full place-items-center text-center text-sm text-stone-400">
            <p>
              {isAdmin ? 'مفيش رسائل لسه — ابدأ المحادثة مع العميل.' : 'عندك سؤال عن الطلب؟ اكتب رسالتك وهنرد عليك هنا.'}
            </p>
          </div>
        )}

        {messages?.map((message) => {
          const mine = isAdmin ? message.sender === 'admin' : message.sender === 'customer'
          const label = isAdmin
            ? message.sender === 'admin'
              ? message.adminEmail || 'المتجر'
              : 'العميل'
            : message.sender === 'admin'
              ? 'المتجر'
              : 'أنت'
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                  mine ? 'rounded-ss-md bg-stone-950 text-white' : 'rounded-se-md border border-stone-200 bg-white text-stone-800'
                }`}
              >
                <p className={`mb-0.5 text-[10px] font-bold ${mine ? 'text-brand-300' : 'text-stone-400'}`} dir="auto">
                  {label}
                </p>
                <p className="whitespace-pre-wrap break-words" dir="auto">
                  {message.body}
                </p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-stone-400' : 'text-stone-400'}`}>{formatTime(message.createdAt)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">{error}</p>}

      <form onSubmit={send} className="flex items-end gap-2 border-t border-stone-200 p-3">
        <textarea
          className="input max-h-32 min-h-[2.75rem] resize-none"
          rows={1}
          value={text}
          maxLength={MAX_LENGTH}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
          placeholder="اكتب رسالتك…"
          aria-label="نص الرسالة"
        />
        <button type="submit" className="btn-accent shrink-0 !py-3" disabled={sending || !text.trim()}>
          {sending ? <Spinner className="h-4 w-4" /> : <Icon name="chevronLeft" className="h-4 w-4" />}
          إرسال
        </button>
      </form>
    </section>
  )
}
