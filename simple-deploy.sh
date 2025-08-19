#!/bin/bash

# Simple deployment for Pizza42 app
set -e

EC2_HOST="34.207.181.124"
SSH_KEY="$HOME/.ssh/spa-docker-key.pem"

echo "Deploying Pizza42 to EC2..."

# Copy files to server
scp -i "$SSH_KEY" -r . ec2-user@$EC2_HOST:~/pizza42-app/

# Build and run on server
ssh -i "$SSH_KEY" ec2-user@$EC2_HOST << 'EOF'
cd ~/pizza42-app

# Stop existing nginx
sudo systemctl stop nginx || true

# Build frontend
cd frontend
npm install
REACT_APP_AUTH0_DOMAIN=dev-if2hx088kpqzkcd7.us.auth0.com \
REACT_APP_AUTH0_CLIENT_ID=9wcggjvPlN5kfGfqgYG5ksqKmGlbE43e \
REACT_APP_AUTH0_AUDIENCE=https://pizza42-api \
REACT_APP_AUTH0_REDIRECT_URI=http://34.207.181.124 \
REACT_APP_API_URL=http://34.207.181.124:3001/api \
npm run build

# Copy build to nginx
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r build/* /usr/share/nginx/html/

# Configure nginx for SPA
sudo tee /etc/nginx/conf.d/default.conf << 'NGINX_CONF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX_CONF

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Build and start backend
cd ../backend
npm install

# Create environment file
cat > .env << 'ENV_FILE'
AUTH0_DOMAIN=dev-if2hx088kpqzkcd7.us.auth0.com
AUTH0_AUDIENCE=https://pizza42-api
AUTH0_M2M_CLIENT_ID=9wcggjvPlN5kfGfqgYG5ksqKmGlbE43e
AUTH0_M2M_CLIENT_SECRET=-bn3szExL-cRX0uQdz7Xezo-m9YeYI1SjHltfejg_iMES0XcyDAbB2dC2WhmWUHD
PORT=3001
ENV_FILE

# Stop existing backend
pkill -f "node server.js" || true

# Start backend
nohup node server.js > ../backend.log 2>&1 &

echo "Deployment completed!"
echo "Frontend: http://34.207.181.124"
echo "Backend: http://34.207.181.124:3001/api/health"
EOF

echo "Pizza42 deployment completed!"
