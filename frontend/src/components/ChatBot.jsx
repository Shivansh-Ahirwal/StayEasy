import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from './Icons';

function HotelCards({ hotels }) {
  return (
    <div className="cb-hotel-cards">
      {hotels.map((h) => (
        <Link key={h.id} to={`/hotels/${h.id}`} className="cb-hcard">
          <img
            className="cb-hcard__img"
            src={`https://picsum.photos/seed/yoyo${h.id}/300/160`}
            alt={h.name}
            loading="lazy"
          />
          <div className="cb-hcard__body">
            <div className="cb-hcard__name">{h.name}</div>
            <div className="cb-hcard__city">📍 {h.city}</div>
            <div className="cb-hcard__foot">
              <span className="cb-hcard__rating">
                <Star size={11} style={{ fill: '#f59e0b', stroke: '#f59e0b' }} />
                {Number(h.rating).toFixed(1)}
                {h.review_count > 0 && (
                  <span className="cb-hcard__rc">
                    &nbsp;({h.review_count > 999
                      ? `${(h.review_count / 1000).toFixed(1)}k`
                      : h.review_count})
                  </span>
                )}
              </span>
              {h.price_per_night != null && (
                <span className="cb-hcard__price">
                  ₹{Math.round(h.price_per_night).toLocaleString('en-IN')}
                  <span className="cb-hcard__per">/night</span>
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Inline renderer: bold, italic, ₹price, hotel links ───────────────────────
function inlineRender(text, k = { v: 0 }) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(hotel:(\d+)\)|₹[\d,]+(?:\s*-\s*₹[\d,]+)?)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last)
      parts.push(<span key={k.v++}>{text.slice(last, m.index)}</span>);
    const full = m[0];
    if (full.startsWith('**'))
      parts.push(<strong key={k.v++}>{full.slice(2, -2)}</strong>);
    else if (full.startsWith('*'))
      parts.push(<em key={k.v++}>{full.slice(1, -1)}</em>);
    else if (m[2] && m[3])
      parts.push(
        <Link key={k.v++} to={`/hotels/${m[3]}`} className="cb-hotel-link">
          🏨 {m[2]}
        </Link>,
      );
    else if (full.startsWith('₹'))
      parts.push(<span key={k.v++} className="cb-price-pill">{full}</span>);
    last = m.index + full.length;
  }
  if (last < text.length) parts.push(<span key={k.v++}>{text.slice(last)}</span>);
  return parts.length > 0 ? parts : text;
}

// ── Time-slot icons ───────────────────────────────────────────────────────────
const TIME_ICONS = { morning: '☀️', afternoon: '🌤️', evening: '🌆', night: '🌙' };
function timeIcon(label) {
  return TIME_ICONS[label.toLowerCase().replace(':', '')] ?? '📍';
}

// ── Smart markdown → JSX ──────────────────────────────────────────────────────
function renderMarkdown(text) {
  const lines = text.split('\n');
  const blocks = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // ── Day card  e.g. "Day 1:" or "**Day 1:**" ──
    const dayMatch = line.replace(/\*\*/g, '').match(/^Day\s+(\d+):?\s*(.*)/i);
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1], 10);
      const dayTitle = dayMatch[2];
      const slots = [];
      i++;
      while (i < lines.length) {
        const sl = lines[i].trim();
        if (!sl) { i++; continue; }
        // stop if next day or a new section starts
        if (/^(\*\*)?Day\s+\d+/i.test(sl) || /^#{1,3}\s/.test(sl)) break;
        // time slot line e.g. "Morning: Do X"
        const tMatch = sl.replace(/\*\*/g, '').match(/^(Morning|Afternoon|Evening|Night):\s*(.*)/i);
        if (tMatch) {
          slots.push({ time: tMatch[1], content: tMatch[2] });
        } else if (sl.startsWith('- ') || sl.startsWith('* ')) {
          slots.push({ time: null, content: sl.slice(2) });
        } else {
          slots.push({ time: null, content: sl });
        }
        i++;
      }
      const colors = ['#e23333','#f59e0b','#10b981','#6366f1','#ec4899'];
      const color = colors[(dayNum - 1) % colors.length];
      blocks.push(
        <div key={key++} className="cb-day-card">
          <div className="cb-day-card__head" style={{ background: color }}>
            <span className="cb-day-card__badge">Day {dayNum}</span>
            {dayTitle && <span className="cb-day-card__title">{dayTitle}</span>}
          </div>
          <ul className="cb-day-card__slots">
            {slots.map((s, si) => (
              <li key={si} className="cb-day-slot">
                {s.time && (
                  <span className="cb-day-slot__time">
                    {timeIcon(s.time)} {s.time}
                  </span>
                )}
                <span className="cb-day-slot__desc">{inlineRender(s.content, { v: si * 100 })}</span>
              </li>
            ))}
          </ul>
        </div>,
      );
      continue;
    }

    // ── Cost breakdown block ──
    // Detect a group of lines like "- Label: ₹X" followed by "Total"
    if ((line.startsWith('- ') || line.startsWith('* ')) && /₹/.test(line)) {
      const rows = [];
      while (i < lines.length) {
        const cl = lines[i].trim();
        if (!cl) { i++; break; }
        if (!(cl.startsWith('- ') || cl.startsWith('* ')) && !/^(Total|Grand total)/i.test(cl)) break;
        const content = cl.replace(/^[-*]\s*/, '');
        const isTotal = /^(Total|Grand total)/i.test(content);
        rows.push({ content, isTotal });
        i++;
      }
      if (rows.length > 0) {
        blocks.push(
          <div key={key++} className="cb-cost-card">
            <div className="cb-cost-card__head">💰 Cost Breakdown</div>
            {rows.map((r, ri) => {
              const [label, amt] = r.content.split(':').map((s) => s.trim());
              return (
                <div key={ri} className={`cb-cost-row${r.isTotal ? ' cb-cost-row--total' : ''}`}>
                  <span>{label}</span>
                  <span>{amt ? inlineRender(amt, { v: ri * 50 }) : ''}</span>
                </div>
              );
            })}
          </div>,
        );
      }
      continue;
    }

    // ── Total line standalone ──
    if (/^(Total estimated|Grand total|Total cost)/i.test(line)) {
      blocks.push(
        <div key={key++} className="cb-total-line">{inlineRender(line, { v: 0 })}</div>,
      );
      i++; continue;
    }

    // ── Section heading ──
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      const text2 = line.replace(/^#{1,3}\s/, '');
      blocks.push(<h3 key={key++} className="cb-md-h">{inlineRender(text2, { v: 0 })}</h3>);
      i++; continue;
    }

    // ── Bold-only line ──
    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      blocks.push(<p key={key++} className="cb-md-bold">{inlineRender(line, { v: 0 })}</p>);
      i++; continue;
    }

    // ── Bullet ──
    if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push(<li key={key++} className="cb-md-li">{inlineRender(line.slice(2), { v: 0 })}</li>);
      i++; continue;
    }

    // ── Note / disclaimer ──
    if (/^note:/i.test(line)) {
      blocks.push(
        <p key={key++} className="cb-md-note">
          ℹ️ {inlineRender(line.replace(/^note:\s*/i, ''), { v: 0 })}
        </p>,
      );
      i++; continue;
    }

    // ── Empty line ──
    if (!line) { i++; continue; }

    // ── Default paragraph ──
    blocks.push(<p key={key++} className="cb-md-p">{inlineRender(line, { v: 0 })}</p>);
    i++;
  }

  return blocks;
}

