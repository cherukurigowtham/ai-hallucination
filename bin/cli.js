#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { verify } = require('../dist/index.js');

function printHelp() {
  console.log(`
🛡️ Z-Guard CLI Tool
------------------
Usage:
  zguard --text <text|file_path> --sources <sources_json_path> [options]

Options:
  --text, -t       Raw text output to verify, or a path to a text file.
  --sources, -s    Path to a JSON file containing grounding sources.
  --gemini-key     Gemini API Key for NLI check.
  --openai-key     OpenAI API Key for NLI check.
  --anthropic-key  Anthropic API Key for NLI check.
  --threshold, -th NLI entailment threshold (default: 0.8).
  --help, -h       Show this help message.
  `);
}

async function run() {
  const args = process.argv.slice(2);
  const params = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--text' || arg === '-t') {
      params.text = args[++i];
    } else if (arg === '--sources' || arg === '-s') {
      params.sourcesPath = args[++i];
    } else if (arg === '--gemini-key') {
      params.geminiApiKey = args[++i];
    } else if (arg === '--openai-key') {
      params.openAIApiKey = args[++i];
    } else if (arg === '--anthropic-key') {
      params.anthropicApiKey = args[++i];
    } else if (arg === '--threshold' || arg === '-th') {
      params.nliThreshold = parseFloat(args[++i]);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!params.text || !params.sourcesPath) {
    console.error('❌ Error: Missing required arguments: --text and --sources.');
    printHelp();
    process.exit(1);
  }

  // Load text
  let rawText = params.text;
  if (fs.existsSync(rawText)) {
    rawText = fs.readFileSync(rawText, 'utf8');
  }

  // Load sources
  if (!fs.existsSync(params.sourcesPath)) {
    console.error(`❌ Error: Sources file not found at ${params.sourcesPath}`);
    process.exit(1);
  }
  const sources = JSON.parse(fs.readFileSync(params.sourcesPath, 'utf8'));

  try {
    const result = await verify(rawText, {
      sources,
      geminiApiKey: params.geminiApiKey,
      openAIApiKey: params.openAIApiKey,
      anthropicApiKey: params.anthropicApiKey,
      nliThreshold: params.nliThreshold
    });

    if (result.isValid) {
      console.log('✅ Z-Guard Verification Passed: No hallucinations detected.');
      process.exit(0);
    } else {
      console.error('❌ Z-Guard Verification Failed: Hallucinations detected!');
      result.critiques.forEach(critique => console.error(`  - Critique: ${critique}`));
      result.actionableErrors.forEach(err => console.error(`  - Actionable Correction: ${err}`));
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Unexpected validation error: ${err.message}`);
    process.exit(1);
  }
}

run();
