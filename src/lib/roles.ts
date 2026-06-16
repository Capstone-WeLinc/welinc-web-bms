export type AppRole = 'ADMIN' | 'CUSTOMER_SERVICE' | 'OPERATIONS';

export function getRoleDashboard(role: AppRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'CUSTOMER_SERVICE':
      return '/cs/dashboard';
    case 'OPERATIONS':
      return '/operations/dashboard';
    default:
      return '/login';
  }
}