const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: './server.env' });

// Simple rate limiting for production
const rateLimit = require('express-rate-limit');

// CSRF protection
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Rate limiting for production
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: NODE_ENV === 'production' ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Enhanced rate limiting for login endpoint
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        error: 'Too many login attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
});

// CSRF token storage (in production, use Redis or database)
const csrfTokens = new Map();

// CSRF protection middleware
const csrfProtection = (req, res, next) => {
    if (req.method === 'GET') {
        // Generate CSRF token for forms
        const token = crypto.randomBytes(32).toString('hex');
        csrfTokens.set(token, Date.now());

        // Clean up old tokens (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [oldToken, timestamp] of csrfTokens.entries()) {
            if (timestamp < oneHourAgo) {
                csrfTokens.delete(oldToken);
            }
        }

        res.locals.csrfToken = token;
        next();
    } else {
        // Validate CSRF token for POST/PUT/DELETE requests
        const token = req.headers['x-csrf-token'] || req.body._csrf;

        if (!token || !csrfTokens.has(token)) {
            return res.status(403).json({ error: 'Invalid CSRF token' });
        }

        // Remove used token
        csrfTokens.delete(token);
        next();
    }
};

// Security headers middleware
app.use((req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // HTTPS enforcement in production
    if (NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

        // Redirect HTTP to HTTPS
        if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
            return res.redirect(`https://${req.get('host')}${req.url}`);
        }
    }

    // Remove server information
    res.removeHeader('X-Powered-By');

    next();
});

// Middleware
app.use(cors({
    origin: NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']
        : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5501', 'http://127.0.0.1:5501'],
    credentials: true
}));
app.use(express.json());
// Serve static files (HTML, CSS, JS, images)
app.use(express.static('.', {
    setHeaders: (res, path) => {
        // Set security headers for static files
        if (path.endsWith('.html')) {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
        }
    }
}));

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve login.html for /login path
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Initialize Supabase client with network resilience
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: false,
            detectSessionInUrl: false
        },
        global: {
            headers: {
                'X-Client-Info': 'starjet-server'
            }
        }
    }
);

// Authentication middleware
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Set the session token for this request with timeout
        const { data: { user }, error } = await Promise.race([
            supabase.auth.getUser(token),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Authentication timeout')), 10000)
            )
        ]);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        console.error('🔐 Authentication error:', {
            timestamp: new Date().toISOString(),
            error: error.message,
            code: error.code || 'UNKNOWN'
        });

        // Handle specific network errors
        if (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message.includes('timeout')) {
            return res.status(503).json({
                error: 'Authentication service temporarily unavailable. Please try again.'
            });
        }

        res.status(500).json({ error: 'Authentication failed' });
    }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '2.0.0'
    };
    res.json(health);
});

// CSRF token endpoint
app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: res.locals.csrfToken });
});

// Connection test endpoint
app.get('/api/connection-test', async (req, res) => {
    try {
        const startTime = Date.now();

        // Test Supabase connection
        const { data, error } = await supabase
            .from('profiles')
            .select('count')
            .limit(1);

        const responseTime = Date.now() - startTime;

        res.json({
            status: 'connected',
            supabase: error ? 'error' : 'connected',
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString(),
            error: error ? error.message : null
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'Star Jet API Server is running!', status: 'success' });
});

// Test DELETE endpoint
app.delete('/api/test-delete', (req, res) => {
    res.json({ message: 'DELETE endpoint is working!', status: 'success' });
});

// Test PUT endpoint
app.put('/api/test-put', (req, res) => {
    res.json({ message: 'PUT endpoint is working!', status: 'success', data: req.body });
});

// Authentication endpoint with enhanced security
app.post('/api/auth/login', loginLimiter, csrfProtection, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Additional input validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Password length validation
        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({ error: 'Invalid password format' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('🔐 Login error:', {
                timestamp: new Date().toISOString(),
                email: email.substring(0, 3) + '***', // Log partial email for security
                error: error.message
            });
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Log successful login
        console.log('🔐 Successful login:', {
            timestamp: new Date().toISOString(),
            userId: data.user.id,
            email: data.user.email?.substring(0, 3) + '***'
        });

        res.json({ user: data.user, session: data.session });
    } catch (error) {
        console.error('🔐 Login server error:', {
            timestamp: new Date().toISOString(),
            error: error.message
        });
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Registration endpoint with enhanced security
app.post('/api/auth/register', loginLimiter, csrfProtection, async (req, res) => {
    try {
        const { email, password, fullName, role } = req.body;

        // Input validation
        if (!email || !password || !fullName || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Password strength validation
        if (password.length < 12 || password.length > 128) {
            return res.status(400).json({ error: 'Password must be between 12 and 128 characters' });
        }

        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

        if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
            return res.status(400).json({ error: 'Password must contain uppercase, lowercase, number, and special character' });
        }

        // Role validation
        const validRoles = ['admin', 'salesman', 'accountant'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role selected' });
        }

        // Name validation
        if (fullName.length < 2 || fullName.length > 100) {
            return res.status(400).json({ error: 'Name must be between 2 and 100 characters' });
        }

        // Create user with Supabase
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: role
                }
            }
        });

        if (error) {
            console.error('🔐 Registration error:', {
                timestamp: new Date().toISOString(),
                email: email.substring(0, 3) + '***',
                error: error.message
            });
            return res.status(400).json({ error: error.message });
        }

        if (data.user) {
            console.log('🔐 Creating profile for user:', {
                userId: data.user.id,
                userIdType: typeof data.user.id,
                userIdLength: data.user.id?.length,
                name: fullName,
                role: role
            });

            // Create profile in profiles table (only name and role columns)
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: data.user.id, // This is already a UUID from Supabase Auth
                    name: fullName,
                    role: role
                });

            if (profileError) {
                console.error('🔐 Profile creation error:', {
                    timestamp: new Date().toISOString(),
                    userId: data.user.id,
                    error: profileError.message
                });
                // Don't fail registration if profile creation fails
                console.warn('⚠️ Profile creation failed, but user was created');
            } else {
                console.log('✅ Profile created successfully for user:', data.user.id);
            }

            // Log successful registration
            console.log('🔐 Successful registration:', {
                timestamp: new Date().toISOString(),
                userId: data.user.id,
                email: data.user.email?.substring(0, 3) + '***',
                role: role
            });

            res.json({
                user: data.user,
                session: data.session,
                message: 'Account created successfully'
            });
        } else {
            res.status(400).json({ error: 'Registration failed' });
        }
    } catch (error) {
        console.error('🔐 Registration server error:', {
            timestamp: new Date().toISOString(),
            error: error.message
        });
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Get user profile
app.get('/api/user/profile', authenticateUser, async (req, res) => {
    try {
        // User is already authenticated by middleware, use req.user
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('name, role')
            .eq('id', req.user.id)
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ profile });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Get sales data
app.get('/api/sales', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ sales: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get sales' });
    }
});

