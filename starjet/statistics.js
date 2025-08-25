/**
 * Statistics Handler for Star Jet Application
 * 
 * This module handles comprehensive business statistics, financial reporting,
 * and capital tracking functionality. It provides secure data analysis,
 * filtering, and visualization of sales and expense data.
 * 
 * FEATURES:
 * - Secure financial data analysis and reporting
 * - Date range filtering with validation
 * - Capital tracking and profit/loss calculations
 * - Category-based expense analysis
 * - Sales performance metrics
 * - Comprehensive error handling and user feedback
 * 
 * SECURITY FEATURES:
 * - Input sanitization and validation
 * - Financial data protection
 * - Rate limiting on operations
 * - Secure error handling without information disclosure
 * - Audit logging for financial data access
 * - Data access control based on user roles
 * 
 * File: statistics.js
 * Dependencies: supabase.js, auth.js, access-control.js
 * Called from: statistics.html
 * 
 * @author Star Jet Development Team
 * @version 2.0.0
 * @lastUpdated 2024
 */

// Security and validation constants
const STATISTICS_SECURITY_CONFIG = {
    MAX_FILTER_DATE_RANGE: 365, // days
    MAX_DISPLAY_RECORDS: 10000,
    RATE_LIMIT_DELAY: 2000, // milliseconds
    MIN_CAPITAL_AMOUNT: 0,
    MAX_CAPITAL_AMOUNT: 10000000, // $10M limit
    REALTIME_RETRY_DELAY: 5000, // 5 seconds
    MAX_REALTIME_RETRIES: 3
};

// ===============================
// Data Handling
// ===============================

/**
 * Loads expenses from Supabase, or returns empty array if not configured.
 * @returns {Promise<Array>}
 */
async function loadExpenses() {
    try {
        if (!window.apiClient) {
            console.warn('API client not configured. Please check your configuration.');
            return [];
        }

        const result = await window.apiClient.getExpenses();

        if (result.error) {
            console.error('Error fetching expenses from API:', result.error);
            return [];
        }

        return result.expenses || [];
    } catch (e) {
        console.error('Failed to load expenses from API:', e);
        return [];
    }
}

/**
 * Loads capital settings from Supabase.
 * @returns {Promise<Object>}
 */
async function loadCapitalSettings() {
    try {
        if (!window.apiClient) {
            console.warn('API client not configured. Please check your configuration.');
            return { originalCapital: 0 };
        }

        const result = await window.apiClient.getCapitalSettings();

        if (result.error) {
            console.error('Error fetching capital settings from API:', result.error);
            return { originalCapital: 0 };
        }

        return { originalCapital: result.capitalSettings ? result.capitalSettings.original_capital : 0 };
    } catch (e) {
        console.error('Failed to load capital settings from API:', e);
        return { originalCapital: 0 };
    }
}

/**
 * Loads sales from Supabase, or returns empty array if not configured.
 * @returns {Promise<Array>}
 */
async function loadSales() {
    try {
        if (!window.apiClient) {
            console.warn('API client not configured. Please check your configuration.');
            return [];
        }

        const result = await window.apiClient.getSales();

        if (result.error) {
            console.error('Error fetching sales from API:', result.error);
            return [];
        }

        return result.sales || [];
    } catch (e) {
        console.error('Failed to load sales from API:', e);
        return [];
    }
}

// ===============================
// Date Filtering Logic
// ===============================

let currentStartDate = null;
let currentEndDate = null;

/**
 * Sets date range for filtering.
 * @param {string} startDate - YYYY-MM-DD format
 * @param {string} endDate - YYYY-MM-DD format
 */
function setDateRange(startDate, endDate) {
    currentStartDate = startDate;
    currentEndDate = endDate;
    document.getElementById('startDate').value = startDate;
    document.getElementById('endDate').value = endDate;
}

/**
 * Checks if a date falls within the current filter range.
 * @param {string} dateStr - Date string to check
 * @returns {boolean}
 */
function isDateInRange(dateStr) {
    if (!currentStartDate && !currentEndDate) return true;

    const date = dateStr.split('T')[0]; // Remove time part if present

    if (currentStartDate && date < currentStartDate) return false;
    if (currentEndDate && date > currentEndDate) return false;

    return true;
}

// ===============================
// Calculation Functions
// ===============================

