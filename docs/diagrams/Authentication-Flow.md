# Authentication and Security Flow

This document describes the authentication and security flow in the Notification Service.

## Authentication Flow Diagram

```mermaid
flowchart TD
    A[Client Request] --> B{Has JWT?}
    B -->|No| C[Redirect to Auth]
    B -->|Yes| D[Extract Token]
    D --> E[Validate JWT]
    
    E -->|Invalid| F[Return 401 Unauthorized]
    F --> End1([End - Auth Failure])
    
    E -->|Valid| G[Extract Claims]
    G --> H[Add User Context]
    H --> I[Rate Limit Check]
    
    I -->|Limit Exceeded| J[Return 429 Too Many Requests]
    J --> End2([End - Rate Limited])
    
    I -->|Within Limit| K[Check Authorization]
    K -->|Unauthorized| L[Return 403 Forbidden]
    L --> End3([End - Access Denied])
    
    K -->|Authorized| M[Proceed to Service]
    M --> End4([End - Authorized Access])
    
    C --> N[Client Authenticates]
    N --> O[Generate JWT]
    O --> P[Return JWT to Client]
    P --> End5([End - Auth Token Returned])
```

## Authentication Sequence Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant Redis
    participant Service as Protected Service
    
    Note over Client, Auth: Authentication Flow
    
    Client->>Gateway: Request with JWT
    Gateway->>Auth: Validate JWT
    Auth->>Auth: Verify token signature
    Auth->>Auth: Check token expiration
    Auth-->>Gateway: Validation result
    
    alt Invalid Token
        Gateway-->>Client: 401 Unauthorized
    else Token Valid
        Gateway->>Auth: Extract user details
        Auth-->>Gateway: User context
        
        Gateway->>Redis: Check rate limits
        Redis-->>Gateway: Rate limit status
        
        alt Rate Limit Exceeded
            Gateway-->>Client: 429 Too Many Requests
        else Within Rate Limits
            Gateway->>Auth: Check permissions
            Auth-->>Gateway: Authorization result
            
            alt Unauthorized
                Gateway-->>Client: 403 Forbidden
            else Authorized
                Gateway->>Service: Forward request with user context
                Service-->>Gateway: Service response
                Gateway-->>Client: 200 OK with response
            end
        end
    end
```

## JWT Structure

```mermaid
classDiagram
    class JWT {
        +Header header
        +Payload payload
        +String signature
    }
    
    class Header {
        +String alg
        +String typ
    }
    
    class Payload {
        +String sub
        +String name
        +String[] roles
        +Number iat
        +Number exp
        +String jti
        +String iss
        +String aud
    }
    
    JWT "1" *-- "1" Header
    JWT "1" *-- "1" Payload
```

## Role-Based Access Control

```mermaid
graph TD
    A[Roles] --> B[Admin]
    A --> C[Service]
    A --> D[User]
    
    B --> B1[All Notifications]
    B --> B2[All Devices]
    B --> B3[Configuration]
    B --> B4[Analytics]
    
    C --> C1[Create Notifications]
    C --> C2[Check Status]
    
    D --> D1[Own Notifications]
    D --> D2[Own Devices]
    
    subgraph "Resource Types"
        N1[Notifications]
        N2[Devices]
        N3[System]
        N4[Analytics]
    end
    
    subgraph "Permissions"
        P1[Create]
        P2[Read]
        P3[Update]
        P4[Delete]
    end
    
    B1 -.-> P1 & P2 & P3 & P4
    B2 -.-> P1 & P2 & P3 & P4
    B3 -.-> P1 & P2 & P3 & P4
    B4 -.-> P2
    
    C1 -.-> P1
    C2 -.-> P2
    
    D1 -.-> P2
    D2 -.-> P1 & P2 & P3 & P4
