const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-client');
const { ManagementClient } = require('auth0');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// JWKS client for token validation
const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
});

// Auth0 Management API client
const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_M2M_CLIENT_ID,
  clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET,
  scope: 'read:users update:users'
});

// Middleware
app.use(cors());
app.use(express.json());

// ========================================
// TOKEN VERIFICATION MIDDLEWARE
// ========================================

/**
 * Comprehensive JWT token verification middleware
 * Supports both access tokens and ID tokens with additional verification
 */
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Decode token to get header and payload
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    console.log('Token type detected:', decoded.payload.aud, 'for user:', decoded.payload.sub);

    // Get the signing key
    const key = await client.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();

    // Verify token signature and claims
    const payload = jwt.verify(token, signingKey, {
      audience: [process.env.AUTH0_AUDIENCE, process.env.AUTH0_CLIENT_ID], // Accept both API and SPA audience
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256']
    });

    // Store token payload
    req.user = payload;
    req.tokenType = Array.isArray(payload.aud) ? 
      (payload.aud.includes(process.env.AUTH0_AUDIENCE) ? 'access_token' : 'id_token') :
      (payload.aud === process.env.AUTH0_AUDIENCE ? 'access_token' : 'id_token');

    console.log(`Verified ${req.tokenType} for user:`, payload.sub);
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ 
      error: 'Invalid token',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * ID Token verification middleware - ensures ID token contains required verification claims
 * This middleware checks for the claims added by our Post-Login Action
 */
const verifyIdTokenClaims = (req, res, next) => {
  try {
    const namespace = 'https://pizza42.com/';
    const user = req.user;
    
    // Check if this is an ID token with our custom claims
    const tokenVerifiedAt = user[`${namespace}token_verified_at`];
    const emailVerified = user[`${namespace}email_verified`];
    const canPlaceOrders = user[`${namespace}can_place_orders`];
    
    console.log('ID Token verification claims check:', {
      tokenVerifiedAt: !!tokenVerifiedAt,
      emailVerified: emailVerified,
      canPlaceOrders: canPlaceOrders,
      tokenType: req.tokenType
    });
    
    // If we have verification claims, validate them
    if (tokenVerifiedAt) {
      // Check if token was verified recently (within last hour)
      const verifiedTime = new Date(tokenVerifiedAt);
      const now = new Date();
      const hoursSinceVerification = (now - verifiedTime) / (1000 * 60 * 60);
      
      if (hoursSinceVerification > 1) {
        console.warn('ID token verification is stale:', hoursSinceVerification, 'hours old');
        // Add warning but don't block request
        req.verificationWarnings = req.verificationWarnings || [];
        req.verificationWarnings.push('Token verification is stale');
      }
      
      // Store verification status in request
      req.idTokenVerification = {
        verified: true,
        verifiedAt: tokenVerifiedAt,
        emailVerified: emailVerified,
        canPlaceOrders: canPlaceOrders,
        authMetadata: user[`${namespace}auth_metadata`],
        sessionSecurity: user[`${namespace}session_security`],
        customerProfile: user[`${namespace}customer_profile`]
      };
    } else {
      // No verification claims found - might be an access token or unprocessed ID token
      console.log('No ID token verification claims found - using fallback verification');
      req.idTokenVerification = {
        verified: false,
        reason: 'No Post-Login Action verification claims found',
        emailVerified: user.email_verified || false,
        canPlaceOrders: user.email_verified || false
      };
    }
    
    next();
  } catch (error) {
    console.error('ID token claims verification error:', error);
    // Don't fail the request, but log the error
    req.idTokenVerification = {
      verified: false,
      error: 'Claims verification failed',
      reason: error.message
    };
    next();
  }
};

/**
 * Email verification enforcement middleware
 * Ensures email is verified before allowing order operations
 */
const requireEmailVerification = (req, res, next) => {
  try {
    const verification = req.idTokenVerification;
    
    if (!verification) {
      return res.status(403).json({ 
        error: 'Email verification status unknown',
        message: 'Unable to determine email verification status'
      });
    }
    
    if (!verification.emailVerified) {
      return res.status(403).json({ 
        error: 'Email verification required',
        message: 'You must verify your email address before placing orders',
        action: 'verify_email',
        user_email: req.user.email
      });
    }
    
    if (!verification.canPlaceOrders) {
      return res.status(403).json({ 
        error: 'Order access restricted',
        message: 'Your account does not have permission to place orders',
        verification: verification
      });
    }
    
    next();
  } catch (error) {
    console.error('Email verification enforcement error:', error);
    return res.status(500).json({ 
      error: 'Verification check failed',
      details: error.message
    });
  }
};

