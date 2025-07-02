# Authentication System Documentation

## Overview

This comprehensive authentication system provides both traditional email/password and Web3 wallet authentication for the blockchain dApp. It integrates with all existing backend API endpoints and includes multi-tenant support.

## Features

### 🔐 Dual Authentication Methods
- **Traditional Login**: Email and password authentication
- **Web3 Wallet**: MetaMask integration with challenge-response signature verification

### 🏢 Multi-Tenant Support
- Tenant ID input for multi-tenant applications
- Tenant-aware API requests with `X-Tenant-ID` header

### 📊 Real-Time Dashboard
- User profile and statistics
- Activity monitoring
- Session management
- Security event tracking
- Admin endpoints for tenant activity
- Web3 transaction history

### 🎨 Modern UI/UX
- Responsive Tailwind CSS design
- Loading states and error handling
- Real-time API testing dashboard
- Role-based interface (admin vs user)

## File Structure

```
frontend/src/
├── contexts/
│   └── AuthContext.js          # Authentication context and API integration
├── components/
│   ├── AuthApp.jsx             # Main authentication application
│   └── auth/
│       ├── LoginForm.jsx       # Traditional and wallet login forms
│       ├── Dashboard.jsx       # User dashboard with API testing
│       └── WalletConnector.jsx # Web3 wallet connection component
└── App.js                      # Updated with AuthProvider and routes
```

## API Integration

The system integrates with these backend endpoints:

### Authentication Endpoints
- `POST /api/auth/login` - Traditional login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/wallet-challenge` - Get wallet challenge
- `POST /api/auth/wallet-verify` - Verify wallet signature
- `GET /api/auth/verify` - Verify token validity

### User Data Endpoints
- `GET /api/auth/profile` - Get user profile
- `GET /api/auth/stats` - Get user statistics
- `GET /api/auth/activity` - Get user activity
- `GET /api/auth/sessions` - Get active sessions
- `GET /api/auth/security-events` - Get security events

### Admin Endpoints
- `GET /api/tenants/activity` - Get tenant activity (admin)

### Web3 Endpoints
- `GET /api/web3/transactions` - Get blockchain transactions

## Usage

### 1. Access the Authentication System

Navigate to `/auth` in your application to access the authentication interface.

### 2. Traditional Login

1. Enter your tenant ID (optional)
2. Select "Email & Password" tab
3. Enter your email and password
4. Click "Sign In"

### 3. Web3 Wallet Login

1. Enter your tenant ID (optional)
2. Select "Web3 Wallet" tab
3. Click "Connect MetaMask"
4. Approve the connection in MetaMask
5. Sign the challenge message
6. Authentication complete!

### 4. Dashboard Features

Once authenticated, you can:

- **View Profile**: See your user information and wallet details
- **Monitor Activity**: Track login history and user actions
- **Manage Sessions**: View and manage active sessions
- **Security Events**: Monitor security-related activities
- **API Testing**: Test all backend endpoints in real-time
- **Admin Features**: Access tenant activity (if admin role)
- **Web3 Data**: View blockchain transactions

## Configuration

### Environment Variables

Set these environment variables in your `.env` file:

```env
REACT_APP_API_URL=http://localhost:3001
```

### Dependencies

The system requires these additional dependencies:

```json
{
  "lucide-react": "^0.468.0",
  "ethers": "^6.14.4"
}
```

## Security Features

### JWT Token Management
- Automatic token storage in localStorage
- Token verification on app startup
- Automatic logout on token expiration

### Wallet Security
- Challenge-response authentication
- Signature verification
- Network validation

### Multi-Tenant Isolation
- Tenant ID headers on all requests
- Tenant-aware data filtering
- Role-based access control

## Error Handling

The system includes comprehensive error handling:

- **Network Errors**: Connection issues and timeouts
- **Authentication Errors**: Invalid credentials or signatures
- **Wallet Errors**: MetaMask not installed or connection issues
- **API Errors**: Backend service errors
- **Validation Errors**: Form validation and data format issues

## Customization

### Styling
The UI is built with Tailwind CSS and can be customized by modifying the component classes.

### API Endpoints
Update the `API_BASE_URL` in `AuthContext.js` to point to your backend.

### Authentication Flow
Modify the authentication logic in `AuthContext.js` to match your backend requirements.

## Testing

### API Testing Dashboard
The dashboard includes a built-in API testing tool that:
- Tests all endpoints
- Shows response status and data
- Validates authentication
- Provides real-time feedback

### Manual Testing
1. Start your backend server
2. Navigate to `/auth`
3. Test both authentication methods
4. Verify dashboard functionality
5. Test API endpoints

## Troubleshooting

### Common Issues

1. **MetaMask Not Found**
   - Ensure MetaMask is installed
   - Check if running on HTTPS (required for MetaMask)

2. **API Connection Errors**
   - Verify backend server is running
   - Check `REACT_APP_API_URL` environment variable
   - Ensure CORS is configured on backend

3. **Authentication Failures**
   - Check tenant ID if required
   - Verify user exists in database
   - Check wallet signature verification

4. **Token Issues**
   - Clear localStorage and re-authenticate
   - Check token expiration
   - Verify JWT secret configuration

## Development

### Adding New Features

1. **New API Endpoints**: Add methods to `AuthContext.js`
2. **UI Components**: Create new components in `components/auth/`
3. **Dashboard Tabs**: Add new tabs to the dashboard
4. **Authentication Methods**: Extend the auth context

### Code Structure

- **Context**: Business logic and API calls
- **Components**: UI and user interaction
- **Hooks**: Reusable authentication logic
- **Utils**: Helper functions and utilities

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the API documentation
3. Test with the built-in API testing tool
4. Check browser console for errors

## License

This authentication system is part of the blockchain dApp project. 