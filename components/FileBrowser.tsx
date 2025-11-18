
import React, { useState } from 'react';
import { FileNode } from '../types';
import { FolderIcon, FileIcon } from './icons';

interface FileBrowserProps {
    files: FileNode[];
    onFileSelect: (file: FileNode) => void;
}

const FileBrowser: React.FC<FileBrowserProps> = ({ files, onFileSelect }) => {
    return (
        <div className="bg-gray-800/50 rounded-lg p-4 h-full overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-300 mb-3">File Explorer</h3>
            <ul>
                {files.map((node) => (
                    <FileTreeNode key={node.name} node={node} onFileSelect={onFileSelect} />
                ))}
            </ul>
        </div>
    );
};

interface FileTreeNodeProps {
    node: FileNode;
    onFileSelect: (file: FileNode) => void;
    level?: number;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, onFileSelect, level = 0 }) => {
    const [isOpen, setIsOpen] = useState(true);

    const isFolder = node.type === 'folder';

    const handleToggle = () => {
        if (isFolder) {
            setIsOpen(!isOpen);
        } else {
            onFileSelect(node);
        }
    };

    return (
        <li style={{ paddingLeft: `${level * 1.25}rem` }}>
            <div
                onClick={handleToggle}
                className="flex items-center space-x-2 py-1.5 px-2 rounded-md hover:bg-gray-700/50 cursor-pointer transition-colors duration-150"
            >
                {isFolder ? <FolderIcon className="w-5 h-5 text-sky-400" /> : <FileIcon className="w-5 h-5 text-gray-400" />}
                <span className="text-gray-300 text-sm">{node.name}</span>
            </div>
            {isFolder && isOpen && node.children && (
                <ul>
                    {node.children.map((child) => (
                        <FileTreeNode key={child.name} node={child} onFileSelect={onFileSelect} level={level + 1} />
                    ))}
                </ul>
            )}
        </li>
    );
};


export default FileBrowser;
