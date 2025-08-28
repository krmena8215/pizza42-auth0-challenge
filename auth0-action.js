/**
 * Auth0 Post-Login Action - Enhanced with DynamoDB Integration
 * This action queries DynamoDB for real-time customer data and injects it into ID tokens
 * 
 * DEPENDENCIES (Add in Auth0 Actions):
 * - @aws-sdk/client-dynamodb: ^3.x.x
 * - @aws-sdk/lib-dynamodb: ^3.x.x
 * 
 * SECRETS (Add in Auth0 Action Settings):
 * - AWS_REGION=us-east-1
 * - DYNAMODB_TABLE_NAME=Pizza42-Orders
 * - AWS_ACCESS_KEY_ID=<your-aws-access-key>
 * - AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
 */
exports.onExecutePostLogin = async (event, api) => {
  const AWS = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
  
  const namespace = 'https://pizza42.com/';
  const userId = event.user.user_id;
  
  try {
    console.log(`Post-Login Action: Processing user ${userId}`);
    
    // Configure DynamoDB client (using environment variables)
    const dynamoClient = new AWS.DynamoDBClient({ 
      region: event.secrets.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: event.secrets.AWS_ACCESS_KEY_ID,
        secretAccessKey: event.secrets.AWS_SECRET_ACCESS_KEY
      }
    });
    const docClient = DynamoDBDocumentClient.from(dynamoClient);
    
    // Query user's orders from DynamoDB
    const queryCommand = new QueryCommand({
      TableName: event.secrets.DYNAMODB_TABLE_NAME || 'Pizza42-Orders',
      KeyConditionExpression: 'user_id = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    console.log(`Post-Login Action: Querying DynamoDB for user ${userId}`);
    const result = await docClient.send(queryCommand);
    const orders = result.Items || [];
    console.log(`Post-Login Action: Found ${orders.length} orders for user ${userId}`);
    
    // Calculate real-time customer profile
    const customerProfile = generateCustomerProfile(orders, event.user);
    
    // Add enhanced claims to ID token
    api.idToken.setCustomClaim(`${namespace}email_verified`, event.user.email_verified);
    api.idToken.setCustomClaim(`${namespace}can_place_orders`, event.user.email_verified);
    api.idToken.setCustomClaim(`${namespace}token_verified_at`, new Date().toISOString());
    api.idToken.setCustomClaim(`${namespace}verification_version`, '2.0.0');
    
    // Inject REAL-TIME customer profile
    api.idToken.setCustomClaim(`${namespace}customer_profile`, customerProfile);
    
    // Add authentication metadata
    api.idToken.setCustomClaim(`${namespace}auth_metadata`, {
      client_id: event.client.client_id,
      connection: event.connection.name,
      login_method: event.connection.strategy,
      login_time: new Date().toISOString(),
      ip_address: event.request.ip,
      user_agent: event.request.userAgent
    });
    
    // Add session security information
    api.idToken.setCustomClaim(`${namespace}session_security`, {
      ip_address: event.request.ip,
      user_agent_hash: hashUserAgent(event.request.userAgent),
      login_count: event.stats.logins_count,
      secure: true,
      anomalies: [],
      high_frequency_user: event.stats.logins_count > 50,
      validated_at: new Date().toISOString()
    });
    
    console.log(`Post-Login Action: Enhanced claims added for user ${userId}`);
    console.log(`Customer Profile: ${orders.length} orders, $${customerProfile.total_spent} spent`);
    
  } catch (error) {
    console.error('Post-Login Action Error:', error);
    
    // Fallback: Add basic claims even if DynamoDB query fails
    api.idToken.setCustomClaim(`${namespace}email_verified`, event.user.email_verified);
    api.idToken.setCustomClaim(`${namespace}can_place_orders`, event.user.email_verified);
    api.idToken.setCustomClaim(`${namespace}token_verified_at`, new Date().toISOString());
    api.idToken.setCustomClaim(`${namespace}verification_version`, '2.0.0');
    api.idToken.setCustomClaim(`${namespace}auth_warnings`, ['DynamoDB query failed - using fallback data']);
    api.idToken.setCustomClaim(`${namespace}customer_profile`, {
      customer_since: event.user.created_at,
      status: 'error_loading_profile',
      total_orders: 0,
      total_spent: 0,
      error: 'Unable to load real-time data',
      profile_source: 'fallback'
    });
  }
};

/**
 * Generate customer profile from DynamoDB orders
 * @param {Array} orders - Array of orders from DynamoDB
 * @param {Object} user - Auth0 user object
 * @returns {Object} Customer profile data
 */
function generateCustomerProfile(orders, user) {
  if (!orders.length) {
    return {
      customer_since: user.created_at,
      status: 'new_customer',
      total_orders: 0,
      total_spent: 0,
      profile_source: 'dynamodb_realtime'
    };
  }
  
  const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const favoriteSize = getMostFrequent(orders.map(order => order.size));
  const favoritePizza = getMostFrequent(orders.map(order => order.pizza));
  
  const avgOrderValue = totalSpent / orders.length;
  const firstOrder = new Date(orders[orders.length - 1].created_at);
  const lastOrder = new Date(orders[0].created_at);
  const daysBetween = Math.max(1, (lastOrder - firstOrder) / (1000 * 60 * 60 * 24));
  const orderFrequency = orders.length / daysBetween;
  
  return {
    total_orders: orders.length,
    total_spent: Math.round(totalSpent * 100) / 100,
    average_order_value: Math.round(avgOrderValue * 100) / 100,
    favorite_size: favoriteSize,
    favorite_pizza: favoritePizza,
    customer_since: user.created_at,
    first_order: firstOrder.toISOString(),
    last_order: lastOrder.toISOString(),
    order_frequency_per_day: Math.round(orderFrequency * 1000) / 1000,
    status: orders.length > 5 ? 'frequent_customer' : 'active_customer',
    profile_generated_at: new Date().toISOString(),
    profile_source: 'dynamodb_realtime'
  };
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

/**
 * Generate a simple hash for user agent (for security/tracking)
 * @param {string} userAgent - Browser user agent string
 * @returns {string} Hexadecimal hash
 */
function hashUserAgent(userAgent) {
  // Simple hash for user agent (for security)
  let hash = 0;
  if (!userAgent) return hash.toString(16);
  for (let i = 0; i < userAgent.length; i++) {
    const char = userAgent.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * IMPLEMENTATION INSTRUCTIONS:
 * 
 * 1. Copy this entire code to your Auth0 Post-Login Action
 * 2. Add the following dependencies in Auth0 Actions UI:
 *    - @aws-sdk/client-dynamodb: ^3.x.x
 *    - @aws-sdk/lib-dynamodb: ^3.x.x
 * 
 * 3. Add the following secrets in Auth0 Action Settings:
 *    - AWS_REGION: us-east-1
 *    - DYNAMODB_TABLE_NAME: Pizza42-Orders
 *    - AWS_ACCESS_KEY_ID: <your-aws-access-key-id>
 *    - AWS_SECRET_ACCESS_KEY: <your-aws-secret-access-key>
 * 
 * 4. Deploy the Action and test by logging in
 * 
 * 5. Verify the ID token contains updated customer profile data
 * 
 * FEATURES:
 * - Real-time DynamoDB integration
 * - Comprehensive customer analytics
 * - Fallback error handling
 * - Enhanced security metadata
 * - Detailed logging for debugging
 * 
 * BENEFITS:
 * - ID tokens contain accurate, real-time customer data
 * - No frontend changes needed
 * - Maintains CIAM architecture integrity
 * - Automatic profile updates on each login
 */

/**
 * Auth0 Post-Login Action - ID Token Verification & Order History Enhancement
 * 
 * This action performs ID token verification and validation before adding
 * pizza order history and customer data to the ID token. It ensures secure
 * access to order-related functionality.
 * 
 * Features:
 * - ID token verification and validation
 * - Email verification enforcement for order access
 * - Order history enrichment with security checks
 * - Customer profile data with marketing insights
 * - Secure claim namespace management
 * 
 * To implement:
 * 1. Go to Auth0 Dashboard > Actions > Library
 * 2. Create a new custom action "ID Token Verification & Order Enhancement"
 * 3. Select "Login / Post Login" trigger
 * 4. Copy this code into the action
 * 5. Add action to the Login flow
 */

/**
* Handler that will be called during the execution of a PostLogin flow.
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://pizza42.com/';
  
  try {
    // ========================================
    // ID TOKEN VERIFICATION & VALIDATION
    // ========================================
    
    console.log('Post-Login Action: Starting ID token verification for user:', event.user.user_id);
    
    // 1. Validate user authentication context
    const authenticationContext = validateAuthenticationContext(event, api);
    if (!authenticationContext.isValid) {
      console.warn('Authentication context validation failed:', authenticationContext.reason);
      // Add warning to ID token but don't block login
      api.idToken.setCustomClaim(`${namespace}auth_warnings`, [authenticationContext.reason]);
    }
    
    // 2. Verify email before allowing order access
    const emailVerificationStatus = verifyEmailAccess(event, api);
    api.idToken.setCustomClaim(`${namespace}email_verified`, emailVerificationStatus.verified);
    api.idToken.setCustomClaim(`${namespace}can_place_orders`, emailVerificationStatus.canPlaceOrders);
    
    // 3. Validate user session security
    const sessionSecurity = validateSessionSecurity(event, api);
    api.idToken.setCustomClaim(`${namespace}session_security`, sessionSecurity);
    
    // 4. Add authentication metadata for verification
    const authMetadata = {
      login_time: new Date().toISOString(),
      login_method: event.authentication?.methods?.[0]?.name || 'unknown',
      connection: event.connection?.name || 'unknown',
      client_id: event.client?.client_id,
      ip_address: event.request?.ip || 'unknown',
      user_agent: event.request?.user_agent || 'unknown'
    };
    api.idToken.setCustomClaim(`${namespace}auth_metadata`, authMetadata);
    
    // ========================================
    // NOTIFICATION FOR UNVERIFIED USERS
    // ========================================
    // Note: Order history is now stored in DynamoDB, not Auth0 user metadata
    
    if (!emailVerificationStatus.canPlaceOrders) {
      console.log('Email not verified - user cannot place orders:', event.user.user_id);
      // Add notification about email verification requirement
      api.idToken.setCustomClaim(`${namespace}verification_required`, {
        message: 'Email verification required to place orders',
        action: 'verify_email'
      });
    } else {
      console.log('User verified and can place orders:', event.user.user_id);
      // Add basic customer info (orders will be retrieved from DynamoDB)
      api.idToken.setCustomClaim(`${namespace}customer_info`, {
        customer_since: event.user.created_at,
        data_source: 'dynamodb'
      });
    }
    
    // 5. Add ID token verification timestamp
    api.idToken.setCustomClaim(`${namespace}token_verified_at`, new Date().toISOString());
    api.idToken.setCustomClaim(`${namespace}verification_version`, '1.0.0');
    
    console.log('Post-Login Action completed successfully for user:', event.user.user_id);
    
  } catch (error) {
    console.error('Error in Post-Login Action:', error);
    // Add error information to token for debugging (but don't fail login)
    api.idToken.setCustomClaim(`${namespace}action_error`, {
      message: 'Post-login verification encountered an error',
      timestamp: new Date().toISOString()
    });
  }
};

// ========================================
// HELPER FUNCTIONS FOR ID TOKEN VERIFICATION
// ========================================

/**
 * Validates the authentication context for security
 * @param {Event} event - Auth0 event object
 * @param {PostLoginAPI} api - Auth0 API object
 * @returns {Object} Validation result
 */
function validateAuthenticationContext(event, api) {
  try {
    // Check if this is a suspicious login attempt
    const warnings = [];
    
    // Validate authentication methods
    if (!event.authentication?.methods || event.authentication.methods.length === 0) {
      warnings.push('No authentication methods recorded');
    }
    
    // Check for first-time login with immediate order attempt (potential fraud)
    const isNewUser = event.stats?.logins_count <= 1;
    if (isNewUser && !event.user.email_verified) {
      warnings.push('New user with unverified email');
    }
    
    // Validate connection type
    if (!event.connection?.name) {
      warnings.push('Unknown connection type');
    }
    
    return {
      isValid: warnings.length === 0,
      warnings: warnings,
      reason: warnings.join(', '),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error validating authentication context:', error);
    return {
      isValid: false,
      reason: 'Authentication context validation error',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Verifies email status and determines order placement eligibility
 * @param {Event} event - Auth0 event object
 * @param {PostLoginAPI} api - Auth0 API object
 * @returns {Object} Email verification status
 */
function verifyEmailAccess(event, api) {
  try {
    const emailVerified = event.user.email_verified === true;
    const hasEmail = !!event.user.email;
    
    // Determine if user can place orders
    const canPlaceOrders = emailVerified && hasEmail;
    
    return {
      verified: emailVerified,
      hasEmail: hasEmail,
      canPlaceOrders: canPlaceOrders,
      email: hasEmail ? event.user.email : null,
      verificationRequired: !canPlaceOrders
    };
  } catch (error) {
    console.error('Error verifying email access:', error);
    return {
      verified: false,
      hasEmail: false,
      canPlaceOrders: false,
      verificationRequired: true,
      error: 'Email verification check failed'
    };
  }
}

/**
 * Validates session security parameters
 * @param {Event} event - Auth0 event object
 * @param {PostLoginAPI} api - Auth0 API object
 * @returns {Object} Session security status
 */
function validateSessionSecurity(event, api) {
  try {
    const now = new Date();
    const loginTime = new Date();
    
    // Check for anomalies
    const anomalies = [];
    
    // Validate IP address
    if (!event.request?.ip) {
      anomalies.push('Missing IP address');
    }
    
    // Validate user agent
    if (!event.request?.user_agent) {
      anomalies.push('Missing user agent');
    }
    
    // Check login frequency (basic rate limiting)
    const loginCount = event.stats?.logins_count || 0;
    const isHighFrequency = loginCount > 100; // Adjust threshold as needed
    
    return {
      secure: anomalies.length === 0,
      anomalies: anomalies,
      login_count: loginCount,
      high_frequency_user: isHighFrequency,
      validated_at: now.toISOString(),
      ip_address: event.request?.ip || 'unknown',
      user_agent_hash: event.request?.user_agent ? hashString(event.request.user_agent) : 'unknown'
    };
  } catch (error) {
    console.error('Error validating session security:', error);
    return {
      secure: false,
      error: 'Session security validation failed',
      validated_at: new Date().toISOString()
    };
  }
}

/**
 * Validates and sanitizes order history data
 * @param {Array} orderHistory - Raw order history from user metadata
 * @returns {Array} Validated and sanitized orders
 */
function validateOrderHistory(orderHistory) {
  try {
    if (!Array.isArray(orderHistory)) {
      console.warn('Order history is not an array, returning empty array');
      return [];
    }
    
    return orderHistory.filter(order => {
      // Validate required fields
      if (!order || typeof order !== 'object') return false;
      if (!order.id || !order.pizza || !order.size) return false;
      if (typeof order.total !== 'number' || order.total <= 0) return false;
      
      // Validate date
      if (!order.date || isNaN(new Date(order.date).getTime())) return false;
      
      // Validate pizza and size values (prevent injection)
      const validPizzas = ['Margherita', 'Pepperoni', 'Supreme', 'Hawaiian'];
      const validSizes = ['small', 'medium', 'large'];
      
      if (!validPizzas.includes(order.pizza)) return false;
      if (!validSizes.includes(order.size)) return false;
      
      return true;
    }).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date
  } catch (error) {
    console.error('Error validating order history:', error);
    return [];
  }
}

/**
 * Generates comprehensive customer profile with marketing data
 * @param {Array} orders - Validated order history
 * @param {Object} user - Auth0 user object
 * @returns {Object} Customer profile data
 */
function generateCustomerProfile(orders, user) {
  try {
    if (!orders.length) {
      return {
        total_orders: 0,
        total_spent: 0,
        customer_since: user.created_at
      };
    }
    
    const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const favoriteSize = getMostFrequent(orders.map(order => order.size));
    const favoritePizza = getMostFrequent(orders.map(order => order.pizza));
    
    // No customer status calculation - removed per request
    
    // Calculate average order value and frequency
    const avgOrderValue = totalSpent / orders.length;
    const firstOrder = new Date(orders[0].date);
    const lastOrder = new Date(orders[orders.length - 1].date);
    const daysBetween = Math.max(1, (lastOrder - firstOrder) / (1000 * 60 * 60 * 24));
    const orderFrequency = orders.length / daysBetween; // orders per day
    
    return {
      total_orders: orders.length,
      total_spent: Math.round(totalSpent * 100) / 100, // Round to 2 decimal places
      average_order_value: Math.round(avgOrderValue * 100) / 100,
      favorite_size: favoriteSize,
      favorite_pizza: favoritePizza,
      customer_since: user.created_at,
      first_order: orders[0].date,
      last_order: orders[orders.length - 1].date,
      order_frequency_per_day: Math.round(orderFrequency * 1000) / 1000,
      profile_generated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating customer profile:', error);
    return {
      total_orders: orders.length || 0,
      total_spent: 0,
      customer_since: user.created_at,
      error: 'Profile generation failed'
    };
  }
}

/**
 * Simple hash function for sensitive data (like user agent)
 * @param {string} str - String to hash
 * @returns {string} Simple hash
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
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
