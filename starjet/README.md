# 🚀 Star Jet - Business Management System

A comprehensive business management system for sales tracking, expense management, and financial reporting.

## 🌟 Features

### 🔐 Security & Authentication
- **JWT-based authentication** with Supabase
- **Role-based access control** (Admin, Salesman, Accountant)
- **Session management** with automatic timeout
- **Rate limiting** protection
- **XSS protection** and input sanitization

### 📊 Business Management
- **Sales Management**: Add, edit, track, and delete sales
- **Expense Tracking**: Record and categorize business expenses
- **Capital Management**: Set and monitor business capital
- **Financial Reports**: Statistics and analytics dashboard
- **Invoice/Quotation**: Generate professional documents

### 🎨 User Experience
- **Modern UI/UX** with responsive design
- **Toast notifications** for user feedback
- **Real-time updates** with live data synchronization
- **Professional navigation** with role-based menus

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Security**: JWT, CORS, Rate Limiting

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd starjet
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   # Copy environment template
   cp server.env.production.example server.env
   
   # Edit with your Supabase credentials
   nano server.env
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm run prod
   ```

5. **Access the application**
   - Open `http://localhost:3000` in your browser
   - Login with your credentials

## 🔧 Configuration

### Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# Server Configuration
PORT=3000
NODE_ENV=production

# Security Configuration
ALLOWED_ORIGINS=https://yourdomain.com
```

### Production Deployment

1. **Set up production environment**
   ```bash
   cp server.env.production.example server.env.production
   # Edit with production values
   ```

2. **Configure domain and SSL**
   - Point your domain to your server
   - Set up SSL certificate (HTTPS required)

3. **Start production server**
   ```bash
   NODE_ENV=production npm start
   ```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/user/profile` - Get user profile

### Sales Management
- `GET /api/sales` - Get all sales
- `POST /api/sales` - Create new sale
- `PUT /api/sales/:id` - Update sale
- `DELETE /api/sales/:id` - Delete sale

### Expense Management
- `GET /api/expenses` - Get all expenses
- `POST /api/expenses` - Create new expense
- `DELETE /api/expenses/:id` - Delete expense

### System Management
- `GET /api/health` - Health check
- `GET /api/capital-settings` - Get capital settings
- `POST /api/capital-settings` - Update capital settings

## 🔒 Security Features

### Authentication & Authorization
- JWT token-based authentication
- Role-based access control
- Session timeout management
- Secure password handling

### API Security
- Rate limiting (100 requests/15min in production)
- CORS configuration
- Input validation and sanitization
- Error handling without information leakage

### Data Protection
- XSS protection on all inputs
- SQL injection prevention
- Secure data transmission (HTTPS)
- Audit logging for all operations

## 📈 Monitoring & Maintenance

### Health Monitoring
- Health check endpoint: `/api/health`
- Performance metrics logging
- Error tracking and alerting
- Uptime monitoring

### Backup Strategy
- Regular database backups
- Configuration file backups
- Code version control
- Disaster recovery plan

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check `ALLOWED_ORIGINS` configuration
   - Verify domain settings

2. **Authentication Failures**
   - Verify Supabase credentials
   - Check session token validity

3. **API Connection Issues**
   - Verify server URL configuration
   - Check network connectivity

### Debug Mode
- Development mode shows detailed logs
- Production mode shows only essential logs
- Use browser developer tools for client-side debugging

## 📞 Support

For technical support:
1. Check server logs for error messages
2. Verify environment variable configuration
3. Test API endpoints individually
4. Review browser console for client-side errors

## 📄 License

This project is licensed under the MIT License.

---

**Version**: 2.0.0  
**Last Updated**: 2024  
**Status**: Production Ready ✅
