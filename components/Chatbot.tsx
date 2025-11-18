
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import * as gemini from '../services/geminiService';
import { BotIcon, CloseIcon, SearchIcon, Spinner } from './icons';

interface ChatbotProps {
    isOpen: boolean;
    onClose: () => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: 0, sender: 'bot', text: "Hello! I'm the Nexus assistant. How can I help you with your project today?" }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [useSearch, setUseSearch] = useState(false);
    const messageIdCounter = useRef(1);
    const messageContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messageContainerRef.current) {
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedInput = userInput.trim();
        if (!trimmedInput || isLoading) return;

        const userMessage: ChatMessage = {
            id: messageIdCounter.current++,
            sender: 'user',
            text: trimmedInput,
        };
        setMessages(prev => [...prev, userMessage]);
        setUserInput('');
        setIsLoading(true);

        try {
            const { text, searchResults } = await gemini.generateChatResponse(trimmedInput, useSearch);
            const botMessage: ChatMessage = {
                id: messageIdCounter.current++,
                sender: 'bot',
                text,
                // FIX: Correctly filter for web search results and maintain the original structure.
                searchResults: searchResults?.filter((chunk: any) => chunk.web),
            };
            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            const errorMessage: ChatMessage = {
                id: messageIdCounter.current++,
                sender: 'bot',
                text: "I'm sorry, but I encountered an error. Please try again.",
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex justify-center items-center" onClick={onClose}>
            <div className="w-full max-w-2xl h-[80vh] bg-gray-800 rounded-lg shadow-2xl flex flex-col overflow-hidden border border-gray-700" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <BotIcon className="w-7 h-7 text-sky-400" />
                        <h2 className="text-xl font-semibold text-white">Nexus AI Assistant</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>
                <div ref={messageContainerRef} className="flex-grow p-4 space-y-4 overflow-y-auto">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                             {msg.sender === 'bot' && <div className="w-8 h-8 rounded-full bg-sky-500/50 flex items-center justify-center flex-shrink-0"><BotIcon className="w-5 h-5 text-sky-300"/></div>}
                            <div className={`max-w-md p-3 rounded-lg ${msg.sender === 'user' ? 'bg-sky-600 text-white' : 'bg-gray-700/80 text-gray-200'}`}>
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                                {msg.searchResults && msg.searchResults.length > 0 && (
                                    <div className="mt-3 pt-2 border-t border-gray-600/50">
                                        <h4 className="text-xs font-semibold text-gray-400 mb-1.5">Sources:</h4>
                                        <div className="space-y-1">
                                            {/* FIX: Access search result properties correctly from the nested `web` object. */}
                                            {msg.searchResults.map((result, index) => (
                                                <a href={result.web.uri} target="_blank" rel="noopener noreferrer" key={index} className="flex items-center text-xs text-sky-400 hover:underline">
                                                    <SearchIcon className="w-3 h-3 mr-1.5 flex-shrink-0"/>
                                                    <span className="truncate">{result.web.title}</span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                     {isLoading && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-sky-500/50 flex items-center justify-center flex-shrink-0"><BotIcon className="w-5 h-5 text-sky-300"/></div>
                            <div className="max-w-md p-3 rounded-lg bg-gray-700/80 flex items-center space-x-2">
                                <Spinner className="w-5 h-5 text-sky-400" />
                                <span className="text-sm text-gray-400">Thinking...</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-700 flex-shrink-0">
                    <form onSubmit={handleSendMessage} className="relative">
                        <input
                            type="text"
                            value={userInput}
                            onChange={e => setUserInput(e.target.value)}
                            placeholder="Ask me anything..."
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2.5 pl-4 pr-24 text-white placeholder-gray-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                            disabled={isLoading}
                        />
                        <div className="absolute inset-y-0 right-2 flex items-center">
                             <button
                                type="button"
                                onClick={() => setUseSearch(!useSearch)}
                                className={`p-1.5 rounded-full transition-colors ${useSearch ? 'bg-sky-500 text-white' : 'text-gray-400 hover:bg-gray-600'}`}
                                title={useSearch ? "Google Search Enabled" : "Google Search Disabled"}
                            >
                                <SearchIcon className="w-5 h-5" />
                            </button>
                            <button
                                type="submit"
                                disabled={!userInput.trim() || isLoading}
                                className="ml-2 px-3 py-1 bg-sky-600 text-white font-semibold rounded-md hover:bg-sky-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                            >
                                Send
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Chatbot;
