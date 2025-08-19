/**
 * Auth0 Action - Add Order History to ID Token
 * 
 * This action adds the user's pizza order history to their ID token
 * so it's available on the client side without additional API calls.
 * 
 * To implement:
 * 1. Go to Auth0 Dashboard > Actions > Library
 * 2. Create a new custom action "Add Order History"
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
    // Get the user's order history from user_metadata
    const orderHistory = event.user.user_metadata?.orders || [];
    
    // Limit to last 10 orders to keep token size reasonable
    const recentOrders = orderHistory.slice(-10);
    
    // Add order history to ID token
    if (recentOrders.length > 0) {
      api.idToken.setCustomClaim(`${namespace}order_history`, recentOrders);
      
      // Also add some marketing-useful data
      const totalSpent = recentOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const favoriteSize = getMostFrequent(recentOrders.map(order => order.size));
      const favoritePizza = getMostFrequent(recentOrders.map(order => order.pizza));
      
      api.idToken.setCustomClaim(`${namespace}customer_profile`, {
        total_orders: recentOrders.length,
        total_spent: totalSpent,
        favorite_size: favoriteSize,
        favorite_pizza: favoritePizza,
        customer_since: event.user.created_at
      });
    }
  } catch (error) {
    console.error('Error adding order history to token:', error);
    // Don't fail the login if this fails
  }
};

// Helper function to find most frequent item in array
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
