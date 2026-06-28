#!/bin/bash
set -e

echo "🛡️  Z-Guard NPM Publisher"
echo "------------------------"

# 1. Check if logged in to NPM
echo "Checking NPM authentication status..."
if ! npm whoami >/dev/null 2>&1; then
  echo "❌ Error: You are not logged into NPM."
  echo "Please run 'npm login' first to authenticate."
  exit 1
fi
echo "✅ Logged in as: $(npm whoami)"

# 2. Run test suite
echo "Running Vitest test suite..."
npm run test

# 3. Compile distribution files
echo "Compiling ESM and CommonJS bundles..."
npm run build

# 4. Dry-run pack to inspect files
echo "Performing a dry-run package packing..."
npm pack --dry-run

# 5. Prompt for final confirmation
read -p "Do you want to publish Z-Guard to NPM now? (y/N): " confirm
if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
  echo "Publishing package to NPM..."
  npm publish --access public
  echo "🎉 Z-Guard has been successfully published!"
else
  echo "Publication cancelled."
fi
