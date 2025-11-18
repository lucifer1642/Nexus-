
export enum AgentRole {
  Planner = 'Planner',
  Coder = 'Coder',
  Tester = 'Tester',
  Documenter = 'Documenter',
}

export enum AgentStatus {
  Idle = 'Idle',
  Thinking = 'Thinking',
  Coding = 'Coding',
  Testing = 'Testing',
  Documenting = 'Documenting',
  Revising = 'Revising',
  Done = 'Done',
  Error = 'Error',
}

export interface Agent {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  description: string;
}

export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  status: 'Active' | 'Inactive' | 'Completed';
  agents: Agent[];
  lastActivity: string;
}

export enum LogEntryType {
  Info = 'Info',
  AgentMessage = 'AgentMessage',
  UserAction = 'UserAction',
  FileChange = 'FileChange',
  Commit = 'Commit',
  Error = 'Error',
  Success = 'Success',
}

export interface LogEntry {
  id: number;
  type: LogEntryType;
  agentRole?: AgentRole;
  message: string;
  timestamp: string;
}

export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
}

export interface ChatMessage {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  searchResults?: {web: {uri: string; title: string}}[];
}