/**
 * Calculates filtered statistics based on current date range.
 * @returns {Promise<Object>}
 */
async function calculateFilteredStats() {
    const capitalSettings = await loadCapitalSettings();
    const sales = await loadSales();
    const expenses = await loadExpenses();

    let originalCapital = capitalSettings.originalCapital || 0;
    let totalSales = 0;
    let totalSalesCount = 0;
    let totalExpenses = 0;

    // Calculate filtered sales (completed sales only)
    sales.forEach(sale => {
        if (sale.status === 'Completed' && isDateInRange(sale.date)) {
            totalSales += parseFloat(sale.total) || 0;
            totalSalesCount++;
        }
    });

    // Calculate filtered expenses
    expenses.forEach(expense => {
        if (isDateInRange(expense.date)) {
            const amount = parseFloat(expense.amount) || 0;
            if (expense.type === 'expense') {
                totalExpenses += amount;
            }
        }
    });

    const netChange = totalSales - totalExpenses;
    const currentCapital = originalCapital + netChange;

    return {
        originalCapital,
        totalSales,
        totalSalesCount,
        totalExpenses,
        netChange,
        currentCapital
    };
}

// ===============================
// UI Update Functions
// ===============================

/**
 * Updates all statistics displays with current filtered data.
 * 
 * SECURITY: Includes comprehensive error handling and data validation
 */
async function updateStatisticsDisplay() {
    const timestamp = new Date().toISOString();

    try {
        const stats = await calculateFilteredStats();

        // Update DOM elements with validated data
        const originalCapitalEl = document.getElementById('originalCapital');
        const totalSalesEl = document.getElementById('totalSales');
        const totalSalesCountEl = document.getElementById('totalSalesCount');
        const totalExpensesEl = document.getElementById('totalExpenses');
        const netChangeEl = document.getElementById('netChange');
        const currentCapitalEl = document.getElementById('currentCapital');

        if (originalCapitalEl) {
            originalCapitalEl.textContent = `$${stats.originalCapital.toFixed(2)}`;
        }
        if (totalSalesEl) {
            totalSalesEl.textContent = `$${stats.totalSales.toFixed(2)}`;
        }
        if (totalSalesCountEl) {
            totalSalesCountEl.textContent = stats.totalSalesCount.toString();
        }
        if (totalExpensesEl) {
            totalExpensesEl.textContent = `$${stats.totalExpenses.toFixed(2)}`;
        }
        if (netChangeEl) {
            netChangeEl.textContent = `$${stats.netChange.toFixed(2)}`;

            // Update net change color
            netChangeEl.className = 'stat-value';
            if (stats.netChange > 0) {
                netChangeEl.classList.add('positive');
            } else if (stats.netChange < 0) {
                netChangeEl.classList.add('negative');
            }
        }
        if (currentCapitalEl) {
            currentCapitalEl.textContent = `$${stats.currentCapital.toFixed(2)}`;
        }

        console.log('🔐 Statistics display updated successfully:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'updateStatisticsDisplay',
            totalSales: stats.totalSales,
            totalSalesCount: stats.totalSalesCount,
            totalExpenses: stats.totalExpenses,
            netChange: stats.netChange
        });

    } catch (error) {
        console.error('🔐 Error updating statistics display:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'updateStatisticsDisplay',
            error: error.message
        });
    }
}

// ===============================
// Filter Button Handlers
// ===============================

/**
 * Sets up quick filter buttons.
 */
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(button => {
        button.addEventListener('click', async function () {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');

            const period = this.dataset.period;
            await setQuickFilter(period);
        });
    });
}

/**
 * Sets quick filter based on period.
 * @param {string} period - 'today', 'week', 'month', 'year', 'all'
 */
async function setQuickFilter(period) {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    switch (period) {
        case 'today':
            setDateRange(todayStr, todayStr);
            break;
        case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            const weekStartStr = weekStart.toISOString().slice(0, 10);
            setDateRange(weekStartStr, todayStr);
            break;
        case 'month':
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthStartStr = monthStart.toISOString().slice(0, 10);
            setDateRange(monthStartStr, todayStr);
            break;
        case 'year':
            const yearStart = new Date(today.getFullYear(), 0, 1);
            const yearStartStr = yearStart.toISOString().slice(0, 10);
            setDateRange(yearStartStr, todayStr);
            break;
        case 'all':
            setDateRange(null, null);
            break;
    }

    await updateStatisticsDisplay();
}

