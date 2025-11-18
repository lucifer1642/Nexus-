
import { GoogleGenAI, Type, Modality } from "@google/genai";

// FIX: API key handling updated to adhere to coding guidelines.
// The API key must be obtained exclusively from `process.env.API_KEY` and is assumed to be pre-configured.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });


// Helper to extract JSON from a potential markdown block
const extractJson = (text: string) => {
    const match = text.match(/```json\n([\s\S]*?)\n```/);
    if (match && match[1]) {
        return JSON.parse(match[1]);
    }
    // Fallback for when the model doesn't use a markdown block
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse JSON response:", text);
        throw new Error("Invalid JSON response from model");
    }
};


export const generatePlan = async (task: string): Promise<string[]> => {
    try {
        // Use gemini-2.5-pro with thinking budget for complex planning.
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: `Based on the high-level task "${task}", break it down into a series of smaller, sequential sub-tasks for a software development team. Respond with a valid JSON object with a single key "subtasks" which is an array of strings. Example: {"subtasks": ["Create component file", "Add state logic", "Implement UI rendering"]}`,
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
                responseMimeType: "application/json",
                 responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        subtasks: {
                            type: Type.ARRAY,
                            description: "A list of strings, where each string is a specific sub-task.",
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["subtasks"]
                }
            }
        });
        const jsonResponse = JSON.parse(response.text);
        return jsonResponse.subtasks || ["Error: Could not generate plan."];
    } catch (error) {
        console.error("Error generating plan:", error);
        return ["Analyze requirements", "Implement feature", "Write tests", "Update documentation"];
    }
};

export const generateCode = async (subtask: string, existingFiles: string): Promise<{ fileName: string, code: string }> => {
    try {
        // Use gemini-2.5-pro with thinking budget for complex code generation.
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: `Given the sub-task: "${subtask}", and the existing file structure: ${existingFiles}, generate the necessary TypeScript/React code. Respond with a valid JSON object with "fileName" (e.g., 'src/components/Login.tsx') and "code" properties. The code should be a string containing the full file content.`,
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        fileName: { type: Type.STRING, description: "A suitable file path and name for the component, e.g., 'src/components/Login.tsx'." },
                        code: { type: Type.STRING, description: "The complete code for the file." }
                    },
                    required: ["fileName", "code"]
                }
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error generating code:", error);
        return { fileName: "src/components/Error.tsx", code: `// Failed to generate code for: ${subtask}` };
    }
};

export const generateTests = async (fileName: string, code: string): Promise<{ testFileName: string, testCode: string }> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate unit tests for the following TypeScript/React component located in "${fileName}":\n\n\`\`\`tsx\n${code}\n\`\`\`\n\nUse Jest and React Testing Library. Your response must be a JSON object with "testFileName" and "testCode" properties.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        testFileName: { type: Type.STRING, description: `The test file name, e.g., '${fileName.replace('.tsx', '.test.tsx')}'` },
                        testCode: { type: Type.STRING, description: "The complete code for the test file." }
                    },
                    required: ["testFileName", "testCode"]
                }
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error generating tests:", error);
        return { testFileName: `${fileName.replace('.tsx', '.test.tsx')}`, testCode: `// Failed to generate tests for: ${fileName}` };
    }
};

export const generateDocumentation = async (task: string, readmeContent: string, fileChanges: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `The main task was: "${task}". The following file changes were made: ${fileChanges}. Please update the following README.md to reflect these changes. Keep the existing structure and markdown formatting.\n\nExisting README:\n${readmeContent}`,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating documentation:", error);
        return `${readmeContent}\n\n---\n\n## Update Failed\nCould not automatically update documentation for task: ${task}.`;
    }
};

export const generateChatResponse = async (prompt: string, useSearch: boolean): Promise<{text: string, searchResults?: any[]}> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: useSearch ? [{googleSearch: {}}] : undefined,
            },
        });
        const searchResults = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        return { text: response.text, searchResults };
    } catch (error) {
        console.error("Error in chat:", error);
        return { text: "Sorry, I encountered an error. Please try again." };
    }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio || null;
    } catch (error) {
        console.error("Error generating speech:", error);
        return null;
    }
};

export const simulateLogin = async (email: string, password: string): Promise<{ success: boolean, message: string }> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Simulate a user login attempt. Email: "${email}", Password: "${password}".
            - If the email is a valid format and the password is at least 8 characters, respond with success.
            - Otherwise, respond with an appropriate error message.
            Your response must be a valid JSON object with two keys: "success" (a boolean) and "message" (a string).`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        success: { type: Type.BOOLEAN, description: "Whether the login was successful." },
                        message: { type: Type.STRING, description: "A message to display to the user." }
                    },
                    required: ["success", "message"]
                }
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error simulating login:", error);
        return { success: false, message: "Could not reach authentication server. Please try again." };
    }
};
