/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-env node */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { invokeGeminiAgent, getGeneratedContentPath } from './gemini-agent.js';
import { generateSmartExperience } from './smart-simulator.js';
import { checkGeminiAuth } from './check-auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Path to the frontend directory where the agent will write
const FRONTEND_DIR = join(__dirname, '..', 'frontend', 'src', 'components');
const GENERATED_CONTENT_PATH = getGeneratedContentPath();

// Toggle between simulation and real agent
const USE_REAL_AGENT = process.env.USE_REAL_AGENT === 'true';

// Store authentication status
let authStatus = null;

app.post('/api/command', async (req, res) => {
  const { command } = req.body;

  console.log('Received command:', command);

  try {
    if (USE_REAL_AGENT) {
      console.log('🤖 Using real Gemini agent');
      try {
        const result = await invokeGeminiAgent(command);
        res.json({
          success: true,
          message: 'Command processed by Gemini agent',
          command,
          mode: 'REAL',
          result,
        });
        return;
      } catch (agentError) {
        console.error(
          'Gemini agent failed, attempting fallback...',
          agentError,
        );

        try {
          const fallback = await simulateAgentResponse(command);
          res.json({
            success: true,
            message: 'Fallback to simulated agent (real agent error)',
            command,
            mode: 'SIMULATED_FALLBACK',
            fallback,
            error: agentError.message,
            debugLogPath: agentError.debugLogPath || null,
          });
          return;
        } catch (fallbackError) {
          console.error('Fallback simulator also failed:', fallbackError);
          res.status(500).json({
            success: false,
            error: agentError.message,
            fallbackError: fallbackError.message,
            debugLogPath: agentError.debugLogPath || null,
          });
          return;
        }
      }
    }

    console.log(
      '🎭 Using simulated agent (set USE_REAL_AGENT=true to use real Gemini)',
    );
    const simulated = await simulateAgentResponse(command);
    res.json({
      success: true,
      message: 'Command processed successfully (simulated)',
      command,
      mode: 'SIMULATED',
      simulated,
    });
  } catch (error) {
    console.error('Error processing command:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

async function simulateAgentResponse(command) {
  console.log('🎨 Generating smart desktop experience...');
  const result = await generateSmartExperience(command, GENERATED_CONTENT_PATH);
  console.log(`✅ Updated GeneratedContent.tsx with: ${result.title}`);
  return result;
}

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    frontendDir: FRONTEND_DIR,
    generatedContentPath: GENERATED_CONTENT_PATH,
    authenticated: authStatus?.authenticated || false,
    agentMode: USE_REAL_AGENT ? 'REAL' : 'SIMULATED',
    authError: authStatus?.error || null,
    debugEnabled: process.env.DEBUG_AGENT === 'true',
  });
});

app.listen(PORT, async () => {
  console.log(
    `🚀 Generative Computer Backend running on http://localhost:${PORT}`,
  );
  console.log(`📁 Frontend directory: ${FRONTEND_DIR}`);
  console.log(`📝 Generated content path: ${GENERATED_CONTENT_PATH}`);
  console.log(`🤖 Agent mode: ${USE_REAL_AGENT ? 'REAL Gemini' : 'SIMULATED'}`);
  console.log('');

  // Check authentication if using real agent
  if (USE_REAL_AGENT) {
    authStatus = await checkGeminiAuth();

    if (authStatus.authenticated) {
      console.log('✅ Gemini CLI is authenticated and ready!');
      console.log('');
      console.log('Ready to receive commands from the frontend!');
    } else {
      console.log('❌ Gemini CLI authentication failed!');
      console.log(`   Error: ${authStatus.error}`);
      if (authStatus.details) {
        console.log(`   Details: ${authStatus.details}`);
      }
      console.log('');
      console.log('📋 To authenticate:');
      console.log('   1. Open a new terminal');
      console.log(
        '   2. cd /Users/josh/Documents/software/repos/generative-computer',
      );
      console.log('   3. Run: npm start');
      console.log(
        '   4. Choose "Login with Google" and complete authentication',
      );
      console.log('   5. Restart this backend server');
      console.log('');
      console.log('⚠️  Falling back to SIMULATED mode for now...');
    }
  } else {
    console.log('Ready to receive commands from the frontend!');
    console.log('');
    console.log(
      'To use the real Gemini agent, restart with: USE_REAL_AGENT=true npm start',
    );
  }
});
