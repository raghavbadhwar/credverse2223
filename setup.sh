#!/bin/bash

echo "🚀 Setting up CredVerse Platform..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install
cd ..

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm install
cd ..

# Install contract dependencies
echo "📦 Installing contract dependencies..."
cd contracts
npm install
cd ..

# Create environment file
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "⚠️  Please update .env file with your actual configuration"
else
    echo "✅ Environment file already exists"
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p server/uploads
mkdir -p server/logs
mkdir -p contracts/deployments
mkdir -p client/public/uploads

# Make scripts executable
chmod +x scripts/*.sh 2>/dev/null || true

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with proper configuration"
echo "2. Start development: npm run dev"
echo "3. Deploy contracts: npm run contracts:deploy"
echo ""
echo "Commands:"
echo "  npm run dev          - Start both client and server"
echo "  npm run server:dev   - Start server only"
echo "  npm run client:dev   - Start client only"
echo "  npm run contracts:compile - Compile smart contracts"
echo "  npm run contracts:test - Test smart contracts"
echo ""
echo "Documentation: https://github.com/your-username/credverse-platform"