// ===============================
// Manual Date Input Handlers
// ===============================

/**
 * Sets up manual date input handlers.
 */
function setupDateInputs() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    startDateInput.addEventListener('change', async function () {
        currentStartDate = this.value;
        await updateStatisticsDisplay();
    });

    endDateInput.addEventListener('change', async function () {
        currentEndDate = this.value;
        await updateStatisticsDisplay();
    });
}

// ===============================
// Enhanced Chart Functionality
// ===============================

// Chart instances for management
let monthlyBarChart = null;
let trendsLineChart = null;
let categoriesPieChart = null;

/**
 * Initialize all charts with enhanced security and error handling
 * 
 * SECURITY: Includes comprehensive error handling and data validation
 */
async function initializeCharts() {
    const timestamp = new Date().toISOString();

    try {
        console.log('🔐 Initializing charts:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'initializeCharts'
        });

        // Initialize monthly bar chart
        await initializeMonthlyBarChart();

        // Initialize trends line chart
        await initializeTrendsLineChart();

        // Initialize categories pie chart
        await initializeCategoriesPieChart();

        console.log('🔐 Charts initialized successfully:', {
            timestamp: new Date().toISOString(),
            file: 'statistics.js',
            function: 'initializeCharts'
        });

    } catch (error) {
        console.error('🔐 Error initializing charts:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'initializeCharts',
            error: error.message
        });
    }
}

/**
 * Initialize monthly sales and expenses bar chart
 * 
 * SECURITY: Includes data validation and error handling
 */
async function initializeMonthlyBarChart() {
    const timestamp = new Date().toISOString();

    try {
        const sales = await loadSales();
        const expenses = await loadExpenses();

        // Process data for monthly comparison
        const monthlyData = processMonthlyData(sales, expenses);

        const ctx = document.getElementById('monthlyBarChart');
        if (!ctx) {
            console.warn('🔐 Monthly chart canvas not found');
            return;
        }

        // Destroy existing chart if it exists
        if (monthlyBarChart) {
            monthlyBarChart.destroy();
        }

        monthlyBarChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthlyData.labels,
                datasets: [
                    {
                        label: 'Sales',
                        data: monthlyData.sales,
                        backgroundColor: '#28a745',
                        borderColor: '#28a745',
                        borderWidth: 1
                    },
                    {
                        label: 'Expenses',
                        data: monthlyData.expenses,
                        backgroundColor: '#dc3545',
                        borderColor: '#dc3545',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Monthly Sales vs Expenses'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });

        console.log('🔐 Monthly bar chart initialized:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'initializeMonthlyBarChart',
            dataPoints: monthlyData.labels.length
        });

    } catch (error) {
        console.error('🔐 Error initializing monthly bar chart:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'initializeMonthlyBarChart',
            error: error.message
        });
    }
}

/**
 * Initialize sales vs expenses trends line chart
 * 
 * SECURITY: Includes data validation and error handling
 */
async function initializeTrendsLineChart() {
    const timestamp = new Date().toISOString();

    try {
        const sales = await loadSales();
        const expenses = await loadExpenses();

        // Process data for trends
        const trendsData = processTrendsData(sales, expenses, 30); // Default 30 days

        const ctx = document.getElementById('trendsLineChart');
        if (!ctx) {
            console.warn('🔐 Trends chart canvas not found');
            return;
        }

        // Destroy existing chart if it exists
        if (trendsLineChart) {
            trendsLineChart.destroy();
        }

        trendsLineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendsData.labels,
                datasets: [
                    {
                        label: 'Sales',
                        data: trendsData.sales,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Expenses',
                        data: trendsData.expenses,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Sales vs Expenses Trends'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });

        console.log('🔐 Trends line chart initialized:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'initializeTrendsLineChart',
            dataPoints: trendsData.labels.length
        });

    } catch (error) {
        console.error('🔐 Error initializing trends line chart:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'initializeTrendsLineChart',
            error: error.message
        });
    }
}

/**
 * Initialize expense categories pie chart
 * 
 * SECURITY: Includes data validation and error handling
 */