// Get single sale by ID
app.get('/api/sales/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ sale: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get sale' });
    }
});

// Update sale by ID
app.put('/api/sales/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const saleData = req.body;

        console.log('🔐 Updating sale:', id);
        console.log('🔐 Sale data:', saleData);

        const { data, error } = await supabase
            .from('sales')
            .update(saleData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('🔐 Update sale error:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('🔐 Sale updated successfully:', data);
        res.json({ sale: data });
    } catch (error) {
        console.error('🔐 Update sale server error:', error);
        res.status(500).json({ error: 'Failed to update sale' });
    }
});

// Create new sale
app.post('/api/sales', authenticateUser, async (req, res) => {
    try {
        const saleData = req.body;

        // Generate ID if not provided
        if (!saleData.id) {
            saleData.id = (typeof crypto !== 'undefined' && crypto.randomUUID) ?
                crypto.randomUUID() :
                (Date.now().toString(36) + Math.random().toString(36).slice(2));
        }

        const { data, error } = await supabase
            .from('sales')
            .insert(saleData)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ sale: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create sale' });
    }
});

// Update sale status
app.patch('/api/sales/:id/status', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const { data, error } = await supabase
            .from('sales')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ sale: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update sale status' });
    }
});

// Delete sale
app.delete('/api/sales/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('sales')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete sale' });
    }
});

// Get expenses data
app.get('/api/expenses', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ expenses: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get expenses' });
    }
});

// Create new expense
app.post('/api/expenses', authenticateUser, async (req, res) => {
    try {
        const expenseData = req.body;

        // Generate ID if not provided
        if (!expenseData.id) {
            expenseData.id = (typeof crypto !== 'undefined' && crypto.randomUUID) ?
                crypto.randomUUID() :
                (Date.now().toString(36) + Math.random().toString(36).slice(2));
        }

        const { data, error } = await supabase
            .from('expenses')
            .insert(expenseData)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ expense: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create expense' });
    }
});

// Delete expense
app.delete('/api/expenses/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🔐 Deleting expense:', id);

        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('🔐 Delete expense error:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('🔐 Expense deleted successfully:', id);
        res.json({ success: true });
    } catch (error) {
        console.error('🔐 Delete expense server error:', error);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

// Get capital settings
app.get('/api/capital-settings', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('capital_settings')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ capitalSettings: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get capital settings' });
    }
});

// Update capital settings
app.post('/api/capital-settings', authenticateUser, async (req, res) => {
    try {
        const { original_capital } = req.body;
        const timestamp = new Date().toISOString();

        console.log('🔐 Updating capital settings:', { original_capital, timestamp });

        const { data, error } = await supabase
            .from('capital_settings')
            .upsert({
                original_capital: original_capital,
                updated_at: timestamp
            })
            .select()
            .single();

        if (error) {
            console.error('🔐 Update capital settings error:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('🔐 Capital settings updated successfully:', data);
        res.json({ capitalSettings: data });
    } catch (error) {
        console.error('🔐 Update capital settings server error:', error);
        res.status(500).json({ error: 'Failed to update capital settings' });
    }
});

// Global error handling middleware
app.use((error, req, res, next) => {
    console.error('🔐 Server error:', {
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: NODE_ENV === 'development' ? error.stack : undefined,
        url: req.url,
        method: req.method
    });

    res.status(500).json({
        error: NODE_ENV === 'production' ? 'Internal server error' : error.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Star Jet API Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`📊 Test endpoint: http://localhost:${PORT}/api/test`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔗 Connection test: http://localhost:${PORT}/api/connection-test`);
    console.log(`🔐 Supabase URL: ${process.env.SUPABASE_URL ? 'Configured' : 'NOT CONFIGURED'}`);

    if (NODE_ENV === 'production') {
        console.log(`🔒 Production mode: CORS restricted to allowed origins`);
        console.log(`🛡️ Rate limiting: 100 requests per 15 minutes per IP`);
    } else {
        console.log(`🔧 Development mode: CORS allows localhost`);
        console.log(`🛡️ Rate limiting: 1000 requests per 15 minutes per IP`);
    }

    console.log(`\n💡 Troubleshooting:`);
    console.log(`   - If you see connection errors, check your internet connection`);
    console.log(`   - Test Supabase connection: http://localhost:${PORT}/api/connection-test`);
    console.log(`   - Check environment variables in server.env`);
});
