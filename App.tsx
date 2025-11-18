
import React, { useState, useCallback, useRef } from 'react';
import { AgentRole, AgentStatus, FileNode, LogEntry, LogEntryType, Project, ChatMessage } from './types';
import { AVAILABLE_AGENTS, INITIAL_FILE_STRUCTURE, INITIAL_PROJECTS } from './constants';
import * as gemini from './services/geminiService';
import { CoderIcon, DocumenterIcon, PlannerIcon, Spinner, TesterIcon, FileIcon, SoundOnIcon, SoundOffIcon, ChatIcon, FolderIcon, PreviewIcon, DownloadIcon, GitCommitIcon } from './components/icons';
import FileBrowser from './components/FileBrowser';
import CodeEditor from './components/CodeEditor';
import Chatbot from './components/Chatbot';
import Preview from './components/Preview';

// Audio decoding utilities
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


const AGENT_ICONS: Record<AgentRole, React.FC<{ className?: string }>> = {
    [AgentRole.Planner]: PlannerIcon,
    [AgentRole.Coder]: CoderIcon,
    [AgentRole.Tester]: TesterIcon,
    [AgentRole.Documenter]: DocumenterIcon,
};

const AGENT_COLORS: Record<AgentRole, string> = {
    [AgentRole.Planner]: 'text-purple-400',
    [AgentRole.Coder]: 'text-sky-400',
    [AgentRole.Tester]: 'text-green-400',
    [AgentRole.Documenter]: 'text-amber-400',
}

const AGENT_STATUS_VERBS: Record<AgentStatus, string> = {
    [AgentStatus.Idle]: 'Idle',
    [AgentStatus.Thinking]: 'Planning...',
    [AgentStatus.Coding]: 'Generating code...',
    [AgentStatus.Testing]: 'Writing tests...',
    [AgentStatus.Documenting]: 'Updating docs...',
    [AgentStatus.Revising]: 'Revising plan...',
    [AgentStatus.Done]: 'Completed',
    [AgentStatus.Error]: 'Error',
};

type WorkspaceTab = 'explorer' | 'editor' | 'preview';