```

## Security Implementations

```mermaid
flowchart TD
    subgraph "Transport Layer"
        TLS[TLS/HTTPS]
        CORS[CORS Policy]
    end
    
    subgraph "Authentication Layer"
        JWT[JWT Tokens]
        API_KEY[API Keys]
    end
    
    subgraph "Authorization Layer"
        RBAC[Role-Based Access Control]
        SCOPE[Token Scopes]
    end
    
    subgraph "Rate Limiting"
        IP[IP-Based Limits]
        User[User-Based Limits]
        API[API-Based Limits]
    end
    
    subgraph "Input Validation"
        Schema[Schema Validation]
        Sanitize[Input Sanitization]
    end
    
    subgraph "Logging & Monitoring"
        Auth_Log[Authentication Logs]
        Access_Log[Access Logs]
        Alert[Security Alerts]
    end
    
    Client --> TLS
    TLS --> CORS
    CORS --> JWT
    CORS --> API_KEY
    
    JWT --> RBAC
    API_KEY --> SCOPE
    
    RBAC --> IP
    SCOPE --> IP
    IP --> User
    User --> API
    
    API --> Schema
    Schema --> Sanitize
    
    Sanitize --> Auth_Log
    Sanitize --> Access_Log
    Auth_Log --> Alert
    Access_Log --> Alert
```

## Authentication States

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated: Initial state
    
    Unauthenticated --> Authenticating: Login attempt
    Authenticating --> Unauthenticated: Failed login
    Authenticating --> Authenticated: Successful login
    
    Authenticated --> TokenRefresh: Token near expiry
    TokenRefresh --> Authenticated: New token issued
    TokenRefresh --> SessionExpired: Refresh token expired
    
    Authenticated --> SessionExpired: Token expired
    Authenticated --> LoggedOut: User logout
    
    SessionExpired --> Unauthenticated: Redirect to login
    LoggedOut --> Unauthenticated: Clear token
    
    Authenticated --> [*]: User completes session
    LoggedOut --> [*]: End session
```

## Service-to-Service Authentication

```mermaid
sequenceDiagram
    participant ServiceA as Service A
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant ServiceB as Service B
    
    ServiceA->>Auth: Request service token
    Auth->>Auth: Validate service credentials
    Auth->>Auth: Generate limited-scope JWT
    Auth-->>ServiceA: Service JWT
    
    ServiceA->>Gateway: Request to ServiceB with JWT
    Gateway->>Auth: Validate service JWT
    Auth-->>Gateway: Valid token, service permissions
    Gateway->>ServiceB: Forward request
    ServiceB-->>ServiceA: Response
```

## Rate Limiting Implementation

```mermaid
graph TD
    A[Request] --> B[Extract Identifier]
    B -->|API Key| C[Service Limiter]
    B -->|User ID| D[User Limiter]
    B -->|IP Address| E[IP Limiter]
    
    C --> F{Check Redis Counter}
    D --> F
    E --> F
    
    F -->|Limit Exceeded| G[Return 429]
    G --> H[Add Retry-After Header]
    
    F -->|Within Limit| I[Increment Counter]
    I --> J[Set TTL if New Key]
    J --> K[Process Request]
    
    subgraph "Redis Implementation"
        R1[key: "rate:ip:192.168.1.1:api/notifications"]
        R2[value: "5"]
        R3[ttl: "60 seconds"]
    end
```

## Auth Middleware Implementation

```typescript
/**
 * Example JWT authentication middleware implementation
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Extract token from header
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        throw new UnauthorizedException('Missing authorization header');
      }
      
      const token = authHeader.split(' ')[1];
      
      if (!token) {
        throw new UnauthorizedException('Invalid authorization format');
      }
      
      // Validate token
      const payload = await this.authService.validateToken(token);
      
      // Check if token is about to expire and add refresh header if needed
      const expiresIn = (payload.exp * 1000) - Date.now();
      if (expiresIn < 300000) { // Less than 5 minutes
        res.setHeader('X-Token-Refresh', 'true');
      }
      
      // Add user info to request
      req['user'] = payload;
      
      // Check rate limits
      const rateLimitResult = await this.rateLimit.checkLimit(
        payload.sub,
        req.path,
        req.method
      );
      
      if (!rateLimitResult.allowed) {
        res.setHeader('Retry-After', rateLimitResult.retryAfter.toString());
        throw new HttpException('Rate limit exceeded', 429);
      }
      
      // Proceed to next middleware/handler
      next();
    } catch (error) {
      // Handle different types of errors
      if (error instanceof UnauthorizedException) {
        throw error;
      } else if (error instanceof HttpException) {
        throw error;
      } else {
        throw new UnauthorizedException('Invalid token');
      }
    }
  }
}
``` 