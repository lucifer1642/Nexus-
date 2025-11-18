
import React, { useState } from 'react';
import { FileNode } from '../types';
import { PreviewIcon, Spinner } from './icons';
import * as gemini from '../services/geminiService';

interface PreviewProps {
    file: FileNode | null;
}

const Preview: React.FC<PreviewProps> = ({ file }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean, message: string } | null>(null);

    const isLoginForm = file?.name.toLowerCase().includes('login');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setResult({ success: false, message: "Email and password are required." });
            return;
        }
        setIsLoading(true);
        setResult(null);
        const response = await gemini.simulateLogin(email, password);
        setResult(response);
        setIsLoading(false);
    };

    const renderContent = () => {
        if (!file) {
            return <p className="text-gray-500">Select a file to preview.</p>;
        }

        if (!isLoginForm) {
            return <p className="text-gray-400">Preview is only available for the generated Login component in this demo.</p>;
        }

        return (
            <div className="w-full max-w-sm mx-auto p-8 bg-gray-800 rounded-lg border border-gray-700 shadow-lg">
                <h2 className="text-2xl font-bold text-center text-white mb-6">Login</h2>
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="email">
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                            placeholder="you@example.com"
                            disabled={isLoading}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="password">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                            placeholder="••••••••"
                            disabled={isLoading}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 disabled:cursor-wait text-white font-semibold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center"
                    >
                        {isLoading ? <Spinner className="w-5 h-5" /> : 'Sign In'}
                    </button>
                    {result && (
                        <p className={`text-sm text-center mt-4 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                            {result.message}
                        </p>
                    )}
                </form>
            </div>
        );
    }

    return (
        <div className="bg-gray-800/50 rounded-lg h-full p-4 flex flex-col items-center justify-center">
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900/40 rounded-md border-2 border-dashed border-gray-700">
                {renderContent()}
            </div>
        </div>
    );
};

export default Preview;
