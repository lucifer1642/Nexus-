
import { Agent, AgentRole, AgentStatus, Project, FileNode } from './types';

export const AVAILABLE_AGENTS: Agent[] = [
  { id: 'agent-1', role: AgentRole.Planner, status: AgentStatus.Idle, description: "Decomposes high-level tasks into actionable sub-tasks and orchestrates the team's workflow." },
  { id: 'agent-2', role: AgentRole.Coder, status: AgentStatus.Idle, description: "Writes clean, efficient, and maintainable code based on specifications from the Planner." },
  { id: 'agent-3', role: AgentRole.Tester, status: AgentStatus.Idle, description: "Creates and runs unit tests to ensure code quality, correctness, and adherence to requirements." },
  { id: 'agent-4', role: AgentRole.Documenter, status: AgentStatus.Idle, description: "Generates and updates documentation, including README files and in-code comments." },
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Nexus UI Authentication',
    repoUrl: 'github.com/ashwini-kar/project-nexus-ui',
    status: 'Active',
    agents: AVAILABLE_AGENTS.slice(0, 4),
    lastActivity: '3 hours ago',
  },
  {
    id: 'proj-2',
    name: 'API Gateway Refactor',
    repoUrl: 'github.com/ashwini-kar/api-gateway',
    status: 'Inactive',
    agents: AVAILABLE_AGENTS.slice(0, 2),
    lastActivity: '2 days ago',
  },
];

export const INITIAL_FILE_STRUCTURE: FileNode[] = [
    {
        name: 'src',
        type: 'folder',
        children: [
            { name: 'components', type: 'folder', children: [] },
            { name: 'App.tsx', type: 'file', content: 'import React from "react";\n\nconst App = () => <div>Hello World</div>;\n\nexport default App;' },
            { name: 'index.tsx', type: 'file', content: 'import React from "react";\nimport ReactDOM from "react-dom";\nimport App from "./App";\n\nReactDOM.render(<App />, document.getElementById("root"));' },
        ],
    },
    { name: 'package.json', type: 'file', content: '{ "name": "project-nexus-ui", "version": "1.0.0" }' },
    { name: 'README.md', type: 'file', content: '# Project Nexus UI\n\nThis is the initial README for the project.' },
];
