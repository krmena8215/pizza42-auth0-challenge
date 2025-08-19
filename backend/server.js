const express = require('express');
const cors = require('cors');
const { auth, requiredScopes } = require('express-oauth-server');
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

// JWT verification middleware
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Decode token to get header
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get the signing key
    const key = await client.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();

    // Verify token
    const payload = jwt.verify(token, signingKey, {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256']
    });

    req.user = payload;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid token' });
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

app.post('/api/orders', verifyToken, requireScope('place:orders'), async (req, res) => {
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

    res.json({ 
      success: true, 
      message: 'Order placed successfully',
      order: order
    });

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

app.get('/api/orders', verifyToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    
    // Get user orders from Auth0 profile
    const user = await management.getUser({ id: userId });
    const orders = user.user_metadata?.orders || [];
    
    res.json({ orders });
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
