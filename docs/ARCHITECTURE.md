# Pizza42 Architecture Documentation

## Complete System Architecture

The Pizza42 application implements a comprehensive Auth0 CIAM solution with AWS DynamoDB integration, featuring advanced security, customer analytics, and scalable infrastructure.

## Architecture Diagram

```mermaid
graph TB
    User[Customer Browser] -->|HTTPS| Frontend[React SPA<br/>Port 3000<br/>Auth0 SDK + HTTPS]
    
    Frontend -->|Auth Flow| Auth0[Auth0 Platform<br/>- Email/Password Auth<br/>- Google Social Login<br/>- Email Verification<br/>- Post-Login Actions<br/>- Custom Claims]
    
    Auth0 -->|ID Token + Claims| Frontend
    Frontend -->|ID Token| Backend[Node.js API<br/>Port 3001<br/>Express + HTTPS]
    
    Backend -->|JWKS Validation| Auth0
    Backend -->|Verify Claims| EmailMW[Email Verification<br/>Middleware]
    
    Backend -->|IAM Role| DynamoDB[(DynamoDB<br/>Pizza42-Orders Table<br/>PK: user_id<br/>SK: order_id)]
    
    Backend -->|Customer Analytics| Analytics[Profile Generation<br/>- Total Orders<br/>- Favorite Pizza<br/>- Spending Analytics<br/>- Order Frequency]
    
    subgraph "AWS Cloud"
        EC2[EC2 Instance<br/>t3.medium<br/>- PM2 Process Manager<br/>- SSL Certificates<br/>- IAM Role]
        IAM[IAM Role<br/>EC2-DynamoDB-Access<br/>DynamoDB Full Access]
        DynamoDB
        EC2 -.->|Assumes| IAM
        IAM -.->|Grants Access| DynamoDB
    end
    
    Backend -.->|Runs on| EC2
    Frontend -.->|Runs on| EC2
    
    subgraph "Security Features"
        HTTPS[HTTPS Everywhere]
        JWT[JWT RS256 Validation]
        EmailVerif[Email Verification]
        Scopes[Flexible Scope Validation]
    end
    
    classDef authService fill:#ff6b6b
    classDef database fill:#4ecdc4
    classDef frontend fill:#45b7d1
    classDef backend fill:#f9ca24
    classDef aws fill:#ff9f43
    
    class Auth0 authService
    class DynamoDB database
    class Frontend frontend
    class Backend backend
    class EC2,IAM aws
```

## Component Deep Dive

### Authentication & Authorization Layer

