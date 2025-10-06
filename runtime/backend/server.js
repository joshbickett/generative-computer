/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-env node */

import express from 'express';
import cors from 'cors';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, resolve, sep } from 'node:path';
import {
  invokeGeminiAgent,
  getGeneratedContentPath,
  getUsageSummary,
} from './gemini-agent.js';
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
const WORKSPACE_DIR = join(__dirname, '..', 'my-computer');
const AGENT_COMPONENTS_DIR = join(
  __dirname,
  '..',
  'frontend',
  'src',
  'agent-components',
);
const AGENT_MANIFEST_PATH = join(
  __dirname,
  '..',
  'frontend',
  'src',
  'agent-manifest.ts',
);

// Toggle between simulation and real agent
const USE_REAL_AGENT = process.env.USE_REAL_AGENT === 'true';

// Store authentication status
let authStatus = null;

const FILE_KIND_MAP = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.tsx': 'tsx',
};

const DEFAULT_WELCOME_MARKDOWN = `# Welcome to the Generative Computer!\n\nYou and your agent now share this desktop workspace. Files you create here live under **My Computer** and stay editable by both of you.\n\n## Getting Started\n\n- Type a command below to ask the agent for help\n- Open files from **My Computer** to edit them in place\n- Ask the agent to create new notes, plans, or React components\n\n## Tips\n\n- Close and reopen files from **My Computer** whenever you need a clean view\n- Every file shows its real name so you can reference it in future requests\n- Markdown documents render live previews as you edit\n`;

async function ensureWorkspaceDefaults() {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });

  const welcomePath = resolve(WORKSPACE_DIR, 'welcome.md');
  try {
    await fs.access(welcomePath);
  } catch {
    console.log('Creating default welcome note at', welcomePath);
    await fs.writeFile(welcomePath, DEFAULT_WELCOME_MARKDOWN, 'utf-8');
  }
}

function resolveWorkspacePath(relativePath) {
  const normalizedRoot = WORKSPACE_DIR.endsWith(sep)
    ? WORKSPACE_DIR
    : `${WORKSPACE_DIR}${sep}`;
  const safePath = resolve(WORKSPACE_DIR, relativePath);
  if (safePath !== WORKSPACE_DIR && !safePath.startsWith(normalizedRoot)) {
    throw new Error('Invalid workspace path');
  }
  return safePath;
}

function mapFileMetadata(name, stats) {
  const extension = extname(name).toLowerCase();
  return {
    name,
    path: name,
    kind: FILE_KIND_MAP[extension] || 'file',
    size: stats.size,
    updatedAt: stats.mtime.toISOString(),
  };
}

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
  const result = await generateSmartExperience(command);
  if (result?.notePath) {
    console.log(`✅ Created workspace note: ${result.notePath}`);
  } else {
    console.log(
      `✅ Generated workspace content for: ${result?.title ?? command}`,
    );
  }
  return result;
}

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    frontendDir: FRONTEND_DIR,
    generatedContentPath: GENERATED_CONTENT_PATH,
    workspaceDir: WORKSPACE_DIR,
    agentManifestPath: AGENT_MANIFEST_PATH,
    agentComponentsDir: AGENT_COMPONENTS_DIR,
    authenticated: authStatus?.authenticated || false,
    agentMode: USE_REAL_AGENT ? 'REAL' : 'SIMULATED',
    authError: authStatus?.error || null,
    debugEnabled: process.env.DEBUG_AGENT === 'true',
  });
});

app.get('/api/files', async (req, res) => {
  try {
    await ensureWorkspaceDefaults();
    const entries = await fs.readdir(WORKSPACE_DIR, { withFileTypes: true });

    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const absolutePath = resolveWorkspacePath(entry.name);
          const stats = await fs.stat(absolutePath);
          return mapFileMetadata(entry.name, stats);
        }),
    );

    files.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, files });
  } catch (error) {
    console.error('Unable to list workspace files:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/files/content', async (req, res) => {
  const rawPath = typeof req.query.path === 'string' ? req.query.path : '';
  const relativePath = rawPath.trim();

  if (!relativePath) {
    res.status(400).json({ success: false, error: 'Missing file path' });
    return;
  }

  try {
    await ensureWorkspaceDefaults();
    const filePath = resolveWorkspacePath(relativePath);
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ success: true, content });
  } catch (error) {
    console.error(`Unable to read workspace file "${relativePath}":`, error);
    if (error?.code === 'ENOENT') {
      res
        .status(404)
        .json({ success: false, error: `File not found: ${relativePath}` });
      return;
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/files/content', async (req, res) => {
  const rawPath = typeof req.body?.path === 'string' ? req.body.path : '';
  const relativePath = rawPath.trim();
  const content = typeof req.body?.content === 'string' ? req.body.content : '';

  if (!relativePath) {
    res.status(400).json({ success: false, error: 'Missing file path' });
    return;
  }

  try {
    await ensureWorkspaceDefaults();
    const filePath = resolveWorkspacePath(relativePath);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    const stats = await fs.stat(filePath);
    res.json({
      success: true,
      savedAt: stats.mtime.toISOString(),
    });
  } catch (error) {
    console.error(`Unable to write workspace file "${relativePath}":`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/gemini-stats', (req, res) => {
  const summary = getUsageSummary();

  if (!summary.latest && !summary.aggregate) {
    res.json({
      success: false,
      message: 'No Gemini API usage has been recorded in this session.',
    });
    return;
  }

  res.json({
    success: true,
    summary,
  });
});

app.listen(PORT, async () => {
  console.log(
    `🚀 Generative Computer Backend running on http://localhost:${PORT}`,
  );
  console.log(`📁 Frontend directory: ${FRONTEND_DIR}`);
  console.log(`📝 Generated content path: ${GENERATED_CONTENT_PATH}`);
  console.log(`🗂️  Shared workspace: ${WORKSPACE_DIR}`);
  console.log(`🧩 Agent components: ${AGENT_COMPONENTS_DIR}`);
  console.log(`🪟 Agent manifest: ${AGENT_MANIFEST_PATH}`);
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

  try {
    await ensureWorkspaceDefaults();
  } catch (error) {
    console.error('⚠️  Unable to prepare My Computer workspace:', error);
  }
});
