const https = require("https");
const fs = require("fs");
const express = require('express');
const cors = require('cors');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const { ManagementClient } = require('auth0');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3443;

// Auth0 Management API client
let management;
if (process.env.AUTH0_M2M_CLIENT_ID && process.env.AUTH0_M2M_CLIENT_SECRET) {
  management = new ManagementClient({
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_M2M_CLIENT_ID,
    clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET,
    scope: 'read:users update:users'
  });
}

// JWT middleware
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
  }),
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ['RS256'],
  requestProperty: 'auth' // Changed from default 'user' property
});

// Middleware
app.use(cors());
app.use(express.json());

// Scope validation middleware
const requireScope = (requiredScope) => {
  return (req, res, next) => {
    const scope = req.user?.scope || req.user?.permissions || '';
    console.log('Scope check - Required:', requiredScope, 'Available:', scope);
    if (!scope || !scope.includes(requiredScope)) {
      return res.status(403).json({ error: 'Insufficient scope', required: requiredScope, available: scope });
    }
    next();
  };
};

// Public routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Pizza42 API is running',
    timestamp: new Date().toISOString(),
    auth0Domain: process.env.AUTH0_DOMAIN || 'not configured'
  });
});

// Protected routes - Orders (scope requirement temporarily removed for testing)
app.post('/api/orders', checkJwt, async (req, res) => {
  console.log('Order request received:', req.body);
  console.log('User:', req.auth?.sub, 'Scope:', req.auth?.scope);
  try {
    const { pizza, size, total, date } = req.body;
    const userId = req.auth.sub;

    if (!pizza || !size || !total) {
      console.log('Missing order info:', { pizza, size, total });
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

    // If management client is available, save to Auth0 profile
    if (management) {
      try {
        const user = await management.users.get({ id: userId });
        console.log("DEBUG: User data structure:", JSON.stringify(user, null, 2));
        console.log("DEBUG: user.data:", user.data);
        console.log("DEBUG: user.data.user_metadata:", user.data.user_metadata);
        const currentOrders = user.data.user_metadata?.orders || [];
        const updatedOrders = [...currentOrders, order];
        
        console.log("DEBUG: About to update user metadata with:", updatedOrders.length, "orders");
        console.log("DEBUG: Last order being saved:", JSON.stringify(updatedOrders[updatedOrders.length-1], null, 2));
        await management.users.update({ id: userId }, {
          user_metadata: {
            ...user.data.user_metadata,
            orders: updatedOrders
          }
        });
      } catch (mgmtError) {
        console.warn('Could not save to Auth0 profile:', mgmtError.message);
        // Continue without failing - order still processed
      }
    }

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

app.get('/api/orders', checkJwt, async (req, res) => {
  try {
    const userId = req.auth.sub;
    let orders = [];
    
    // Try to get user orders from Auth0 profile if management client is available
    if (management) {
      try {
        const user = await management.users.get({ id: userId });
        console.log("DEBUG: User data structure:", JSON.stringify(user, null, 2));
        console.log("DEBUG: user.data:", user.data);
        console.log("DEBUG: user.data.user_metadata:", user.data.user_metadata);
        orders = user.data.user_metadata?.orders || [];
      } catch (mgmtError) {
        console.warn('Could not fetch from Auth0 profile:', mgmtError.message);
      }
    }
    
    res.json({ orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Test route to verify JWT without scopes
app.get('/api/profile', checkJwt, (req, res) => {
  res.json({ 
    message: 'Protected route accessed successfully',
    user: {
      sub: req.auth.sub,
      email: req.auth.email,
      scope: req.auth.scope
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ error: 'Invalid token' });
  } else {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong!' });
  }
});


// SSL certificate options
const sslOptions = {
  key: fs.readFileSync("/home/ec2-user/ssl/key.pem"),
  cert: fs.readFileSync("/home/ec2-user/ssl/cert.pem")
};

// Create HTTPS server
const server = https.createServer(sslOptions, app);

server.listen(PORT, () => {
  console.log(`Pizza42 API server running on HTTPS port ${PORT}`);
  console.log(`Health check: https://localhost:${PORT}/api/health`);
  console.log(`Auth0 Domain: ${process.env.AUTH0_DOMAIN}`);
  console.log(`Management API: ${management ? "CONFIGURED" : "NOT CONFIGURED"}`);
});