#### Auth0 Platform Configuration
- **Applications**: 
  - SPA Application (9wcggjvPlN5kfGfqgYG5ksqKmGlbE43e)
  - API Identifier (https://pizza42-api)
  - M2M Application for Management API access
- **Connections**: Database (email/password) + Google Social
- **Post-Login Actions**: Custom claims injection for email verification and customer profiling
- **Security**: PKCE flow, RS256 JWT validation, proper audience verification

#### Token Strategy
```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as Auth0
    participant B as Backend
    participant D as DynamoDB
    
    U->>F: Login Request
    F->>A: PKCE Auth Flow
    A->>A: Validate Credentials
    A->>A: Execute Post-Login Action
    A-->>F: ID Token + Custom Claims
    
    Note over A,F: Claims Include:<br/>- email_verified<br/>- can_place_orders<br/>- customer_profile<br/>- auth_metadata
    
    F->>B: API Request (Bearer ID Token)
    B->>A: Validate Token (JWKS)
    B->>B: Extract Custom Claims
    B->>B: Email Verification Check
    
    alt Email Verified & Claims Valid
        B->>D: Store/Retrieve Order Data
        D-->>B: Operation Result
        B-->>F: Success Response
    else Email Not Verified
        B-->>F: 403 Email Verification Required
    end
```

### Order Management System

#### DynamoDB Schema
```json
{
  "TableName": "Pizza42-Orders",
  "KeySchema": [
    {
      "AttributeName": "user_id",
      "KeyType": "HASH"
    },
    {
      "AttributeName": "order_id", 
      "KeyType": "RANGE"
    }
  ],
  "AttributeDefinitions": [
    {
      "AttributeName": "user_id",
      "AttributeType": "S"
    },
    {
      "AttributeName": "order_id",
      "AttributeType": "S"
    }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
```

#### Order Processing Flow
```mermaid
flowchart TD
    A[Order Request] --> B{Email Verified?}
    B -->|No| C[403 Forbidden]
    B -->|Yes| D[Generate Order ID]
    D --> E[Create Order Object]
    E --> F[DynamoDB PutCommand]
    F --> G{Storage Success?}
    G -->|No| H[500 Server Error]
    G -->|Yes| I[Generate Customer Profile]
    I --> J[Return Success Response]
    
    style A fill:#e1f5fe
    style C fill:#ffebee
    style H fill:#ffebee
    style J fill:#e8f5e8
```

### Customer Analytics Engine

#### Real-time Profile Generation
The system dynamically generates customer profiles from order data:

```javascript
// Example Generated Profile
{
  total_orders: 15,
  total_spent: 342.50,
  average_order_value: 22.83,
  favorite_size: "large",
  favorite_pizza: "Supreme",
  customer_since: "2025-08-15T10:30:00Z",
  first_order: "2025-08-15T10:30:00Z",
  last_order: "2025-08-27T22:53:18Z",
  order_frequency_per_day: 1.25,
  profile_generated_at: "2025-08-27T22:53:20Z",
  data_source: "dynamodb"
}
```

### Infrastructure as Code

#### AWS Resources Created
1. **IAM Role**: EC2-DynamoDB-Access-Role
2. **Instance Profile**: EC2-DynamoDB-Instance-Profile  
3. **DynamoDB Table**: Pizza42-Orders
4. **EC2 Instance**: i-0220be9bac6efe146

#### Process Management
- **PM2 Configuration**: Auto-restart, logging, cluster mode ready
- **Environment Management**: Separate dev/prod configurations
- **SSL Implementation**: Self-signed certificates for development/demo

### Security Implementation

#### Multi-layer Security Strategy
1. **Transport Layer**: HTTPS/TLS for all communications
2. **Authentication**: Auth0 with social login and MFA ready
3. **Authorization**: JWT validation with custom claims
4. **Data Protection**: IAM roles, no hardcoded credentials
5. **Email Verification**: Mandatory before sensitive operations
6. **Token Security**: RS256 algorithm, JWKS validation, proper audiences

## Performance & Scalability

### Current Capacity
- **Frontend**: React dev server (easily upgradable to production build)
- **Backend**: Single Node.js process (PM2 cluster mode ready)
- **Database**: DynamoDB pay-per-request (auto-scaling)

### Scalability Enhancements
```mermaid
graph LR
    A[Current Setup] --> B[Load Balancer]
    B --> C[Multiple EC2 Instances]
    C --> D[Container Orchestration]
    D --> E[Microservices Architecture]
    
    F[DynamoDB] --> G[Global Tables]
    G --> H[Multi-region Setup]
    
    I[PM2 Single Process] --> J[PM2 Cluster Mode]
    J --> K[Docker Containers]
    K --> L[ECS/EKS]
```

## API Endpoints

### Authentication Endpoints
- **Health Check**: `GET /api/health`
- **Token Verification**: `GET /api/verify-token`

### Order Management Endpoints  
- **Place Order**: `POST /api/orders`
- **Get Orders**: `GET /api/orders`

### Middleware Pipeline
```mermaid
graph LR
    A[Request] --> B[verifyToken]
    B --> C[verifyIdTokenClaims]
    C --> D[requireEmailVerification]
    D --> E[requireScope optional]
    E --> F[Route Handler]
    F --> G[Response]
```

## Environment Configuration

### Production Environment Variables
```bash
# Auth0 Configuration
AUTH0_DOMAIN=dev-if2hx088kpqzkcd7.us.auth0.com
AUTH0_AUDIENCE=https://pizza42-api
AUTH0_CLIENT_ID=9wcggjvPlN5kfGfqgYG5ksqKmGlbE43e

# Auth0 Management API
AUTH0_M2M_CLIENT_ID=gOKXTR5jOkh01QXzFpBxmMqyExycMdVW
AUTH0_M2M_CLIENT_SECRET=***

# AWS DynamoDB Configuration
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=Pizza42-Orders

# Server Configuration
PORT=3001
```

## Future Enhancements

### Recommended Next Steps
1. **Production Build**: Replace dev servers with production builds
2. **Load Balancer**: Add ALB/CloudFront for high availability
3. **Monitoring**: CloudWatch dashboards and alerts
4. **CI/CD Pipeline**: Automated deployment pipeline
5. **Security**: WAF, VPC, KMS encryption
6. **Performance**: CloudFront CDN, API caching
7. **Microservices**: Split into order service, user service, analytics service

---

*This architecture demonstrates enterprise-grade Auth0 CIAM integration with modern AWS services, designed for scalability and security.*
