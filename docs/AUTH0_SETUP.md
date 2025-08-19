# Auth0 Configuration Guide

This guide explains how to configure Auth0 for the Pizza42 application.

## Prerequisites

1. Auth0 account (sign up at https://auth0.com/signup)
2. Access to Auth0 Dashboard

## Step 1: Create Applications

### Single Page Application (SPA)
1. Go to Auth0 Dashboard > Applications > Applications
2. Click "Create Application"
3. Name: "Pizza42 Frontend"
4. Type: "Single Page Web Applications"
5. Technology: "React"

#### SPA Settings:
- **Allowed Callback URLs**: `http://localhost:3000, http://34.207.181.124`
- **Allowed Logout URLs**: `http://localhost:3000, http://34.207.181.124`
- **Allowed Web Origins**: `http://localhost:3000, http://34.207.181.124`
- **Allowed Origins (CORS)**: `http://localhost:3000, http://34.207.181.124`

### Machine to Machine Application
1. Create another application
2. Name: "Pizza42 Management API"
3. Type: "Machine to Machine Applications"
4. Authorize for "Auth0 Management API"
5. Scopes: `read:users`, `update:users`

## Step 2: Create API

1. Go to Auth0 Dashboard > Applications > APIs
2. Click "Create API"
3. Name: "Pizza42 API"
4. Identifier: `https://pizza42-api`
5. Signing Algorithm: RS256

### API Scopes:
Add custom scope:
- **Scope**: `place:orders`
- **Description**: "Place pizza orders"

## Step 3: Configure Database Connection

1. Go to Authentication > Database
2. Use the default "Username-Password-Authentication" or create a new one
3. Enable the connection for your applications

### Email Verification:
1. Go to your database connection settings
2. Enable "Requires Verification" under Email Verification
3. Customize email templates if needed

## Step 4: Configure Social Connections

### Google OAuth
1. Go to Authentication > Social
2. Enable Google connection
3. Enter Google OAuth credentials (Client ID and Client Secret)
4. Enable for your SPA application

## Step 5: Create Auth0 Action

1. Go to Actions > Library
2. Click "Build Custom"
3. Name: "Add Order History"
4. Trigger: "Login / Post Login"
5. Copy code from `auth0-action.js`
6. Deploy the action

### Add Action to Flow:
1. Go to Actions > Flows > Login
2. Drag your custom action to the flow
3. Apply changes

## Step 6: Configure Universal Login

1. Go to Branding > Universal Login
2. Customize the login page if needed
3. Enable/configure password reset functionality

## Step 7: Environment Variables

Update your environment files with the following values from Auth0:

### Frontend (.env):
```
REACT_APP_AUTH0_DOMAIN=your-auth0-domain.auth0.com
REACT_APP_AUTH0_CLIENT_ID=spa-client-id-here
REACT_APP_AUTH0_AUDIENCE=https://pizza42-api
```

### Backend (.env):
```
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_AUDIENCE=https://pizza42-api
AUTH0_M2M_CLIENT_ID=m2m-client-id-here
AUTH0_M2M_CLIENT_SECRET=m2m-client-secret-here
```

## Testing the Configuration

1. Start your applications locally
2. Test login with email/password
3. Test login with Google
4. Verify email verification workflow
5. Test pizza ordering functionality
6. Check that order history appears in subsequent logins

## Security Considerations

- Use HTTPS in production
- Rotate client secrets regularly
- Monitor Auth0 logs for suspicious activity
- Implement proper CORS policies
- Use appropriate token expiration times

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Check Allowed Origins in SPA settings
2. **Token Verification Failed**: Verify audience and domain settings
3. **Insufficient Scope**: Check API permissions and scopes
4. **Social Login Issues**: Verify social connection configuration

### Useful Auth0 Features:

- **Logs**: Monitor authentication events
- **Users**: Manage user profiles and metadata
- **Rules/Actions**: Customize authentication flow
- **Extensions**: Add additional functionality