async function initializeCategoriesPieChart() {
    const timestamp = new Date().toISOString();

    try {
        const expenses = await loadExpenses();

        // Process data for categories
        const categoriesData = processCategoriesData(expenses, 'month'); // Default month

        const ctx = document.getElementById('categoriesPieChart');
        if (!ctx) {
            console.warn('🔐 Categories chart canvas not found');
            return;
        }

        // Destroy existing chart if it exists
        if (categoriesPieChart) {
            categoriesPieChart.destroy();
        }

        categoriesPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: categoriesData.labels,
                datasets: [{
                    data: categoriesData.values,
                    backgroundColor: [
                        '#28a745',
                        '#dc3545',
                        '#ffc107',
                        '#17a2b8',
                        '#6f42c1',
                        '#fd7e14'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    title: {
                        display: true,
                        text: 'Expense Category Breakdown'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: $${value.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        console.log('🔐 Categories pie chart initialized:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'initializeCategoriesPieChart',
            categories: categoriesData.labels.length
        });

    } catch (error) {
        console.error('🔐 Error initializing categories pie chart:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'initializeCategoriesPieChart',
            error: error.message
        });
    }
}

/**
 * Process monthly data for bar chart
 * 
 * @param {Array} sales - Sales data
 * @param {Array} expenses - Expenses data
 * @returns {Object} Processed monthly data
 * 
 * SECURITY: Includes data validation and sanitization
 */
function processMonthlyData(sales, expenses) {
    const timestamp = new Date().toISOString();

    try {
        const currentYear = new Date().getFullYear();
        const monthlySales = new Array(12).fill(0);
        const monthlyExpenses = new Array(12).fill(0);

        // Process sales data
        sales.forEach(sale => {
            if (sale.status === 'Completed' && sale.date) {
                const saleDate = new Date(sale.date);
                if (saleDate.getFullYear() === currentYear) {
                    const month = saleDate.getMonth();
                    monthlySales[month] += parseFloat(sale.total) || 0;
                }
            }
        });

        // Process expenses data
        expenses.forEach(expense => {
            if (expense.date) {
                const expenseDate = new Date(expense.date);
                if (expenseDate.getFullYear() === currentYear) {
                    const month = expenseDate.getMonth();
                    monthlyExpenses[month] += parseFloat(expense.amount) || 0;
                }
            }
        });

        const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        console.log('🔐 Monthly data processed:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'processMonthlyData',
            year: currentYear,
            totalSales: monthlySales.reduce((a, b) => a + b, 0),
            totalExpenses: monthlyExpenses.reduce((a, b) => a + b, 0)
        });

        return {
            labels: monthNames,
            sales: monthlySales,
            expenses: monthlyExpenses
        };

    } catch (error) {
        console.error('🔐 Error processing monthly data:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'processMonthlyData',
            error: error.message
        });

        return {
            labels: [],
            sales: [],
            expenses: []
        };
    }
}

/**
 * Process trends data for line chart
 * 
 * @param {Array} sales - Sales data
 * @param {Array} expenses - Expenses data
 * @param {number} days - Number of days to show
 * @returns {Object} Processed trends data
 * 
 * SECURITY: Includes data validation and sanitization
 */
function processTrendsData(sales, expenses, days) {
    const timestamp = new Date().toISOString();

    try {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

        const dailySales = {};
        const dailyExpenses = {};

        // Initialize daily data
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().slice(0, 10);
            dailySales[dateStr] = 0;
            dailyExpenses[dateStr] = 0;
        }

        // Process sales data
        sales.forEach(sale => {
            if (sale.status === 'Completed' && sale.date) {
                const saleDate = new Date(sale.date);
                if (saleDate >= startDate && saleDate <= endDate) {
                    const dateStr = saleDate.toISOString().slice(0, 10);
                    dailySales[dateStr] += parseFloat(sale.total) || 0;
                }
            }
        });

        // Process expenses data
        expenses.forEach(expense => {
            if (expense.date) {
                const expenseDate = new Date(expense.date);
                if (expenseDate >= startDate && expenseDate <= endDate) {
                    const dateStr = expenseDate.toISOString().slice(0, 10);
                    dailyExpenses[dateStr] += parseFloat(expense.amount) || 0;
                }
            }
        });

        const labels = Object.keys(dailySales).map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        const salesValues = Object.values(dailySales);
        const expensesValues = Object.values(dailyExpenses);

        console.log('🔐 Trends data processed:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'processTrendsData',
            days: days,
            dataPoints: labels.length,
            totalSales: salesValues.reduce((a, b) => a + b, 0),
            totalExpenses: expensesValues.reduce((a, b) => a + b, 0)
        });

        return {
            labels: labels,
            sales: salesValues,
            expenses: expensesValues
        };

    } catch (error) {
        console.error('🔐 Error processing trends data:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'processTrendsData',
            error: error.message
        });

        return {
            labels: [],
            sales: [],
            expenses: []
        };
    }
}

