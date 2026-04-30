export const seoConfig = {
  siteName: 'Oikos',
  defaultTitle: 'Oikos',
  titleSuffix: 'Oikos',
  defaultDescription: 'Oikos is a simple expenses management system for tracking spending, categories, stores, payment methods, and reports.',
  defaultKeywords: ['oikos', 'expense tracker', 'expenses', 'budget', 'personal finance'],
  themeColor: '#f8faf8',
  locale: 'en_US',
  twitterCard: 'summary',
  dateFormat: 'DD-MM-YYYY',
  pages: {
    '/': {
      title: 'Expense Entry',
      description: 'Track a new expense quickly with categories, subcategories, stores, and payment methods in Oikos.'
    },
    '/me': {
      title: 'My Profile',
      description: 'View your account details and signed-in profile information in Oikos.'
    },
    '/categories': {
      title: 'Categories',
      description: 'Manage expense categories and subcategories used across your Oikos expense tracking workflow.'
    },
    '/stores': {
      title: 'Stores',
      description: 'Browse and manage stores used when recording expenses in Oikos.'
    },
    '/payment-methods': {
      title: 'Payment Methods',
      description: 'Manage payment methods used to classify how expenses are paid in Oikos.'
    },
    '/users': {
      title: 'Users',
      description: 'Review user accounts available in Oikos for admin management.'
    },
    '/transactions': {
      title: 'Transactions',
      description: 'Browse and manage recorded expense transactions in Oikos.'
    },
    '/dashboard': {
      title: 'Dashboard',
      description: 'Analyze expenses by month, category, and store using the Oikos dashboard.'
    },
    '/filter': {
      title: 'Filter',
      description: 'Pivot and filter Oikos transaction data to compare expenses across different dimensions.'
    }
  }
};
