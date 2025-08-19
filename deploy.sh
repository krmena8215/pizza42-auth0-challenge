#!/bin/bash

# Pizza42 Auth0 Challenge - AWS EC2 Deployment Script
# This script deploys the application to the AWS EC2 instance

set -e

# Configuration
EC2_HOST="34.207.181.124"
SSH_KEY="$HOME/.ssh/spa-docker-key.pem"
DOCKER_COMPOSE_VERSION="v2.32.4"

echo "Starting deployment to Pizza42 production server..."

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo "ERROR: SSH key not found at $SSH_KEY"
    exit 1
fi

echo "Creating deployment package..."
# Create a clean deployment package
tar -czf pizza42-deploy.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=frontend/build \
    --exclude="*.log" \
    --exclude="*.env" \
    .

echo "Uploading application to server..."
scp -i "$SSH_KEY" pizza42-deploy.tar.gz ec2-user@$EC2_HOST:/tmp/

echo "Installing and starting application on server..."
ssh -i "$SSH_KEY" ec2-user@$EC2_HOST << 'EOF'
# Stop any existing application
sudo docker-compose down 2>/dev/null || true

# Clean up existing deployment
rm -rf ~/pizza42-app
mkdir -p ~/pizza42-app

# Extract new deployment
cd ~/pizza42-app
tar -xzf /tmp/pizza42-deploy.tar.gz
rm /tmp/pizza42-deploy.tar.gz

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Create environment file for production
cat > .env << 'ENVEOF'
# Production environment variables
AUTH0_DOMAIN=dev-if2hx088kpqzkcd7.us.auth0.com
AUTH0_AUDIENCE=https://pizza42-api
AUTH0_M2M_CLIENT_ID=9wcggjvPlN5kfGfqgYG5ksqKmGlbE43e
AUTH0_M2M_CLIENT_SECRET=-bn3szExL-cRX0uQdz7Xezo-m9YeYI1SjHltfejg_iMES0XcyDAbB2dC2WhmWUHD
REACT_APP_AUTH0_DOMAIN=dev-if2hx088kpqzkcd7.us.auth0.com
REACT_APP_AUTH0_CLIENT_ID=9wcggjvPlN5kfGfqgYG5ksqKmGlbE43e
REACT_APP_AUTH0_AUDIENCE=https://pizza42-api
REACT_APP_AUTH0_REDIRECT_URI=http://34.207.181.124
REACT_APP_API_URL=http://34.207.181.124:3001/api
ENVEOF

echo "Building and starting Docker containers..."
sudo docker-compose up --build -d

echo "Cleaning up old images..."
sudo docker image prune -f

echo "Deployment completed successfully!"
echo "Application should be available at: http://34.207.181.124"
echo "API health check: http://34.207.181.124:3001/api/health"

# Show container status
echo "Container status:"
sudo docker-compose ps
EOF

# Clean up local deployment package
rm pizza42-deploy.tar.gz

echo "Deployment completed!"
echo "Your Pizza42 app is now live at: http://$EC2_HOST"
echo "Check logs with: ssh -i $SSH_KEY ec2-user@$EC2_HOST 'cd ~/pizza42-app && sudo docker-compose logs'"
