'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

// Extend window for SpeechRecognition
interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
    error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition?: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    }
}

const SUGGESTIONS_EN = [
    'Am I eligible to donate blood?',
    'What are the blood types?',
    'How to prepare for donation?',
    'What is SmartBlood?',
];

const SUGGESTIONS_SI = [
    'මට රුධිරය දෙන්න පුළුවන්ද?',
    'රුධිර වර්ග මොනවද?',
    'පරිත්‍යාගයට පෙර මොනවද කරන්න ඕනේ?',
    'SmartBlood මොකද?',
];

const SUGGESTIONS_SINGLISH = [
    'Matte blood donate karanawa puluwanada?',
    'Blood types mokada ata?',
    'Blood donate karanaw kohomat?',
    'SmartBlood mokada?',
];

export default function ChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [language, setLanguage] = useState<'en' | 'si' | 'singlish'>('en');
    const [isListening, setIsListening] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const isRecognitionActiveRef = useRef(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Prevent scroll propagation to parent page
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isAtTop = scrollTop === 0;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

            // Only prevent default if we're at the top/bottom and trying to scroll further
            if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
                e.preventDefault();
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isAtTop = scrollTop === 0;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

            // Allow natural scrolling only within bounds
            if (isAtTop || isAtBottom) {
                // Check if touch is trying to scroll beyond bounds
                const touch = e.touches[0];
                const moveY = touch.clientY;
                if ((isAtTop && moveY > 0) || (isAtBottom && moveY < 0)) {
                    e.preventDefault();
                }
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('touchmove', handleTouchMove);
        };
    }, []);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Initialize speech recognition once per language change
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            
            // Language code mapping
            let langCode = 'en-US';
            if (language === 'si') {
                langCode = 'si-LK';
            } else if (language === 'singlish') {
                langCode = 'en-US';
            }
            recognition.lang = langCode;

            recognition.onstart = () => {
                isRecognitionActiveRef.current = true;
                setIsListening(true);
            };

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                if (event.results && event.results.length > 0) {
                    const transcript = event.results[event.results.length - 1][0].transcript;
                    if (transcript.trim()) {
                        setInput(transcript);
                        // Auto-send after voice input (use ref to always call current sendMessage)
                        setTimeout(() => {
                            sendMessageRef.current(transcript);
                            isRecognitionActiveRef.current = false;
                            setIsListening(false);
                        }, 300);
                    }
                }
            };

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                // Suppress console spam for permission errors
                if (event.error !== 'not-allowed' && event.error !== 'permission-denied' && event.error !== 'network') {
                    console.error('Speech recognition error:', event.error);
                }
                isRecognitionActiveRef.current = false;
                setIsListening(false);
                
                // Show user-friendly error messages
                if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                    let msg = '';
                    if (language === 'en') {
                        msg = 'Microphone access denied.\n\n' +
                              '✓ Open System Status page for detailed setup:\n' +
                              '→ localhost:3000/system-status\n\n' +
                              'Or manually:\n' +
                              '1. Click the lock 🔒 in the address bar\n' +
                              '2. Find "Microphone" → Set to "Allow"\n' +
                              '3. Reload the page';
                    } else if (language === 'si') {
                        msg = 'මයික්‍රෝෆෝනය ප්‍රවේශ අවස්ථාව නෙතාලනු ලැබුවා.\n\n' +
                              '✓ විස්තාරිත සැකසුම් සඳහා System Status පිටුව විවෙත කරන්න:\n' +
                              '→ localhost:3000/system-status\n\n' +
                              'හෝ අතින්:\n' +
                              '1. ලිපින තීරුවේ lock 🔒 ක්ලික් කරන්න\n' +
                              '2. "Microphone" සොයන්න → "Allow" යි\n' +
                              '3. පිටුව නැවත ප්‍රවේශ කරන්න';
                    } else {
                        msg = 'Microphone access denied.\n\n' +
                              '✓ System Status page open karanwa:\n' +
                              '→ localhost:3000/system-status\n\n' +
                              'Or manually:\n' +
                              '1. Address bar lock 🔒 click karanwa\n' +
                              '2. "Microphone" → "Allow" set karanwa\n' +
                              '3. Page reload karanwa';
                    }
                    alert(msg);
                }
            };

            recognition.onend = () => {
                if (isRecognitionActiveRef.current) {
                    isRecognitionActiveRef.current = false;
                    setIsListening(false);
                }
            };

            recognitionRef.current = recognition;
        } catch (e) {
            console.error('Error initializing speech recognition:', e);
        }
    }, [language]);

    // Cleanup: stop listening when chat closes
    useEffect(() => {
        return () => {
            if (isRecognitionActiveRef.current && recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        };
    }, []);

    // Add welcome message when chat first opens
    useEffect(() => {
        if (isOpen && !hasInteracted) {
            setHasInteracted(true);
            let welcomeText = '';
            if (language === 'en') {
                welcomeText = "Hello! I'm your SmartBlood AI Assistant. Ask me anything about blood donation in English, Sinhala, or Singlish — you can type or use voice input! 🩸";
            } else if (language === 'si') {
                welcomeText = "ආයුබෝවන්! මම ඔබේ SmartBlood AI සහායකයා. රුධිර පරිත්‍යාගය ගැන සිංහල හෝ English වලින් අසන්න — ටයිප් කරන්න හෝ කටහඬ භාවිතා කරන්න! 🩸";
            } else {
                welcomeText = "Ayubowang! Me SmartBlood AI Assistant. Blood donation about English, Sinhala, or Singlish la ask karanaw — type karanaw or voice input use karanaw! 🩸";
            }
            const welcomeMsg: Message = {
                id: 'welcome',
                text: welcomeText,
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages([welcomeMsg]);
        }
    }, [isOpen, hasInteracted, language]);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: text.trim(),
            sender: 'user',
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/chatbot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text.trim() }),
            });

            const data = await res.json();

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: data.reply || "Sorry, I couldn't process your question. Please try again.",
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, botMsg]);
        } catch {
            let errorText = '';
            if (language === 'en') {
                errorText = "Sorry, something went wrong. Please try again.";
            } else if (language === 'si') {
                errorText = "සමාවන්න, යම් දෝෂයක් සිදු විය. කරුණාකර නැවත උත්සාහ කරන්න.";
            } else {
                errorText = "Sorry, something went wrong. Try again karannna.";
            }
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: errorText,
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, language]);

    // Keep ref in sync with current sendMessage function to avoid stale closures in speech handlers
    useEffect(() => {
        sendMessageRef.current = sendMessage;
    }, [sendMessage]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    // ── Voice recognition ──
    const startListening = useCallback(() => {
        if (!recognitionRef.current || isRecognitionActiveRef.current) return;

        try {
            isRecognitionActiveRef.current = true;
            recognitionRef.current.start();
        } catch (e) {
            console.error('Error starting speech recognition:', e);
            isRecognitionActiveRef.current = false;
            setIsListening(false);
        }
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isRecognitionActiveRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.error('Error stopping recognition:', e);
            }
            isRecognitionActiveRef.current = false;
            setIsListening(false);
        }
    }, []);

    const toggleLanguage = () => {
        setLanguage(prev => {
            if (prev === 'en') return 'si';
            if (prev === 'si') return 'singlish';
            return 'en';
        });
    };

    const suggestions = language === 'en' ? SUGGESTIONS_EN : (language === 'si' ? SUGGESTIONS_SI : SUGGESTIONS_SINGLISH);

    return (
        <>
            {/* Floating trigger button */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/30 flex items-center justify-center hover:shadow-red-500/50 transition-shadow"
                        aria-label="Open chat"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {/* Pulse indicator */}
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse border-2 border-white dark:border-gray-900" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-48px)] flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-black/20 dark:shadow-black/50 border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 pointer-events-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-4 bg-gradient-to-r from-red-600 to-red-500 text-white flex-shrink-0 shadow-md">
                            <div className="flex items-center gap-3 flex-1">
                                <motion.div 
                                    className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl backdrop-blur-sm border border-white/30"
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                >
                                    🩸
                                </motion.div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-base leading-tight">SmartBlood Assistant</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span>
                                        <p className="text-[10px] text-white/80 font-medium">
                                            {language === 'en' && 'Online • AI Ready'}
                                            {language === 'si' && 'සබැදුණු • AI සූදානම්'}
                                            {language === 'singlish' && 'Online • AI Ready'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {/* Language toggle */}
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={toggleLanguage}
                                    className="px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-bold transition-colors backdrop-blur-sm border border-white/20"
                                    title="Switch language"
                                >
                                    {language === 'en' && '🇱🇰 SI'}
                                    {language === 'si' && '🇬🇧 EN'}
                                    {language === 'singlish' && '🇱🇰 සි'}
                                </motion.button>
                                {/* Close */}
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setIsOpen(false)}
                                    className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
                                    aria-label="Close chat"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </motion.button>
                            </div>
                        </div>

                        {/* Messages area */}
                        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900/50 dark:to-gray-900 overscroll-contain">
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.25 }}
                                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
                                >
                                    {msg.sender === 'bot' && (
                                        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                            🩸
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[75%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap shadow-md ${
                                            msg.sender === 'user'
                                                ? 'bg-gradient-to-r from-red-600 to-red-500 text-white rounded-br-sm'
                                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-sm'
                                        }`}
                                    >
                                        {msg.text}
                                    </div>
                                    {msg.sender === 'user' && (
                                        <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 text-white font-bold">
                                            👤
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                            {/* Loading indicator */}
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-start gap-2"
                                >
                                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                        🩸
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 border border-gray-200 dark:border-gray-700 shadow-md">
                                        <div className="flex gap-1.5">
                                            <motion.span 
                                                className="w-2.5 h-2.5 bg-red-500 rounded-full" 
                                                animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
                                                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                                            />
                                            <motion.span 
                                                className="w-2.5 h-2.5 bg-red-500 rounded-full" 
                                                animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
                                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                                            />
                                            <motion.span 
                                                className="w-2.5 h-2.5 bg-red-500 rounded-full" 
                                                animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
                                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Quick suggestions (show when few messages) */}
                            {messages.length <= 1 && !isLoading && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="pt-4 space-y-2.5"
                                >
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest px-1">
                                        ✨ {language === 'en' && 'Quick Questions'}
                                        {language === 'si' && 'ඉක්මන් ප්‍රශ්න'}
                                        {language === 'singlish' && 'Quick Questions'}
                                    </p>
                                    {suggestions.map((s, i) => (
                                        <motion.button
                                            key={i}
                                            whileHover={{ scale: 1.02, x: 4 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => sendMessage(s)}
                                            className="block w-full text-left px-3.5 py-3 rounded-xl text-[12px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-red-400 dark:hover:border-red-500/60 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all shadow-sm font-medium"
                                        >
                                            💬 {s}
                                        </motion.button>
                                    ))}
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input area */}
                        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex-shrink-0 shadow-lg">
                            <form onSubmit={handleSubmit} className="flex gap-2">
                                {/* Voice button */}
                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={isListening ? stopListening : startListening}
                                    className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all font-semibold ${
                                        isListening
                                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/50 animate-pulse'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 border border-gray-200 dark:border-gray-700'
                                    }`}
                                    title={isListening
                                        ? (language === 'en' ? 'Stop listening' : (language === 'si' ? 'නවතන්න' : 'Stop listening'))
                                        : (language === 'en' ? 'Voice input' : (language === 'si' ? 'කටහඬ ආදානය' : 'Voice input'))}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${isListening ? 'animate-bounce' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z M12 1a1 1 0 011 1v4a1 1 0 11-2 0V2a1 1 0 011-1zm0 14a1 1 0 011 1v4a1 1 0 11-2 0v-4a1 1 0 011-1zm7-3a1 1 0 100-2h-4a1 1 0 100 2h4zM7 12a1 1 0 11-2 0 1 1 0 012 0z" />
                                    </svg>
                                </motion.button>

                                {/* Text input */}
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={language === 'en' ? 'Ask about blood donation...' : (language === 'si' ? 'රුධිර පරිත්‍යාගය ගැන අසන්න...' : 'Blood donation about ask karannna...')}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-red-400 dark:focus:border-red-500 focus:ring-2 focus:ring-red-400/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                    disabled={isLoading}
                                    maxLength={1000}
                                />

                                {/* Send button */}
                                <motion.button
                                    type="submit"
                                    disabled={isLoading || !input.trim()}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-red-500/40 transition-all font-bold"
                                    aria-label="Send message"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16151496 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99721575 L3.03521743,10.4382088 C3.03521743,10.5953061 3.34915502,10.7524035 3.50612381,10.7524035 L16.6915026,11.5378905 C16.6915026,11.5378905 17.1624089,11.5378905 17.1624089,12.0091827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
                                    </svg>
                                </motion.button>
                            </form>
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-1.5">
                                <span>💪 Powered by AI</span>
                                <span className="text-gray-300 dark:text-gray-600">•</span>
                                <span>🩸 SmartBlood</span>
                            </div>
                            <div className="flex gap-1">
                                <span title="Multi-language">🌐</span>
                                <span title="Secure">🔒</span>
                                <span title="Fast">⚡</span>
                            </div>
                        </div>

                        {/* Voice Listening Modal Overlay */}
                        <AnimatePresence>
                            {isListening && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-[100]"
                                >
                                    {/* Animated waveform */}
                                    <div className="flex items-center justify-center gap-1 mb-6">
                                        {[0, 1, 2, 3, 4].map((i) => (
                                            <motion.div
                                                key={i}
                                                animate={{ height: ['8px', '24px', '8px'] }}
                                                transition={{
                                                    duration: 0.6,
                                                    repeat: Infinity,
                                                    delay: i * 0.1,
                                                }}
                                                className="w-1 bg-red-400 rounded-full"
                                            />
                                        ))}
                                    </div>

                                    {/* Listening text */}
                                    <p className="text-white font-semibold text-base mb-2">
                                        {language === 'en' && '🎤 Listening...'}
                                        {language === 'si' && '🎤 සවන් දෙමින්...'}
                                        {language === 'singlish' && '🎤 Listening...'}
                                    </p>
                                    <p className="text-white/70 text-sm mb-6">
                                        {language === 'en' && 'Speak now'}
                                        {language === 'si' && 'දැන් කතා කරන්න'}
                                        {language === 'singlish' && 'Now speak karannna'}
                                    </p>

                                    {/* Stop button */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={stopListening}
                                        className="px-6 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors"
                                    >
                                        {language === 'en' && 'Stop'}
                                        {language === 'si' && 'තෙරපුම්'}
                                        {language === 'singlish' && 'Stop'}
                                    </motion.button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
