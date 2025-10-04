/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';

/**
 * Smart simulator that generates contextual desktop experiences based on user requests
 * This simulates what the Gemini agent would do
 */

export async function generateSmartExperience(userCommand, outputPath) {
  // Parse the user's intent and craft an appropriate experience payload
  const experience = buildExperienceProfile(userCommand);
  const asciiContent = experience.customContent
    ? `String.raw\`${experience.customContent.replace(/`/g, '\\`')}\``
    : null;

  const content = `// THIS FILE IS MODIFIED BY THE GEMINI AGENT
// The agent will write dynamic content here based on user commands

export default function GeneratedContent() {
  return (
    <div className="generated-content">
      <h2>${experience.title}</h2>

      ${
        asciiContent
          ? `
      <div style={{
        background: '#1b1c2c',
        color: '#f3f4ff',
        padding: '20px',
        borderRadius: '12px',
        fontFamily: '\\"Fira Code\\", \\"Cascadia Code\\", monospace',
        whiteSpace: 'pre',
        marginBottom: '16px',
        boxShadow: '0 12px 28px rgba(10, 15, 45, 0.45)'
      }}>
        {${asciiContent}}
      </div>
      `
          : `
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        borderRadius: '12px',
        color: 'white',
        marginBottom: '16px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>✨ Suggested Plan</h3>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          ${experience.items
            .map(
              (item) =>
                `<li style={{ marginBottom: '12px', fontSize: '15px' }}>${item}</li>`,
            )
            .join('\n          ')}
        </ul>
      </div>
      `
      }

      ${
        experience.tips
          ? `<div style={{
        padding: '16px',
        background: '#f0f7ff',
        borderRadius: '8px',
        borderLeft: '4px solid #667eea'
      }}>
        <p style={{ margin: 0, color: '#333' }}>
          <strong>💡 Pro Tip:</strong> ${experience.tips}
        </p>
      </div>`
          : ''
      }
    </div>
  );
}`;

  await fs.writeFile(outputPath, content, 'utf-8');
  return experience;
}

function buildExperienceProfile(command) {
  const lower = command.toLowerCase();

  if (lower.includes('ascii') || lower.includes('art')) {
    const art = String.raw`  /\_/\\
 ( o.o )  🍎 ASCII Orchard Controller
  > ^ <`;
    return {
      title: '🎨 ASCII Art Showcase',
      items: [],
      customContent: art,
      tips: 'Ask for a new scene to regenerate fresh terminal art.',
    };
  }

  // Shopping/grocery lists
  if (
    lower.includes('shop') ||
    lower.includes('groceries') ||
    lower.includes('grocery') ||
    lower.includes('buy') ||
    lower.includes('carrots') ||
    lower.includes('apples')
  ) {
    return {
      title: '🛒 Shopping Companion',
      items: extractItems(command, [
        'carrots',
        'apples',
        'potatoes',
        'milk',
        'bread',
        'eggs',
      ]),
      tips: 'Check your pantry before heading out to avoid buying duplicates!',
    };
  }

  // Blog/writing
  if (
    lower.includes('blog') ||
    lower.includes('write') ||
    lower.includes('article')
  ) {
    return {
      title: '✍️ Blog Writing Toolkit',
      items: [
        '📋 Research topic and gather sources',
        '🎯 Define target audience and key message',
        '✏️ Write compelling headline and introduction',
        '📝 Draft main content sections',
        '🖼️ Add images, code examples, or diagrams',
        '🔍 Proofread and edit for clarity',
        '🚀 Publish and share on social media',
      ],
      tips: 'Start with an outline to keep your writing focused and structured.',
    };
  }

  // Code/development
  if (
    lower.includes('code') ||
    lower.includes('app') ||
    lower.includes('build') ||
    lower.includes('implement') ||
    lower.includes('develop')
  ) {
    return {
      title: '💻 Development Sprint Plan',
      items: [
        '📐 Design architecture and component structure',
        '🎨 Create UI mockups or wireframes',
        '⚙️ Set up development environment',
        '🔨 Implement core functionality',
        '✅ Write unit and integration tests',
        '🐛 Debug and fix issues',
        '📚 Document code and API',
        '🚀 Deploy to production',
      ],
      tips: 'Break work into small, testable chunks for faster iteration.',
    };
  }

  // Travel/vacation
  if (
    lower.includes('travel') ||
    lower.includes('vacation') ||
    lower.includes('trip') ||
    lower.includes('holiday')
  ) {
    return {
      title: '✈️ Travel Planner',
      items: [
        '🎯 Choose destination and dates',
        '✈️ Book flights and accommodation',
        '📋 Create daily itinerary',
        '💳 Arrange travel insurance',
        '🎒 Pack essentials (clothes, documents, chargers)',
        '💱 Exchange currency or notify bank',
        '📸 Charge camera and devices',
        '🏠 Arrange pet/plant care if needed',
      ],
      tips: 'Book accommodations and flights at least 2-3 months in advance for better deals.',
    };
  }

  // Twitter/social media
  if (
    lower.includes('twitter') ||
    lower.includes('tweet') ||
    lower.includes('post') ||
    lower.includes('social media')
  ) {
    return {
      title: '🐦 Social Media Launch Checklist',
      items: [
        '💡 Draft engaging tweet copy (keep it under 280 chars)',
        '🖼️ Create eye-catching visual or screenshot',
        '🔗 Add relevant links or call-to-action',
        '🏷️ Include 2-3 relevant hashtags',
        '⏰ Schedule for optimal posting time',
        '👥 Tag relevant accounts or collaborators',
        '📊 Monitor engagement and reply to comments',
        '🔄 Retweet and amplify responses',
      ],
      tips: 'Posts with images get 150% more engagement. Make it visual!',
    };
  }

  // Default general planning flow
  return {
    title: `📋 Project Brief: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`,
    items: [
      '🎯 Define clear goals and success criteria',
      '📋 Break down into smaller actionable steps',
      '⏰ Set realistic deadlines for each step',
      '🚀 Start with the highest priority item',
      '✅ Complete and verify each step',
      '📝 Document progress and learnings',
      '🎉 Celebrate completion!',
    ],
    tips: 'Focus on one task at a time for maximum productivity.',
  };
}

function extractItems(command, defaults) {
  // Try to extract items from quotes or commas
  const quoted = command.match(/"([^"]+)"/g);
  if (quoted && quoted.length > 0) {
    return quoted.map((q) => `🛒 ${q.replace(/"/g, '')}`);
  }

  // Look for comma-separated items
  const items = command.match(/:\s*(.+)/);
  if (items && items[1].includes(',')) {
    return items[1].split(',').map((item) => `🛒 ${item.trim()}`);
  }

  // Fall back to defaults
  return defaults.map((item) => `🛒 ${item}`);
}