// ── Tool status label ─────────────────────────────────────────────────────────
const TOOL_LABELS = {
  search_hotels: '🔍 Searching hotels…',
  search_web: '🌐 Searching the web…',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hi! I'm your STAYEazy travel assistant 👋\n\nI can help you:\n- **Find hotels** by city, budget, or rating\n- **Plan a full trip** with day-by-day itineraries\n\nWhat's your travel plan?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, toolStatus]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);
    setToolStatus('');
    setStreamingText('');

    const apiMessages = history
      .filter((m) => m.role !== 'assistant' || !m._welcome)
      .map(({ role, content }) => ({ role, content }));

    try {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const res = await fetch('/api/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal: ac.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          if (!chunk.startsWith('data:')) continue;
          let event;
          try { event = JSON.parse(chunk.slice(5).trim()); } catch { continue; }

          if (event.type === 'tool_start') {
            setToolStatus(TOOL_LABELS[event.tool] ?? `⚙️ Running ${event.tool}…`);
          } else if (event.type === 'tool_done') {
            setToolStatus('');
          } else if (event.type === 'hotel_cards') {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', _type: 'hotel_cards', hotels: event.hotels },
            ]);
          } else if (event.type === 'token') {
            accumulated += event.content;
            setStreamingText(accumulated);
          } else if (event.type === 'done') {
            if (accumulated) {
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: accumulated },
              ]);
            }
            setStreamingText('');
            setToolStatus('');
          } else if (event.type === 'error') {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: `⚠️ ${event.message}`, _error: true },
            ]);
            setStreamingText('');
            setToolStatus('');
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '⚠️ Could not reach the AI service.', _error: true },
        ]);
      }
    } finally {
      setLoading(false);
      setToolStatus('');
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* Floating button */}
      <div className="cb-fab-wrap">
        {!open && (
          <div className="cb-fab-tooltip">
            ✨ Try AI Travel Assistant
            <span className="cb-fab-tooltip__arrow" />
          </div>
        )}
        <button
          className={`cb-fab${open ? ' cb-fab--open' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-label="Open travel assistant"
        >
          {open ? '✕' : '✈'}
        </button>
      </div>

      {/* Chat panel */}
      {open && (
        <div className="cb-panel">
          <div className="cb-panel__head">
            <div className="cb-panel__head-info">
              <span className="cb-panel__avatar">✈</span>
              <div>
                <div className="cb-panel__name">Travel Assistant</div>
                <div className="cb-panel__status">
                  {loading ? (toolStatus || 'Thinking…') : 'Online'}
                </div>
              </div>
            </div>
            <button className="cb-panel__close" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="cb-messages">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`cb-msg cb-msg--${m.role}${m._error ? ' cb-msg--error' : ''}`}
              >
                {m._type === 'hotel_cards' ? (
                  <HotelCards hotels={m.hotels} />
                ) : m.role === 'assistant' ? (
                  <div className="cb-msg__bubble">{renderMarkdown(m.content)}</div>
                ) : (
                  <div className="cb-msg__bubble">{m.content}</div>
                )}
              </div>
            ))}

            {/* Tool status indicator */}
            {toolStatus && (
              <div className="cb-msg cb-msg--assistant">
                <div className="cb-msg__bubble cb-msg__bubble--tool">
                  <span className="cb-tool-spinner" /> {toolStatus}
                </div>
              </div>
            )}

            {/* Streaming text */}
            {streamingText && (
              <div className="cb-msg cb-msg--assistant">
                <div className="cb-msg__bubble">
                  {renderMarkdown(streamingText)}
                  <span className="cb-cursor" />
                </div>
              </div>
            )}

            {/* Thinking dots when loading but no stream yet */}
            {loading && !streamingText && !toolStatus && (
              <div className="cb-msg cb-msg--assistant">
                <div className="cb-msg__bubble cb-msg__bubble--typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="cb-input-row">
            <textarea
              ref={inputRef}
              className="cb-input"
              rows={1}
              placeholder="Ask about hotels, trips, budget…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading}
            />
            <button
              className="cb-send"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              ➤
            </button>
          </div>
          <p className="cb-footer">Powered by Ollama · Runs locally</p>
        </div>
      )}
    </>
  );
}
