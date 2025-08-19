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
- **Infrastructure**: Dockerized deployment on AWS EC2

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
├── docker/            # Docker configuration files
└── docs/              # Documentation and presentation materials
```

## Tech Stack

- **Frontend**: React, Auth0 React SDK, Material-UI
- **Backend**: Node.js, Express, Auth0 Node SDK
- **Database**: Auth0 user profiles for order storage
- **Infrastructure**: AWS EC2, Docker, Nginx
- **CI/CD**: Git-based deployment

## Getting Started

1. Clone the repository
2. Set up Auth0 tenant and configure applications
3. Install dependencies and configure environment variables
4. Run locally or deploy to AWS

## Auth0 Configuration

### Applications
- **SPA Application**: React frontend with PKCE flow
- **API**: Backend API with RS256 JWT validation

### Connections
- **Database**: Email/password authentication
- **Social**: Google OAuth integration

### Actions/Rules
- Email verification enforcement
- Order history injection into ID tokens

## Deployment

The application is containerized and deployed on AWS EC2:
- Frontend served via Nginx
- Backend API running on Node.js
- Database connection handled via Auth0

## Security Considerations

- HTTPS enforcement
- JWT token validation with proper algorithms (RS256)
- Scope-based API authorization
- Email verification before sensitive operations
- Secure credential storage in Auth0

## Demo Flow

1. User visits Pizza 42 ordering app
2. Login with email/password or Google
3. Email verification required for new users
4. Browse pizza menu and place orders
5. Orders saved to user profile and accessible in future sessions

---

*This is a technical challenge solution demonstrating Auth0 CIAM implementation for Pizza 42's modernization initiative.*
