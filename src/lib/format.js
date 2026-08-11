import { seoConfig } from './seo';

export const TRANSACTION_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

export function formatDate(dateString) {
  if (!dateString) return '';
  const isoDate = String(dateString).slice(0, 10);
  const [year = '', month = '', day = ''] = isoDate.split('-');
  if (!year || !month || !day) return isoDate || String(dateString);

  const format = seoConfig.dateFormat || 'DD-MM-YYYY';
  if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
  if (format === 'MM-DD-YYYY') return `${month}-${day}-${year}`;
  if (format === 'DD-MM-YYYY') return `${day}-${month}-${year}`;
  return `${day}-${month}-${year}`;
}

export function formatLongDate(dateString) {
  if (!dateString) return '';
  const isoDate = String(dateString).slice(0, 10);
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return formatDate(dateString);
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}