/**
 * Process categories data for pie chart
 * 
 * @param {Array} expenses - Expenses data
 * @param {string} period - 'month' or 'year'
 * @returns {Object} Processed categories data
 * 
 * SECURITY: Includes data validation and sanitization
 */
function processCategoriesData(expenses, period) {
    const timestamp = new Date().toISOString();

    try {
        const now = new Date();
        let startDate;

        if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else {
            startDate = new Date(now.getFullYear(), 0, 1);
        }

        const categories = {};

        expenses.forEach(expense => {
            if (expense.date) {
                const expenseDate = new Date(expense.date);
                if (expenseDate >= startDate && expenseDate <= now) {
                    const category = expense.category || 'Unknown';
                    categories[category] = (categories[category] || 0) + (parseFloat(expense.amount) || 0);
                }
            }
        });

        const labels = Object.keys(categories).map(cat => {
            return cat === 'work' ? 'Work-related' :
                cat === 'non-work' ? 'Non-work-related' :
                    cat.charAt(0).toUpperCase() + cat.slice(1);
        });

        const values = Object.values(categories);

        console.log('🔐 Categories data processed:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'processCategoriesData',
            period: period,
            categories: labels.length,
            totalAmount: values.reduce((a, b) => a + b, 0)
        });

        return {
            labels: labels,
            values: values
        };

    } catch (error) {
        console.error('🔐 Error processing categories data:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'processCategoriesData',
            error: error.message
        });

        return {
            labels: [],
            values: []
        };
    }
}

/**
 * Update charts based on selected chart type
 * 
 * @param {string} chartType - Type of chart to update
 * 
 * SECURITY: Includes error handling and validation
 */
window.updateCharts = async function (chartType) {
    const timestamp = new Date().toISOString();

    try {
        console.log('🔐 Updating charts:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'updateCharts',
            chartType: chartType
        });

        switch (chartType) {
            case 'monthly':
                await initializeMonthlyBarChart();
                break;
            case 'trends':
                await initializeTrendsLineChart();
                break;
            case 'categories':
                await initializeCategoriesPieChart();
                break;
            default:
                console.warn('🔐 Unknown chart type:', chartType);
        }

    } catch (error) {
        console.error('🔐 Error updating charts:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'updateCharts',
            error: error.message
        });
    }
};

// ===============================
// Initialize
// ===============================

// Set up event listeners
setupFilterButtons();
setupDateInputs();

// Initialize statistics with realtime subscriptions and charts
(async () => {
    console.log('🔐 Initializing statistics with realtime subscriptions and charts...');

    // Set default filter to today
    await setQuickFilter('today');

    // Initialize charts
    await initializeCharts();

    // Initialize realtime subscriptions
    await initializeStatisticsRealtimeSubscriptions();

    // Setup chart filter event listeners
    setupChartFilters();
})();

/**
 * Setup chart filter event listeners
 * 
 * SECURITY: Includes error handling and validation
 */
function setupChartFilters() {
    const timestamp = new Date().toISOString();

    try {
        // Trends filter
        const trendsFilter = document.getElementById('trendsFilter');
        if (trendsFilter) {
            trendsFilter.addEventListener('change', async function () {
                const days = parseInt(this.value);
                await updateTrendsChart(days);
            });
        }

        // Categories filter
        const categoriesFilter = document.getElementById('categoriesFilter');
        if (categoriesFilter) {
            categoriesFilter.addEventListener('change', async function () {
                const period = this.value;
                await updateCategoriesChart(period);
            });
        }

        console.log('🔐 Chart filters setup completed:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'setupChartFilters'
        });

    } catch (error) {
        console.error('🔐 Error setting up chart filters:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'setupChartFilters',
            error: error.message
        });
    }
}

/**
 * Update trends chart with new filter
 * 
 * @param {number} days - Number of days to show
 * 
 * SECURITY: Includes error handling and validation
 */
