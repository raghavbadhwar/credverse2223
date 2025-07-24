#!/bin/bash

echo "🚀 Setting up CredVerse Platform..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print success message
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print warning message
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print error message
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print info message
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    echo "Visit: https://nodejs.org/en/download/"
    exit 1
fi

print_success "Node.js found: $(node -v)"

# Check Node.js version and warn if not LTS
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
NODE_MINOR=$(echo $NODE_VERSION | cut -d'.' -f2)

# Current LTS versions (as of 2024): 18.x and 20.x
if [ "$NODE_MAJOR" -eq 18 ] || [ "$NODE_MAJOR" -eq 20 ]; then
    print_success "Node.js version is LTS compatible ($NODE_VERSION)"
elif [ "$NODE_MAJOR" -lt 18 ]; then
    print_warning "Node.js version $NODE_VERSION is below recommended LTS (18.x or 20.x)"
    print_info "Consider upgrading to Node.js 18.x or 20.x for best compatibility"
elif [ "$NODE_MAJOR" -gt 20 ]; then
    print_warning "Node.js version $NODE_VERSION is newer than current LTS (20.x)"
    print_info "This version should work but hasn't been fully tested"
else
    print_success "Node.js version $NODE_VERSION detected"
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm."
    exit 1
fi

print_success "npm found: $(npm -v)"
echo ""

# Check if .env.example exists and copy to .env
if [ -f ".env.example" ]; then
    if [ ! -f ".env" ]; then
        cp .env.example .env
        print_success "Environment file created from .env.example"
        print_warning "Please update .env file with your actual configuration"
    else
        print_info ".env file already exists, skipping copy from .env.example"
    fi
else
    print_warning ".env.example not found, you'll need to create .env manually"
fi

echo ""

# Install root dependencies
print_info "Installing root dependencies..."
if npm install --silent; then
    print_success "Root dependencies installed"
else
    print_error "Failed to install root dependencies"
    exit 1
fi

# Install server dependencies
print_info "Installing server dependencies..."
if cd server && npm install --silent && cd ..; then
    print_success "Server dependencies installed"
else
    print_error "Failed to install server dependencies"
    exit 1
fi

# Install client dependencies
print_info "Installing client dependencies..."
if cd client && npm install --silent && cd ..; then
    print_success "Client dependencies installed"
else
    print_error "Failed to install client dependencies"
    exit 1
fi

# Install contract dependencies
print_info "Installing contract dependencies..."
if cd contracts && npm install --silent && cd ..; then
    print_success "Contract dependencies installed"
else
    print_error "Failed to install contract dependencies"
    exit 1
fi

echo ""

# Create necessary directories
print_info "Creating necessary directories..."
mkdir -p server/uploads
mkdir -p server/logs
mkdir -p contracts/deployments
mkdir -p client/public/uploads
print_success "Directories created"

# Make scripts executable if they exist
SCRIPTS_MADE_EXECUTABLE=false

if [ -f "scripts/ipfs.js" ]; then
    chmod +x scripts/ipfs.js
    print_success "Made scripts/ipfs.js executable"
    SCRIPTS_MADE_EXECUTABLE=true
fi

if [ -f "scripts/deploy.js" ]; then
    chmod +x scripts/deploy.js
    print_success "Made scripts/deploy.js executable"
    SCRIPTS_MADE_EXECUTABLE=true
fi

# Check for other common script files and make them executable
if [ -d "scripts" ]; then
    for script in scripts/*.sh scripts/*.js; do
        if [ -f "$script" ] && [ "$script" != "scripts/ipfs.js" ] && [ "$script" != "scripts/deploy.js" ]; then
            chmod +x "$script"
            print_success "Made $script executable"
            SCRIPTS_MADE_EXECUTABLE=true
        fi
    done
fi

if [ "$SCRIPTS_MADE_EXECUTABLE" = false ]; then
    print_info "No additional scripts found to make executable"
fi

echo ""
echo "🎉 ${GREEN}Setup completed successfully!${NC}"
echo ""

# Check if .env needs configuration
if [ -f ".env" ]; then
    # Check if .env has placeholder values
    if grep -q "your_.*_here" .env || grep -q "CHANGE_ME" .env; then
        print_warning "Remember to configure your .env file with actual values!"
    else
        print_success ".env file appears to be configured"
    fi
fi

echo ""
echo "${BLUE}📋 Next steps:${NC}"
echo "1. ${YELLOW}Configure environment variables:${NC} Update .env file with your settings"
echo "2. ${YELLOW}Start development:${NC} npm run dev"
echo "3. ${YELLOW}Deploy contracts:${NC} npm run contracts:deploy"
echo ""

echo "${BLUE}🛠️  Available commands:${NC}"
echo "  ${GREEN}npm run dev${NC}              - Start both client and server"
echo "  ${GREEN}npm run server:dev${NC}       - Start server only"
echo "  ${GREEN}npm run client:dev${NC}       - Start client only"
echo "  ${GREEN}npm run contracts:compile${NC} - Compile smart contracts"
echo "  ${GREEN}npm run contracts:test${NC}    - Test smart contracts"
echo "  ${GREEN}npm run contracts:deploy${NC}  - Deploy smart contracts"
echo ""

echo "${BLUE}🌐 Application URLs (after starting):${NC}"
echo "  ${GREEN}Frontend:${NC} http://localhost:3000"
echo "  ${GREEN}Backend API:${NC} http://localhost:3001"
echo "  ${GREEN}API Health:${NC} http://localhost:3001/health"
echo ""

echo "${BLUE}📚 Documentation:${NC}"
echo "  ${GREEN}GitHub:${NC} https://github.com/your-username/credverse-platform"
echo "  ${GREEN}API Docs:${NC} http://localhost:3001/api/docs (after starting server)"
echo ""

print_success "CredVerse platform is ready for development! 🚀"