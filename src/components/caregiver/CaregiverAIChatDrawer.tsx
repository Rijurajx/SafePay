'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Copy,
  Check,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { SessionUser } from '@/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  draftMessage?: string | null;
  suggestedActions?: string[];
  timestamp: string;
}

interface CaregiverAIChatDrawerProps {
  currentUser: SessionUser | null;
  elderName?: string;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

// Minimal strongly-typed Web Speech interfaces to avoid `any`
interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface BrowserSpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface IWindow extends Window {
  webkitSpeechRecognition?: new () => BrowserSpeechRecognitionInstance;
  SpeechRecognition?: new () => BrowserSpeechRecognitionInstance;
}

export function CaregiverAIChatDrawer({
  currentUser,
  elderName = 'Mr. Thomas',
  isOpen,
  onClose,
  onOpen,
}: CaregiverAIChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello ${currentUser?.fullName || 'Caregiver'}! I'm your **SafePay AI Assistant**.\n\nI have real-time visibility into ${elderName}'s transactions, protection settings, and pending approvals.\n\nYou can speak to me with your microphone or ask questions below.`,
      suggestedActions: [
        'Why was the $489 Tech Care charge flagged?',
        'Draft a gentle text to Dad about the charge',
        'Summarize Dad’s spending this month',
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Setup Web Speech API for voice input
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const win = window as unknown as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const text = finalTranscript || interimTranscript;
      if (text) {
        setInput(text);
      }
    };

    recognition.onerror = (event: { error: string }) => {
      console.warn('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!speechSupported) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Error starting speech recognition:', err);
      }
    }
  };

  // Text-to-speech reading
  const speakText = (text: string, messageId: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (currentlySpeakingId === messageId) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown for spoken audio
    const cleanText = text
      .replace(/[#*`_~]/g, '')
      .replace(/>\s*/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setCurrentlySpeakingId(null);
    utterance.onerror = () => setCurrentlySpeakingId(null);

    setCurrentlySpeakingId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (messageToSend?: string) => {
    const query = (messageToSend || input).trim();
    if (!query || loading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/caregiver-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          draftMessage: data.draftMessage,
          suggestedActions: data.suggestedActions,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Auto-read voice reply if enabled
        if (voiceOutputEnabled) {
          speakText(data.reply, assistantMessage.id);
        }
      } else {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${data.error || 'Unable to connect to the assistant.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch {
      const errorMessage: Message = {
        id: `network-err-${Date.now()}`,
        role: 'assistant',
        content: '⚠️ Network connection error. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraftId(id);
    setTimeout(() => setCopiedDraftId(null), 2500);
  };

  return (
    <>
      {/* Floating Trigger Button (Bottom-Right) */}
      {!isOpen && (
        <button
          onClick={onOpen}
          aria-label="Open Caregiver AI Assistant"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900 text-white shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all duration-150 border border-slate-700 group ring-4 ring-slate-900/10"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Sparkles className="w-4 h-4 text-blue-400 group-hover:rotate-12 transition-transform" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold leading-tight">SafePay AI Assistant</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <Mic className="w-2.5 h-2.5 text-emerald-400" />
              <span>Voice & Chat Enabled</span>
            </div>
          </div>
        </button>
      )}

      {/* Slide-over Backdrop & Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
          />

          {/* Drawer Container */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-400/30">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm tracking-tight">Caregiver AI Assistant</span>
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.2 rounded font-mono">
                        Voice Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Guarding {elderName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Voice Output Toggle */}
                  <button
                    onClick={() => {
                      if (voiceOutputEnabled && window.speechSynthesis) {
                        window.speechSynthesis.cancel();
                        setCurrentlySpeakingId(null);
                      }
                      setVoiceOutputEnabled(!voiceOutputEnabled);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      voiceOutputEnabled
                        ? 'text-blue-400 hover:bg-slate-800'
                        : 'text-slate-500 hover:bg-slate-800'
                    }`}
                    title={voiceOutputEnabled ? 'Voice output enabled' : 'Voice output muted'}
                  >
                    {voiceOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>

                  {/* Close Drawer Button */}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    aria-label="Close assistant"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Security Boundary Notice */}
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Rules decide. AI explains. You remain in control.</span>
                <span className="font-semibold text-slate-700">Read-Only Advisory</span>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {messages.map((m) => {
                  const isUser = m.role === 'user';
                  const isSpeaking = currentlySpeakingId === m.id;

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
                        <span>{isUser ? 'You' : 'SafePay AI'}</span>
                        <span>•</span>
                        <span>{m.timestamp}</span>
                        {!isUser && (
                          <button
                            onClick={() => speakText(m.content, m.id)}
                            className={`p-1 rounded hover:bg-slate-200 transition-colors ${
                              isSpeaking ? 'text-blue-600 font-bold' : 'text-slate-400'
                            }`}
                            title={isSpeaking ? 'Stop speaking' : 'Read message aloud'}
                          >
                            <Volume2 className={`w-3 h-3 ${isSpeaking ? 'animate-pulse' : ''}`} />
                          </button>
                        )}
                      </div>

                      <div
                        className={`max-w-[88%] rounded-2xl p-4 text-xs leading-relaxed ${
                          isUser
                            ? 'bg-slate-900 text-white rounded-br-xs'
                            : 'bg-white text-slate-800 border border-slate-200/80 shadow-xs rounded-bl-xs'
                        }`}
                      >
                        {/* Markdown / Paragraph content */}
                        <div className="whitespace-pre-line space-y-2">
                          {m.content.split('\n\n').map((paragraph, pIdx) => {
                            if (paragraph.startsWith('### ')) {
                              return (
                                <h4 key={pIdx} className="font-bold text-slate-900 text-sm mt-1">
                                  {paragraph.replace('### ', '')}
                                </h4>
                              );
                            }
                            if (paragraph.startsWith('> ')) {
                              return (
                                <blockquote
                                  key={pIdx}
                                  className="border-l-2 border-emerald-500 pl-3 italic text-slate-700 my-2"
                                >
                                  {paragraph.replace('> ', '')}
                                </blockquote>
                              );
                            }
                            return <p key={pIdx}>{paragraph}</p>;
                          })}
                        </div>

                        {/* Dedicated Draft Message Card for Dad */}
                        {m.draftMessage && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-200 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  Ready to send to {elderName}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(m.draftMessage!, m.id)}
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold hover:bg-emerald-100 active:scale-95 transition-all shadow-2xs"
                                >
                                  {copiedDraftId === m.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-emerald-600" />
                                      <span>Copy Text</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="text-xs text-slate-800 italic leading-relaxed bg-white/70 p-2.5 rounded-lg border border-emerald-100">
                                &ldquo;{m.draftMessage}&rdquo;
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Suggested Next Prompts */}
                      {m.suggestedActions && m.suggestedActions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                          {m.suggestedActions.map((action, aIdx) => (
                            <button
                              key={aIdx}
                              onClick={() => handleSend(action)}
                              className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-700 active:scale-[0.98] transition-all shadow-2xs text-left"
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 w-fit text-xs text-slate-500 shadow-2xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Analyzing {elderName}&apos;s data...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Voice Listening Waveform Banner */}
              {isListening && (
                <div className="px-4 py-3 bg-blue-50 border-t border-blue-200 flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-semibold text-blue-900">
                      Listening... speak your question now
                    </span>
                  </div>
                  <button
                    onClick={toggleListening}
                    className="text-xs font-semibold text-rose-700 hover:underline flex items-center gap-1"
                  >
                    <MicOff className="w-3.5 h-3.5" /> Stop
                  </button>
                </div>
              )}

              {/* Input Area */}
              <div className="p-3 border-t border-slate-200 bg-white">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  {/* Voice Mic Button */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`p-2.5 rounded-xl transition-all duration-150 flex items-center justify-center shrink-0 ${
                      isListening
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 animate-bounce'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.95]'
                    }`}
                    title={isListening ? 'Stop listening' : 'Speak with your microphone'}
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  {/* Text Input */}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={isListening ? 'Listening to speech...' : `Ask about ${elderName}'s activity...`}
                      className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="p-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.95] transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-2xs"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1">
                  <span>Press Enter to send or click 🎙️ to talk</span>
                  <span>SafePay AI • Gemini Context</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
