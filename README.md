# Pizza 42 - Auth0 CIAM Solution

A proof of concept (PoC) demonstrating how Pizza 42 can leverage Auth0 for customer identity and access management (CIAM).

## Business Use Case

Pizza 42 is modernizing their online ordering system with the following requirements:
- Secure credential management offloaded to Auth0
- Frictionless and customizable login experience
- Social login options and password reset functionality
- Customer data enrichment for marketing purposes

## Solution Architecture

This solution consists of:
- **Frontend**: React Single Page Application (SPA) with Auth0 authentication
- **Backend**: Node.js/Express API for pizza orders with Auth0 token validation  
- **Infrastructure**: Native deployment on AWS EC2 with HTTPS support

## Features Implemented

✅ **Authentication & Authorization**
- Email/password login with Auth0 Database connection
- Google social login integration
- Email verification requirement before placing orders
- JWT token-based API authentication with specific scopes

✅ **Order Management**
- Pizza order placement with authenticated users
- Order history stored in user's Auth0 profile
- Order history included in ID token for seamless access

✅ **Security & UX**
- Protected API endpoints requiring valid tokens
- Scope-based authorization (`place:orders`)
- Email verification enforcement
- Responsive and branded UI

## Project Structure

```
pizza42-auth0-challenge/
├── frontend/          # React SPA with Auth0 integration
├── backend/           # Node.js API for order management
│   ├── server-https-debug.js  # HTTPS production server
│   └── server-simple.js       # Local development server
└── docs/              # Documentation and Auth0 configuration
```

## Tech Stack

- **Frontend**: React, Auth0 React SDK, TypeScript
- **Backend**: Node.js, Express, Auth0 Management API, JWT validation
- **Database**: Auth0 user profiles (user_metadata) for order storage
- **Infrastructure**: AWS EC2 t3.medium, HTTPS with self-signed certificates
- **Authentication**: PKCE flow, JWT tokens with RS256, scope-based authorization

## Getting Started

### Local Development
1. Clone the repository
2. Configure Auth0 applications (SPA + API + M2M)
3. Install dependencies: `npm install` in both frontend/ and backend/
4. Set up environment variables (.env files provided)
5. Run backend: `npm start` in backend/
6. Run frontend: `npm start` in frontend/
7. Access at http://localhost:3000

### Production Deployment (AWS EC2)
✅ **Currently deployed and working at: https://52.90.154.69:3000**
- Backend API: https://52.90.154.69:3443
- HTTPS enabled with self-signed certificates
- PM2 process management
- Native Node.js deployment (no Docker)

## Auth0 Configuration

### Applications
- **SPA Application**: `9wcggjvPlN5kfGfqgYG5ksqKmGlbE43e` - React frontend with PKCE flow
- **API**: `https://pizza42-api` - Backend API with RS256 JWT validation and `place:orders` scope
- **M2M Application**: Management API access for user metadata operations

### Connections  
- **Database**: Username-Password-Authentication for email/password login
- **Social**: Google OAuth integration (optional)

### User Management
- Order storage in Auth0 user_metadata
- Auth0 Management API for CRUD operations
- Email verification enforcement

## Deployment Status

✅ **LIVE DEPLOYMENT** on AWS EC2:
- **Frontend**: https://52.90.154.69:3000 (React dev server with HTTPS)
- **Backend API**: https://52.90.154.69:3443 (Node.js with Express)  
- **Instance**: t3.medium with 20GB EBS storage
- **Process Management**: PM2 for both frontend and backend
- **Security**: HTTPS with self-signed SSL certificates
- **Auth0 Integration**: Fully configured and working

## Security Considerations

- HTTPS enforcement
- JWT token validation with proper algorithms (RS256)
- Scope-based API authorization
- Email verification before sensitive operations
- Secure credential storage in Auth0

## Demo Flow (Live at https://52.90.154.69:3000)

1. **Visit the live Pizza42 app** at https://52.90.154.69:3000
2. **Login** with email/password (or create new account)
3. **Place Orders**: Select pizza type and size, submit order
4. **View Order History**: Check your profile to see all previous orders
5. **Persistent Storage**: Orders are saved in Auth0 user metadata

### Test Credentials
You can create a new account or use the sign-up flow to test the complete experience.

### Features Verified Working:
- ✅ Auth0 authentication and token validation
- ✅ Pizza order placement via secure API
- ✅ Order history retrieval from Auth0 user metadata  
- ✅ Proper JWT scopes and audience validation
- ✅ HTTPS deployment with Auth0 SPA SDK compliance

---

*This is a technical challenge solution demonstrating Auth0 CIAM implementation for Pizza 42's modernization initiative.*
