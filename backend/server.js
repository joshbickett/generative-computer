import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { invokeGeminiAgent, getGeneratedContentPath } from './gemini-agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Path to the frontend directory where the agent will write
const FRONTEND_DIR = join(__dirname, '../frontend/src/components');
const GENERATED_CONTENT_PATH = getGeneratedContentPath();

// Toggle between simulation and real agent
const USE_REAL_AGENT = process.env.USE_REAL_AGENT === 'true';

app.post('/api/command', async (req, res) => {
  const { command } = req.body;

  console.log('Received command:', command);

  try {
    if (USE_REAL_AGENT) {
      console.log('🤖 Using real Gemini agent');
      const result = await invokeGeminiAgent(command);
      res.json({
        success: true,
        message: 'Command processed by Gemini agent',
        command,
        result
      });
    } else {
      console.log('🎭 Using simulated agent (set USE_REAL_AGENT=true to use real Gemini)');
      await simulateAgentResponse(command);
      res.json({
        success: true,
        message: 'Command processed successfully (simulated)',
        command
      });
    }

  } catch (error) {
    console.error('Error processing command:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

async function simulateAgentResponse(command) {
  // This is a placeholder that simulates what the Gemini agent would do
  // In the real implementation, this would invoke the Gemini CLI with the appropriate prompt

  const todoContent = `// THIS FILE IS MODIFIED BY THE GEMINI AGENT
// The agent will write dynamic content here based on user commands

export default function GeneratedContent() {
  return (
    <div className="generated-content">
      <h2>📝 Todo List: ${command}</h2>
      <p>Generated from your request: "${command}"</p>

      <div style={{ marginTop: '20px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h3>✅ Tasks to Complete</h3>
        <ul>
          <li>✅ Understand the request</li>
          <li>⬜ Break down into steps</li>
          <li>⬜ Implement the solution</li>
          <li>⬜ Test and verify</li>
          <li>⬜ Document the results</li>
        </ul>
      </div>

      <div style={{ marginTop: '16px', padding: '12px', background: '#e3f2fd', borderRadius: '8px' }}>
        <p><strong>💡 Tip:</strong> The agent is converting everything into todo lists!</p>
        <p>This is just a proof of concept. The real agent will create much more sophisticated content.</p>
      </div>
    </div>
  );
}`;

  await fs.writeFile(GENERATED_CONTENT_PATH, todoContent, 'utf-8');
  console.log('Updated GeneratedContent.tsx');
}

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    frontendDir: FRONTEND_DIR,
    generatedContentPath: GENERATED_CONTENT_PATH
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Open Imagine Backend running on http://localhost:${PORT}`);
  console.log(`📁 Frontend directory: ${FRONTEND_DIR}`);
  console.log(`📝 Generated content path: ${GENERATED_CONTENT_PATH}`);
  console.log(`🤖 Agent mode: ${USE_REAL_AGENT ? 'REAL Gemini' : 'SIMULATED'}`);
  console.log('');
  console.log('Ready to receive commands from the frontend!');
  console.log('');
  console.log('To use the real Gemini agent, restart with: USE_REAL_AGENT=true npm start');
});