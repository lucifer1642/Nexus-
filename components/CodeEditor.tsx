
import React, { useEffect, useState } from 'react';
import { FileNode } from '../types';
import { FileIcon } from './icons';

interface CodeEditorProps {
    selectedFile: FileNode | null;
    onContentChange: (newContent: string) => void;
    isReadOnly: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ selectedFile, onContentChange, isReadOnly }) => {
    const [content, setContent] = useState(selectedFile?.content || '');

    useEffect(() => {
        setContent(selectedFile?.content || '');
    }, [selectedFile]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        onContentChange(e.target.value);
    };

    return (
        <div className="bg-gray-800/50 rounded-lg flex flex-col h-full">
            <div className="flex-shrink-0 bg-gray-900/70 p-3 border-b border-gray-700/50 rounded-t-lg">
                {selectedFile ? (
                    <div className="flex items-center space-x-2">
                        <FileIcon className="w-5 h-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-200">{selectedFile.name}</span>
                    </div>
                ) : (
                    <span className="text-sm text-gray-400">Select a file to view its content</span>
                )}
            </div>
            <div className="flex-grow p-1 overflow-auto relative">
                {selectedFile ? (
                     <textarea
                        className="w-full h-full bg-transparent text-sm font-mono whitespace-pre-wrap p-3 text-gray-300 resize-none border-none focus:ring-0"
                        value={content}
                        onChange={handleChange}
                        readOnly={isReadOnly}
                        spellCheck="false"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">No file selected.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CodeEditor;