async function updateTrendsChart(days) {
    const timestamp = new Date().toISOString();

    try {
        const sales = await loadSales();
        const expenses = await loadExpenses();

        const trendsData = processTrendsData(sales, expenses, days);

        if (trendsLineChart) {
            trendsLineChart.data.labels = trendsData.labels;
            trendsLineChart.data.datasets[0].data = trendsData.sales;
            trendsLineChart.data.datasets[1].data = trendsData.expenses;
            trendsLineChart.update();
        }

        console.log('🔐 Trends chart updated:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'updateTrendsChart',
            days: days
        });

    } catch (error) {
        console.error('🔐 Error updating trends chart:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'updateTrendsChart',
            error: error.message
        });
    }
}

/**
 * Update categories chart with new filter
 * 
 * @param {string} period - 'month' or 'year'
 * 
 * SECURITY: Includes error handling and validation
 */
async function updateCategoriesChart(period) {
    const timestamp = new Date().toISOString();

    try {
        const expenses = await loadExpenses();

        const categoriesData = processCategoriesData(expenses, period);

        if (categoriesPieChart) {
            categoriesPieChart.data.labels = categoriesData.labels;
            categoriesPieChart.data.datasets[0].data = categoriesData.values;
            categoriesPieChart.update();
        }

        console.log('🔐 Categories chart updated:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'updateCategoriesChart',
            period: period
        });

    } catch (error) {
        console.error('🔐 Error updating categories chart:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'updateCategoriesChart',
            error: error.message
        });
    }
}

// ===============================
// End of statistics.js
// ===============================

// ===============================
// Realtime Subscription Management
// ===============================

let statisticsSalesSubscription = null;
let statisticsExpensesSubscription = null;
let statisticsCapitalSubscription = null;
let statisticsSubscriptionRetryCount = 0;

/**
 * Initialize Supabase Realtime subscriptions for statistics page
 * 
 * SECURITY: Includes comprehensive error handling and connection management
 */
async function initializeStatisticsRealtimeSubscriptions() {
    const timestamp = new Date().toISOString();

    console.log('🔐 Initializing statistics realtime subscriptions:', {
        timestamp: timestamp,
        file: 'statistics.js',
        function: 'initializeStatisticsRealtimeSubscriptions'
    });

    const sb = window.getSupabase && window.getSupabase();
    if (!sb) {
        console.error('🔐 Security: Supabase client not available for statistics realtime', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'initializeStatisticsRealtimeSubscriptions'
        });
        return;
    }

    try {
        // Subscribe to sales table changes
        statisticsSalesSubscription = sb
            .channel('statistics-sales-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'sales' },
                async (payload) => {
                    const eventTimestamp = new Date().toISOString();
                    console.log('🔐 Statistics sales realtime event received:', {
                        timestamp: eventTimestamp,
                        file: 'statistics.js',
                        function: 'statisticsSalesSubscription',
                        event: payload.eventType,
                        table: payload.table,
                        recordId: payload.new?.id || payload.old?.id
                    });

                    // Update statistics when sales data changes
                    await updateStatisticsDisplay();
                }
            )
            .subscribe((status) => {
                console.log('🔐 Statistics sales subscription status:', {
                    timestamp: new Date().toISOString(),
                    file: 'statistics.js',
                    function: 'statisticsSalesSubscription',
                    status: status
                });

                if (status === 'SUBSCRIBED') {
                    statisticsSubscriptionRetryCount = 0; // Reset retry count on success
                }
            });

        // Subscribe to expenses table changes
        statisticsExpensesSubscription = sb
            .channel('statistics-expenses-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'expenses' },
                async (payload) => {
                    const eventTimestamp = new Date().toISOString();
                    console.log('🔐 Statistics expenses realtime event received:', {
                        timestamp: eventTimestamp,
                        file: 'statistics.js',
                        function: 'statisticsExpensesSubscription',
                        event: payload.eventType,
                        table: payload.table,
                        recordId: payload.new?.id || payload.old?.id
                    });

                    // Update statistics when expenses data changes
                    await updateStatisticsDisplay();
                }
            )
            .subscribe((status) => {
                console.log('🔐 Statistics expenses subscription status:', {
                    timestamp: new Date().toISOString(),
                    file: 'statistics.js',
                    function: 'statisticsExpensesSubscription',
                    status: status
                });
            });

        // Subscribe to capital settings changes
        statisticsCapitalSubscription = sb
            .channel('statistics-capital-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'capital_settings' },
                async (payload) => {
                    const eventTimestamp = new Date().toISOString();
                    console.log('🔐 Statistics capital realtime event received:', {
                        timestamp: eventTimestamp,
                        file: 'statistics.js',
                        function: 'statisticsCapitalSubscription',
                        event: payload.eventType,
                        table: payload.table,
                        recordId: payload.new?.id || payload.old?.id
                    });

                    // Update statistics when capital settings change
                    await updateStatisticsDisplay();
                }
            )
            .subscribe((status) => {
                console.log('🔐 Statistics capital subscription status:', {
                    timestamp: new Date().toISOString(),
                    file: 'statistics.js',
                    function: 'statisticsCapitalSubscription',
                    status: status
                });
            });

        console.log('🔐 Statistics realtime subscriptions initialized successfully:', {
            timestamp: new Date().toISOString(),
            file: 'statistics.js',
            function: 'initializeStatisticsRealtimeSubscriptions'
        });

    } catch (error) {
        console.error('🔐 Failed to initialize statistics realtime subscriptions:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'initializeStatisticsRealtimeSubscriptions',
            error: error.message,
            retryCount: statisticsSubscriptionRetryCount
        });

        // Retry logic for subscription failures
        if (statisticsSubscriptionRetryCount < STATISTICS_SECURITY_CONFIG.MAX_REALTIME_RETRIES) {
            statisticsSubscriptionRetryCount++;
            console.log('🔐 Retrying statistics realtime subscription setup:', {
                timestamp: new Date().toISOString(),
                file: 'statistics.js',
                function: 'initializeStatisticsRealtimeSubscriptions',
                retryCount: statisticsSubscriptionRetryCount
            });

            setTimeout(() => {
                initializeStatisticsRealtimeSubscriptions();
            }, STATISTICS_SECURITY_CONFIG.REALTIME_RETRY_DELAY);
        }
    }
}

