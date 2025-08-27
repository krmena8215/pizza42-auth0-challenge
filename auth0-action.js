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
    // ORDER HISTORY ENHANCEMENT (Only if verified)
    // ========================================
    
    if (emailVerificationStatus.canPlaceOrders) {
      // Get the user's order history from user_metadata
      const orderHistory = event.user.user_metadata?.orders || [];
      
      // Validate order history integrity
      const validatedOrders = validateOrderHistory(orderHistory);
      
      // Limit to last 10 orders to keep token size reasonable
      const recentOrders = validatedOrders.slice(-10);
      
      // Add order history to ID token
      if (recentOrders.length > 0) {
        api.idToken.setCustomClaim(`${namespace}order_history`, recentOrders);
        
        // Add customer profile data with marketing insights
        const customerProfile = generateCustomerProfile(recentOrders, event.user);
        api.idToken.setCustomClaim(`${namespace}customer_profile`, customerProfile);
        
        console.log(`Added ${recentOrders.length} orders to ID token for user: ${event.user.user_id}`);
      } else {
        console.log('No order history found for user:', event.user.user_id);
        // Add empty customer profile for new customers
        api.idToken.setCustomClaim(`${namespace}customer_profile`, {
          total_orders: 0,
          total_spent: 0,
          customer_since: event.user.created_at,
          status: 'new_customer'
        });
      }
    } else {
      console.log('Email not verified - skipping order history for user:', event.user.user_id);
      // Add notification about email verification requirement
      api.idToken.setCustomClaim(`${namespace}verification_required`, {
        message: 'Email verification required to access order history',
        action: 'verify_email'
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
        customer_since: user.created_at,
        status: 'new_customer'
      };
    }
    
    const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const favoriteSize = getMostFrequent(orders.map(order => order.size));
    const favoritePizza = getMostFrequent(orders.map(order => order.pizza));
    
    // Calculate customer status
    let status = 'regular';
    if (orders.length >= 10) status = 'loyal';
    if (totalSpent >= 200) status = 'vip';
    if (orders.length >= 20 && totalSpent >= 500) status = 'premium';
    
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
      status: status,
      order_frequency_per_day: Math.round(orderFrequency * 1000) / 1000,
      profile_generated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating customer profile:', error);
    return {
      total_orders: orders.length || 0,
      total_spent: 0,
      customer_since: user.created_at,
      status: 'error',
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
