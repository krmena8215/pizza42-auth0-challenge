# DynamoDB Storage Implementation

## Overview

This branch (`feature/dynamodb-storage`) implements DynamoDB as the primary data store for customer orders, replacing Auth0 user metadata storage while maintaining the same authentication and token verification flow.

## Infrastructure Changes

### DynamoDB Table
- **Table Name**: `Pizza42-Orders`
- **Primary Key**: 
  - Hash Key: `user_id` (String) - Auth0 user ID
  - Range Key: `order_id` (String) - Unique order identifier
- **Billing Mode**: Pay-per-request (on-demand)
- **Region**: us-east-1

### Table Schema
```json
{
  "user_id": "auth0|12345...",          // Auth0 user ID (Hash Key)
  "order_id": "order_1640995200000",    // Unique order ID (Range Key)
  "pizza": "Margherita",                // Pizza type
  "size": "medium",                     // Pizza size
  "total": 16.99,                       // Order total
  "created_at": "2025-01-01T12:00:00Z", // Order timestamp
  "user_email": "user@example.com",     // User email
  "status": "confirmed"                 // Order status
}
```

## Backend Changes

### Dependencies Added
```bash
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Environment Variables
```bash
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=Pizza42-Orders
```

### API Changes

#### POST /api/orders
- Now stores orders in DynamoDB using `PutCommand`
- Returns `"storage": "dynamodb"` in response
- Same authentication and validation middleware

#### GET /api/orders
- Retrieves orders from DynamoDB using `QueryCommand`
- Sorts by order_id descending (latest first)
- Generates customer profile from DynamoDB data
- Returns `"storage": "dynamodb"` and `customer_profile` in response

### New Features
- **Real-time customer analytics**: Profile generated from live DynamoDB data
- **Scalable storage**: DynamoDB handles high-volume order data
- **Data source transparency**: API responses indicate "dynamodb" storage
- **Query performance**: Efficient user-based order retrieval

## Auth0 Changes

### Post-Login Action Updates
- Removed order history logic from Auth0 user metadata
- Simplified to basic user verification and claim injection
- Added `customer_info` claim with `data_source: "dynamodb"`
- Maintains same ID token verification flow

### Token Claims
- `https://pizza42.com/can_place_orders`: Email verification status
- `https://pizza42.com/customer_info`: Basic customer info
- `https://pizza42.com/verification_required`: Email verification notice

## Frontend Compatibility

The frontend remains unchanged - it still:
- Uses the same API endpoints (`/api/orders`)
- Receives orders in the same format
- Displays customer profile data
- Maintains ID token verification UI

## Authentication Flow

1. **Login** → Auth0 Post-Login Action adds verification claims to ID token
2. **Order Placement** → Backend verifies token, stores in DynamoDB
3. **Order Retrieval** → Backend verifies token, queries DynamoDB
4. **Customer Analytics** → Generated in real-time from DynamoDB data

## Deployment Notes

### Prerequisites
1. DynamoDB table created with proper IAM permissions
2. EC2 instance role has DynamoDB access policy attached
3. Environment variables configured in backend

### IAM Policy Required
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem", 
        "dynamodb:Query",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:*:table/Pizza42-Orders"
      ]
    }
  ]
}
```

## Benefits

### Scalability
- DynamoDB handles millions of orders
- Pay-per-request billing scales with usage
- No Auth0 user metadata size limits

### Performance  
- Efficient queries by user_id
- Real-time customer profile generation
- Reduced Auth0 Management API calls

### Analytics
- Rich customer insights from order data
- Marketing-ready analytics
- Historical order tracking

### Security
- Same token verification flow
- Orders tied to verified Auth0 user IDs
- Audit trail of all order operations

## Testing

### API Endpoints
```bash
# Health check
curl -k https://52.90.154.69:3443/api/health

# Place order (requires valid Auth0 token)
curl -k -X POST https://52.90.154.69:3443/api/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pizza":"Margherita","size":"medium","total":16.99}'

# Get orders (requires valid Auth0 token)  
curl -k https://52.90.154.69:3443/api/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Expected Responses
All API responses now include:
- `"storage": "dynamodb"` - Indicates data source
- `customer_profile` - Real-time analytics from DynamoDB
- Same order format for frontend compatibility

## Summary

This implementation successfully migrates order storage from Auth0 user metadata to DynamoDB while maintaining:
- ✅ Same authentication and authorization flow
- ✅ Same API interface for frontend
- ✅ Enhanced scalability and performance
- ✅ Real-time customer analytics
- ✅ Full Auth0 ID token verification

The change is transparent to users but provides significant infrastructure improvements for handling customer order data at scale.
