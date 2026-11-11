'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, User } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AiAgentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '⚡ Hey! I am Flick, running on OpenAI Assistants API. Ask me anything about your ledger or actions!',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userMsg = prompt.trim();
    setPrompt('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // Safely fetch local household state
      let stateData = {};
      try {
        const stateRes = await fetch('/api/state');
        if (stateRes.ok) {
          stateData = await stateRes.json();
        }
      } catch (e) {
        // Fall back to empty context if state endpoint is offline
      }

      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          threadId: threadId,
          context: stateData,
        }),
      });

      const data = await chatRes.json();
      if (data.threadId) setThreadId(data.threadId);

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || data.error || 'No response returned.' },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '❌ Assistants API connection error.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-3.5 rounded-full shadow-2xl transition-all transform hover:scale-105"
        >
          <Sparkles className="w-5 h-5 text-black" />
          <span>Ask Flick AI</span>
        </button>
      ) : (
        <div className="w-[420px] h-[560px] bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
          <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-white font-bold text-sm">Flick Assistants Agent</h3>
                <p className="text-neutral-400 text-xs">
                  {threadId ? `Thread: ${threadId.slice(-6)}` : 'Managed OpenAI Agent'}
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-neutral-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-2xl text-sm ${
                    m.role === 'user' ? 'bg-emerald-500 text-black font-medium' : 'bg-neutral-800 text-neutral-100'
                  }`}
                >
                  {m.content}
                </div>
                {m.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 items-center text-emerald-400 text-xs animate-pulse">
                <Bot className="w-4 h-4" />
                <span>Assistant run active...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-3 bg-neutral-950 border-t border-neutral-800 flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask Assistant or schedule a bill..."
              className="flex-1 bg-neutral-900 border border-neutral-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <button type="submit" disabled={loading || !prompt.trim()} className="bg-emerald-500 text-black p-2.5 rounded-xl font-bold">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}