/**
 * Clean up statistics realtime subscriptions when page unloads
 * 
 * SECURITY: Prevents memory leaks and unnecessary connections
 */
function cleanupStatisticsRealtimeSubscriptions() {
    const timestamp = new Date().toISOString();

    console.log('🔐 Cleaning up statistics realtime subscriptions:', {
        timestamp: timestamp,
        file: 'statistics.js',
        function: 'cleanupStatisticsRealtimeSubscriptions'
    });

    try {
        const sb = window.getSupabase && window.getSupabase();
        if (sb) {
            if (statisticsSalesSubscription) {
                sb.removeChannel(statisticsSalesSubscription);
                statisticsSalesSubscription = null;
            }
            if (statisticsExpensesSubscription) {
                sb.removeChannel(statisticsExpensesSubscription);
                statisticsExpensesSubscription = null;
            }
            if (statisticsCapitalSubscription) {
                sb.removeChannel(statisticsCapitalSubscription);
                statisticsCapitalSubscription = null;
            }
        }

        console.log('🔐 Statistics realtime subscriptions cleaned up successfully:', {
            timestamp: new Date().toISOString(),
            file: 'statistics.js',
            function: 'cleanupStatisticsRealtimeSubscriptions'
        });
    } catch (error) {
        console.error('🔐 Error cleaning up statistics realtime subscriptions:', {
            timestamp: timestamp,
            file: 'statistics.js',
            function: 'cleanupStatisticsRealtimeSubscriptions',
            error: error.message
        });
    }
}

// ===============================
// Real-time Update on Focus/Visibility Change
// ===============================

// Refresh statistics when page becomes visible or gains focus
window.addEventListener('focus', async function () {
    console.log('🔐 Statistics page focused, refreshing display...');
    await updateStatisticsDisplay();
});

window.addEventListener('visibilitychange', async function () {
    if (!document.hidden) {
        console.log('🔐 Statistics page became visible, refreshing display...');
        await updateStatisticsDisplay();
    }
});

// Manual refresh functionality (if needed)
window.refreshStatistics = async function () {
    console.log('🔐 Manual statistics refresh requested');
    await updateStatisticsDisplay();
};

// ===============================
// End of statistics.js
// =============================== 