// Scope validation middleware
const requireScope = (requiredScope) => {
  return (req, res, next) => {
    const scope = req.user.scope;
    if (!scope || !scope.includes(requiredScope)) {
      return res.status(403).json({ error: 'Insufficient scope' });
    }
    next();
  };
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Pizza42 API is running' });
});

// ID Token verification test endpoint
app.get('/api/verify-token', verifyToken, verifyIdTokenClaims, (req, res) => {
  try {
    const namespace = 'https://pizza42.com/';
    const user = req.user;
    
    // Extract all verification data
    const verificationData = {
      token_type: req.tokenType,
      user_id: user.sub,
      email: user.email,
      email_verified: user.email_verified,
      
      // ID Token verification claims
      id_token_verification: req.idTokenVerification,
      
      // Custom claims from Post-Login Action
      custom_claims: {
        token_verified_at: user[`${namespace}token_verified_at`],
        email_verified: user[`${namespace}email_verified`],
        can_place_orders: user[`${namespace}can_place_orders`],
        auth_metadata: user[`${namespace}auth_metadata`],
        session_security: user[`${namespace}session_security`],
        customer_profile: user[`${namespace}customer_profile`],
        auth_warnings: user[`${namespace}auth_warnings`],
        verification_required: user[`${namespace}verification_required`],
        order_history: user[`${namespace}order_history`]
      },
      
      // Verification warnings
      warnings: req.verificationWarnings || [],
      
      // Timestamp
      verified_at: new Date().toISOString()
    };
    
    res.json({
      message: 'Token verification complete',
      verification: verificationData
    });
  } catch (error) {
    console.error('Error in token verification endpoint:', error);
    res.status(500).json({ 
      error: 'Token verification failed',
      details: error.message
    });
  }
});

app.post('/api/orders', verifyToken, verifyIdTokenClaims, requireEmailVerification, requireScope('place:orders'), async (req, res) => {
  try {
    const { pizza, size, total, date } = req.body;
    const userId = req.user.sub;

    if (!pizza || !size || !total) {
      return res.status(400).json({ error: 'Missing required order information' });
    }

    // Create order object
    const order = {
      id: Date.now().toString(),
      pizza,
      size,
      total,
      date: date || new Date().toISOString(),
      userId
    };

    // Get current user profile from Auth0
    const user = await management.getUser({ id: userId });
    const currentOrders = user.user_metadata?.orders || [];
    
    // Add new order to user's profile
    const updatedOrders = [...currentOrders, order];
    
    await management.updateUser({ id: userId }, {
      user_metadata: {
        ...user.user_metadata,
        orders: updatedOrders
      }
    });

    // Include verification info in response for transparency
    const response = {
      success: true, 
      message: 'Order placed successfully',
      order: order,
      verification: {
        id_token_verified: req.idTokenVerification?.verified || false,
        email_verified: req.idTokenVerification?.emailVerified || false,
        token_type: req.tokenType,
        verified_at: req.idTokenVerification?.verifiedAt
      }
    };
    
    // Add warnings if any
    if (req.verificationWarnings?.length > 0) {
      response.warnings = req.verificationWarnings;
    }
    
    res.json(response);

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

app.get('/api/orders', verifyToken, verifyIdTokenClaims, requireEmailVerification, async (req, res) => {
  try {
    const userId = req.user.sub;
    
    // Get user orders from Auth0 profile
    const user = await management.getUser({ id: userId });
    const orders = user.user_metadata?.orders || [];
    
    // Include verification info in response
    res.json({ 
      orders,
      verification: {
        id_token_verified: req.idTokenVerification?.verified || false,
        email_verified: req.idTokenVerification?.emailVerified || false,
        token_type: req.tokenType,
        verified_at: req.idTokenVerification?.verifiedAt,
        customer_profile: req.idTokenVerification?.customerProfile
      },
      warnings: req.verificationWarnings || []
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Pizza42 API server running on port ${PORT}`);
});
