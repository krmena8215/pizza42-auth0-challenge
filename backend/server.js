const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');
const { ManagementClient } = require('auth0');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// JWKS client for token validation
const client = jwksRsa({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
});

// Auth0 Management API client (still needed for user profile info)
const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_M2M_CLIENT_ID,
  clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET,
  scope: 'read:users update:users'
});

// DynamoDB client configuration
const dynamoClient = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'us-east-1'
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'Pizza42-Orders';

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Generate customer profile from DynamoDB order data
 * @param {Array} orders - Array of orders from DynamoDB
 * @param {Object} user - Auth0 user object
 * @returns {Object} Customer profile data
 */
function generateCustomerProfileFromOrders(orders, user) {
  try {
    if (!orders.length) {
      return {
        total_orders: 0,
        total_spent: 0,
        customer_since: user.iat ? new Date(user.iat * 1000).toISOString() : new Date().toISOString()
      };
    }
    
    const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const favoriteSize = getMostFrequent(orders.map(order => order.size));
    const favoritePizza = getMostFrequent(orders.map(order => order.pizza));
    
    // Calculate average order value and frequency
    const avgOrderValue = totalSpent / orders.length;
    const firstOrder = new Date(orders[orders.length - 1].date); // Last in array (oldest)
    const lastOrder = new Date(orders[0].date); // First in array (newest)
    const daysBetween = Math.max(1, (lastOrder - firstOrder) / (1000 * 60 * 60 * 24));
    const orderFrequency = orders.length / daysBetween; // orders per day
    
    return {
      total_orders: orders.length,
      total_spent: Math.round(totalSpent * 100) / 100, // Round to 2 decimal places
      average_order_value: Math.round(avgOrderValue * 100) / 100,
      favorite_size: favoriteSize,
      favorite_pizza: favoritePizza,
      customer_since: user.iat ? new Date(user.iat * 1000).toISOString() : new Date().toISOString(),
      first_order: firstOrder.toISOString(),
      last_order: lastOrder.toISOString(),
      order_frequency_per_day: Math.round(orderFrequency * 1000) / 1000,
      profile_generated_at: new Date().toISOString(),
      data_source: 'dynamodb'
    };
  } catch (error) {
    console.error('Error generating customer profile from DynamoDB orders:', error);
    return {
      total_orders: orders.length || 0,
      total_spent: 0,
      customer_since: user.iat ? new Date(user.iat * 1000).toISOString() : new Date().toISOString(),
      error: 'Profile generation failed',
      data_source: 'dynamodb'
    };
  }
}

/**
 * Helper function to find most frequent item in array
 * @param {Array} arr - Array to analyze
 * @returns {string|null} Most frequent item
 */
function getMostFrequent(arr) {
  if (!arr.length) return null;
  
  const frequency = {};
  let maxCount = 0;
  let mostFrequent = null;
  
  arr.forEach(item => {
    if (item) {
      frequency[item] = (frequency[item] || 0) + 1;
      if (frequency[item] > maxCount) {
        maxCount = frequency[item];
        mostFrequent = item;
      }
    }
  });
  
  return mostFrequent;
}

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
    const orderId = `order_${Date.now()}`;
    const orderDate = date || new Date().toISOString();
    
    const order = {
      user_id: userId,
      order_id: orderId,
      pizza,
      size,
      total,
      created_at: orderDate,
      user_email: req.user.email,
      status: 'confirmed'
    };

    console.log('Storing order in DynamoDB:', { userId, orderId });
    
    // Store order in DynamoDB
    const putCommand = new PutCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Item: order
    });
    
    await docClient.send(putCommand);
    console.log('Order successfully stored in DynamoDB');

    // Include verification info in response for transparency
    const response = {
      success: true, 
      message: 'Order placed successfully',
      order: {
        id: orderId,
        pizza,
        size,
        total,
        date: orderDate,
        userId
      },
      storage: 'dynamodb',
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
    res.status(500).json({ 
      error: 'Failed to place order',
      details: error.message,
      storage: 'dynamodb'
    });
  }
});

app.get('/api/orders', verifyToken, verifyIdTokenClaims, requireEmailVerification, async (req, res) => {
  try {
    const userId = req.user.sub;
    
    console.log('Fetching orders from DynamoDB for user:', userId);
    
    // Query user orders from DynamoDB
    const queryCommand = new QueryCommand({
      TableName: DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'user_id = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ScanIndexForward: false // Sort by sort key (order_id) in descending order for latest first
    });
    
    const result = await docClient.send(queryCommand);
    const orders = result.Items || [];
    
    console.log(`Retrieved ${orders.length} orders from DynamoDB`);
    
    // Transform DynamoDB items to match frontend expected format
    const formattedOrders = orders.map(item => ({
      id: item.order_id,
      pizza: item.pizza,
      size: item.size,
      total: item.total,
      date: item.created_at,
      userId: item.user_id
    }));
    
    // Generate customer profile from DynamoDB data
    const customerProfile = generateCustomerProfileFromOrders(formattedOrders, req.user);
    
    // Include verification info in response
    res.json({ 
      orders: formattedOrders,
      storage: 'dynamodb',
      customer_profile: customerProfile,
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
    console.error('Error fetching orders from DynamoDB:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      details: error.message,
      storage: 'dynamodb'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// HTTPS Configuration
try {
  // Try to load SSL certificates
  const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.cert'))
  };
  
  // Create HTTPS server
  const server = https.createServer(sslOptions, app);
  
  server.listen(PORT, () => {
    console.log(`Pizza42 API server running on HTTPS port ${PORT}`);
    console.log(`SSL certificates loaded successfully`);
  });
  
} catch (error) {
  console.error('SSL certificates not found, falling back to HTTP:', error.message);
  console.log('Please ensure SSL certificates exist in backend/ssl/ directory');
  console.log('Creating self-signed certificates for development...');
  
  // For development, we'll still start the server but warn about missing SSL
  app.listen(PORT, () => {
    console.log(`Pizza42 API server running on HTTP port ${PORT} (SSL certificates missing)`);
    console.log('HTTPS is required for production deployment');
  });
}