const App: React.FC = () => {
    const [project, setProject] = useState<Project>(INITIAL_PROJECTS[0]);
    const [task, setTask] = useState<string>('Implement a responsive login form with email and password fields, including basic validation.');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [files, setFiles] = useState<FileNode[]>(INITIAL_FILE_STRUCTURE);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<WorkspaceTab>('explorer');

    const logContainerRef = useRef<HTMLDivElement>(null);
    const logIdCounter = useRef<number>(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextAudioStartTimeRef = useRef<number>(0);

    const playAudio = useCallback(async (base64Audio: string | null) => {
        if (isMuted || !base64Audio) return;
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        try {
            const decoded = decode(base64Audio);
            const buffer = await decodeAudioData(decoded, ctx, 24000, 1);
            
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            
            const now = ctx.currentTime;
            let startTime = nextAudioStartTimeRef.current;
            if (startTime < now) {
                startTime = now;
            }
    
            source.start(startTime);
            nextAudioStartTimeRef.current = startTime + buffer.duration;
            audioSourcesRef.current.add(source);
            source.onended = () => {
                audioSourcesRef.current.delete(source);
            };
        } catch (error) {
            console.error("Failed to play audio:", error);
        }
    }, [isMuted]);

    const addLog = useCallback((type: LogEntryType, message: string, agentRole?: AgentRole) => {
        setLogs(prev => {
            const newLog: LogEntry = {
                id: logIdCounter.current++,
                type,
                message,
                agentRole,
                timestamp: new Date().toLocaleTimeString(),
            };
            const newLogs = [...prev, newLog];
            setTimeout(() => {
                if (logContainerRef.current) {
                    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                }
            }, 0);
            return newLogs;
        });
    }, []);
    
    const updateAgentStatus = useCallback((role: AgentRole, status: AgentStatus) => {
        setProject(prev => ({
            ...prev,
            agents: prev.agents.map(agent => 
                agent.role === role ? { ...agent, status } : agent
            )
        }));
    }, []);

    const updateFileByPath = (nodes: FileNode[], path: string, content: string): [FileNode[], FileNode | null] => {
        const pathParts = path.split('/');
        let foundFile: FileNode | null = null;
    
        const recursiveUpdate = (currentNodes: FileNode[], currentPath: string[]): FileNode[] => {
            if (!currentPath.length) return currentNodes;
    
            const [head, ...tail] = currentPath;
            return currentNodes.map(node => {
                if (node.name === head) {
                    if (tail.length === 0 && node.type === 'file') {
                        const updatedNode = { ...node, content };
                        foundFile = updatedNode;
                        return updatedNode;
                    }
                    if (node.type === 'folder' && node.children) {
                        return { ...node, children: recursiveUpdate(node.children, tail) };
                    }
                }
                return node;
            });
        };
        const updatedNodes = recursiveUpdate(nodes, pathParts);
        return [updatedNodes, foundFile];
    };

    const handleFileContentChange = (newContent: string) => {
        if (!selectedFile) return;
    
        // A bit of a hack to create a 'path' for the selected file
        // A real app would have a better way to track file paths.
        const findPath = (nodes: FileNode[], target: FileNode, currentPath: string = ''): string | null => {
            for (const node of nodes) {
                const newPath = currentPath ? `${currentPath}/${node.name}` : node.name;
                if (node === target) return newPath;
                if (node.type === 'folder' && node.children) {
                    const found = findPath(node.children, target, newPath);
                    if (found) return found;
                }
            }
            return null;
        }
        
        const filePath = findPath(files, selectedFile);
        if (filePath) {
            const [updatedFiles, updatedFile] = updateFileByPath(files, filePath, newContent);
            setFiles(updatedFiles);
            if (updatedFile) {
                setSelectedFile(updatedFile); // Keep selected file in sync
            }
        }
    };


    const findAndSelectFile = (nodes: FileNode[], path: string): FileNode | null => {
        const parts = path.split('/').filter(p => p);
        let currentLevel: FileNode[] | undefined = nodes;
        let foundNode: FileNode | null = null;
    
        for (const part of parts) {
            if (!currentLevel) return null;
            const node = currentLevel.find(n => n.name === part);
            if (!node) return null;
    
            if (node.type === 'file' && part === parts[parts.length - 1]) {
                foundNode = node;
                break;
            }
            currentLevel = node.children;
        }
        return foundNode;
    };


    const findOrCreateFile = (nodes: FileNode[], path: string, content: string): FileNode[] => {
        const newNodes = JSON.parse(JSON.stringify(nodes)); // Deep copy
        const parts = path.split('/').filter(p => p);
        const fileName = parts.pop();
        if (!fileName) return newNodes;
    
        let currentLevel = newNodes;
        for (const part of parts) {
            let folder = currentLevel.find((n: FileNode) => n.name === part && n.type === 'folder');
            if (!folder) {
                folder = { name: part, type: 'folder', children: [] };
                currentLevel.push(folder);
            }
            currentLevel = folder.children!;
        }
    
        const fileIndex = currentLevel.findIndex((n: FileNode) => n.name === fileName && n.type === 'file');
        if (fileIndex !== -1) {
            currentLevel[fileIndex].content = content;
        } else {
            currentLevel.push({ name: fileName, type: 'file', content });
        }
    
        return newNodes;
    };
    

    const handleStartTask = async () => {
        if (!task.trim() || isRunning) return;
        
        setIsRunning(true);
        setLogs([]);
        addLog(LogEntryType.UserAction, `Task started: "${task}"`);

        try {
            updateAgentStatus(AgentRole.Planner, AgentStatus.Thinking);
            addLog(LogEntryType.AgentMessage, "Decomposing task...", AgentRole.Planner);
            const plan = await gemini.generatePlan(task);
            addLog(LogEntryType.Info, `Plan created:\n- ${plan.join('\n- ')}`);
            updateAgentStatus(AgentRole.Planner, AgentStatus.Done);
            
            updateAgentStatus(AgentRole.Coder, AgentStatus.Coding);
            addLog(LogEntryType.AgentMessage, "Beginning code generation...", AgentRole.Coder);
            const fileStructureString = JSON.stringify(files.map(f => f.name));
            const { fileName: filePath, code } = await gemini.generateCode(plan[0] || task, fileStructureString);
            
            let updatedFiles = findOrCreateFile(files, filePath, code);
            setFiles(updatedFiles);
            addLog(LogEntryType.FileChange, `Generated file: ${filePath}`, AgentRole.Coder);
            updateAgentStatus(AgentRole.Coder, AgentStatus.Done);
            
            updateAgentStatus(AgentRole.Tester, AgentStatus.Testing);
            addLog(LogEntryType.AgentMessage, `Generating tests for ${filePath}.`, AgentRole.Tester);
            const { testFileName, testCode } = await gemini.generateTests(filePath, code);
            
            updatedFiles = findOrCreateFile(updatedFiles, testFileName, testCode);
            setFiles(updatedFiles);
            addLog(LogEntryType.FileChange, `Generated test file: ${testFileName}`, AgentRole.Tester);
            addLog(LogEntryType.Info, "Tests passed and code clean.", AgentRole.Tester);
            updateAgentStatus(AgentRole.Tester, AgentStatus.Done);

            updateAgentStatus(AgentRole.Documenter, AgentStatus.Documenting);
            addLog(LogEntryType.AgentMessage, "Updating documentation.", AgentRole.Documenter);
            const readme = files.find(f => f.name === 'README.md');
            const updatedReadme = await gemini.generateDocumentation(task, readme?.content || '', `Created ${filePath} and ${testFileName}.`);
            
            updatedFiles = findOrCreateFile(updatedFiles, 'README.md', updatedReadme);
            setFiles(updatedFiles);
            addLog(LogEntryType.FileChange, "Updated README.md", AgentRole.Documenter);
            updateAgentStatus(AgentRole.Documenter, AgentStatus.Done);

            const mainComponentFile = findAndSelectFile(updatedFiles, filePath);
            if(mainComponentFile) {
                setSelectedFile(mainComponentFile);
                setActiveTab('preview');
            }

            addLog(LogEntryType.Success, "Automated task completed. Please review, edit, and commit.");
            playAudio(await gemini.generateSpeech("Task completed. Ready for your review."));

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            addLog(LogEntryType.Error, `Workflow failed: ${errorMessage}`);
            playAudio(await gemini.generateSpeech("An error occurred. Please review the logs."));
        } finally {
            setIsRunning(false);
        }
    };
    
    const handleFileSelect = (file: FileNode) => {
        if (file.type === 'file') {
            setSelectedFile(file);
            setActiveTab('editor'); // Switch to editor on file select
        }
    };

    // FIX: Made function async to allow usage of await for geminiService call.
    const handleCommit = async () => {
        addLog(LogEntryType.Commit, `User approved & committed changes to new branch: feature/${task.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 20)}`);
        addLog(LogEntryType.Success, "Project successfully committed!");
        playAudio(await gemini.generateSpeech("Changes committed."));
        project.agents.forEach(agent => updateAgentStatus(agent.role, AgentStatus.Idle));
    };

    const handleSaveToDevice = () => {
        if (!selectedFile) return;
        const blob = new Blob([selectedFile.content || ''], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog(LogEntryType.UserAction, `Downloaded file: ${selectedFile.name}`);
    };
    

    const TabButton = ({
      label,
      icon: Icon,
      currentTab,
      targetTab,
    }: {
      label: string;
      icon: React.FC<{className?: string}>;
      currentTab: WorkspaceTab;
      targetTab: WorkspaceTab;
    }) => (
      <button
        onClick={() => setActiveTab(targetTab)}
        className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          currentTab === targetTab
            ? 'bg-sky-500/20 text-sky-300'
            : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
        }`}
      >
        <Icon className="w-5 h-5"/>
        <span>{label}</span>
      </button>
    );

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col p-4 lg:p-6 space-y-4 relative">
            <header className="flex-shrink-0 flex items-center justify-between pb-4 border-b border-gray-700/50">
                <div>
                    <h1 className="text-2xl font-bold text-white">Project Nexus</h1>
                    <p className="text-sm text-gray-400">AI Multi-Agent System for Autonomous Software Development</p>
                </div>
                 <div className="flex items-center space-x-4">
                     <button onClick={() => setIsMuted(!isMuted)} className="text-gray-400 hover:text-white transition-colors">
                        {isMuted ? <SoundOffIcon className="w-6 h-6" /> : <SoundOnIcon className="w-6 h-6" />}
                    </button>
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-sm text-green-400 font-medium">System Online</span>
                    </div>
                </div>
            </header>

            <main className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                {/* Left Panel: Agents & Task */}
                <div className="lg:col-span-3 flex flex-col space-y-6">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <h2 className="text-xl font-semibold mb-4 text-gray-200">Agent Team</h2>
                        <div className="space-y-4">
                            {project.agents.map(agent => {
                                const Icon = AGENT_ICONS[agent.role];
                                return (
                                    <div key={agent.id} className="flex items-start space-x-3">
                                        <div className={`p-2 rounded-full bg-gray-700/50 ${AGENT_COLORS[agent.role]}`}>
                                           <Icon className="w-6 h-6"/>
                                        </div>
                                        <div>
                                            <h3 className={`font-semibold ${AGENT_COLORS[agent.role]}`}>{agent.role}</h3>
                                            <div className="flex items-center space-x-2">
                                                {isRunning && agent.status !== AgentStatus.Idle && agent.status !== AgentStatus.Done && <Spinner className="w-4 h-4 text-gray-400" />}
                                                <p className="text-sm text-gray-400">{AGENT_STATUS_VERBS[agent.status]}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-4 flex-grow flex flex-col">
                        <h2 className="text-xl font-semibold mb-4 text-gray-200">Task Execution</h2>
                         <textarea
                            className="w-full flex-grow bg-gray-900/70 border border-gray-700/50 rounded-md p-3 text-sm placeholder-gray-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition resize-none"
                            placeholder="Describe the software development task..."
                            value={task}
                            onChange={(e) => setTask(e.target.value)}
                            rows={6}
                            disabled={isRunning}
                        />
                        <button
                            onClick={handleStartTask}
                            disabled={isRunning || !task.trim()}
                            className="mt-4 w-full bg-sky-600 hover:bg-sky-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-md flex items-center justify-center transition-colors"
                        >
                            {isRunning ? <><Spinner className="w-5 h-5 mr-2" /> Executing Task...</> : 'Start Task'}
                        </button>
                    </div>
                </div>
                
                {/* Middle Panel: Collaboration Feed */}
                <div ref={logContainerRef} className="lg:col-span-5 bg-gray-800/50 rounded-lg p-4 overflow-y-auto h-[60vh] lg:h-auto">
                    <h2 className="text-xl font-semibold mb-4 text-gray-200 sticky top-0 bg-gray-800/50 pb-2 -mt-4 pt-4">Collaboration Feed</h2>
                    <div className="space-y-3 font-mono text-sm">
                        {logs.map(log => {
                            const Icon = log.agentRole ? AGENT_ICONS[log.agentRole] : FileIcon;
                            const color = log.agentRole ? AGENT_COLORS[log.agentRole] : 'text-gray-400';
                             if (log.type === LogEntryType.UserAction) {
                                return <div key={log.id} className="text-cyan-400"><span className="text-gray-500 mr-2">{log.timestamp} &gt;</span>{log.message}</div>
                            }
                             if (log.type === LogEntryType.Error) {
                                return <div key={log.id} className="text-red-400"><span className="text-gray-500 mr-2">{log.timestamp} &gt;</span>{log.message}</div>
                            }
                             if (log.type === LogEntryType.Success) {
                                return <div key={log.id} className="text-green-400 font-bold"><span className="text-gray-500 mr-2">{log.timestamp} &gt;</span>{log.message}</div>
                            }
                            return (
                                <div key={log.id} className="flex items-start">
                                    <span className="text-gray-500 mr-2 pt-0.5">{log.timestamp}</span>
                                    <div className="flex-shrink-0 w-20">
                                      {log.agentRole && <span className={`font-semibold ${color}`}>[{log.agentRole}]</span>}
                                    </div>
                                    <p className="flex-1 text-gray-300 whitespace-pre-wrap">{log.message}</p>
                                </div>
                            )
                        })}
                         {logs.length === 0 && !isRunning && (
                            <div className="flex justify-center items-center h-full text-gray-500">
                                <p>Task logs will appear here.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Workspace */}
                 <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
                    <div className="bg-gray-800/50 rounded-lg p-2 flex flex-col flex-grow min-h-0">
                         <div className="flex-shrink-0 flex items-center space-x-2 p-2 border-b border-gray-700/50">
                            <TabButton label="Explorer" icon={FolderIcon} currentTab={activeTab} targetTab="explorer" />
                            <TabButton label="Editor" icon={FileIcon} currentTab={activeTab} targetTab="editor" />
                            <TabButton label="Preview" icon={PreviewIcon} currentTab={activeTab} targetTab="preview" />
                        </div>
                        <div className="flex-grow pt-2 min-h-0">
                            {activeTab === 'explorer' && <FileBrowser files={files} onFileSelect={handleFileSelect} />}
                            {activeTab === 'editor' && <CodeEditor selectedFile={selectedFile} onContentChange={handleFileContentChange} isReadOnly={isRunning} />}
                            {activeTab === 'preview' && <Preview file={selectedFile} />}
                        </div>
                    </div>
                     <div className="flex-shrink-0 bg-gray-800/50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-3 text-gray-300">Actions</h3>
                        <div className="flex space-x-3">
                            <button onClick={handleSaveToDevice} disabled={!selectedFile || isRunning} className="flex-1 flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-medium py-2 px-3 rounded-md transition-colors">
                                <DownloadIcon className="w-5 h-5" />
                                <span>Save to Device</span>
                            </button>
                             <button onClick={handleCommit} disabled={isRunning} className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded-md transition-colors">
                                <GitCommitIcon className="w-5 h-5" />
                                <span>Approve & Commit</span>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
            
            <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            
            <button
                onClick={() => setIsChatOpen(true)}
                className="fixed bottom-6 right-6 bg-sky-600 hover:bg-sky-500 text-white rounded-full p-4 shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-sky-500"
                aria-label="Open AI Chat"
            >
                <ChatIcon className="w-8 h-8" />
            </button>
        </div>
    );
};

export default App;
