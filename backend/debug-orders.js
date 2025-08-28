const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

// DynamoDB client configuration
const dynamoClient = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'us-east-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'Pizza42-Orders';

/**
 * Generate customer profile from DynamoDB order data
 * @param {Array} orders - Array of orders from DynamoDB
 * @param {Object} user - Auth0 user object
 * @returns {Object} Customer profile data
 */
function generateCustomerProfileFromOrders(orders, user) {
  console.log('=== DEBUG: generateCustomerProfileFromOrders ===');
  console.log('Orders received:', JSON.stringify(orders, null, 2));
  console.log('Orders length:', orders.length);
  
  try {
    if (!orders.length) {
      console.log('No orders found, returning empty profile');
      return {
        total_orders: 0,
        total_spent: 0,
        customer_since: user.iat ? new Date(user.iat * 1000).toISOString() : new Date().toISOString()
      };
    }
    
    console.log('Processing orders...');
    const totalSpent = orders.reduce((sum, order, index) => {
      console.log(`Order ${index}:`, { total: order.total, type: typeof order.total });
      const orderTotal = order.total || 0;
      console.log(`Adding ${orderTotal} to sum ${sum}`);
      return sum + orderTotal;
    }, 0);
    
    console.log('Total spent calculated:', totalSpent);
    
    const favoriteSize = getMostFrequent(orders.map(order => order.size));
    const favoritePizza = getMostFrequent(orders.map(order => order.pizza));
    
    // Calculate average order value and frequency
    const avgOrderValue = totalSpent / orders.length;
    const firstOrder = new Date(orders[orders.length - 1].date); // Last in array (oldest)
    const lastOrder = new Date(orders[0].date); // First in array (newest)
    const daysBetween = Math.max(1, (lastOrder - firstOrder) / (1000 * 60 * 60 * 24));
    const orderFrequency = orders.length / daysBetween; // orders per day
    
    const profile = {
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
    
    console.log('Generated profile:', JSON.stringify(profile, null, 2));
    return profile;
    
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

async function testUserOrders() {
  try {
    const userId = 'auth0|68af87cdd97706fada16edb4';
    
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
    console.log('Raw DynamoDB result:', JSON.stringify(result, null, 2));
    
    // Transform DynamoDB items to match frontend expected format
    const formattedOrders = orders.map(item => {
      const formatted = {
        id: item.order_id,
        pizza: item.pizza,
        size: item.size,
        total: item.total,
        date: item.created_at,
        userId: item.user_id
      };
      console.log('Formatted order:', JSON.stringify(formatted, null, 2));
      return formatted;
    });
    
    console.log('All formatted orders:', JSON.stringify(formattedOrders, null, 2));
    
    // Generate customer profile from DynamoDB data
    const mockUser = { iat: Math.floor(Date.now() / 1000) - 86400 }; // 1 day ago
    const customerProfile = generateCustomerProfileFromOrders(formattedOrders, mockUser);
    
    console.log('Final customer profile:', JSON.stringify(customerProfile, null, 2));
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

testUserOrders();
