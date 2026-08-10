import { createElement } from 'react';
import { StatusPill } from '../components/StatusPill';

export function userDisplayName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.name || user?.email || 'User';
}

export function userInitials(user) {
  const parts = [user?.firstName, user?.lastName].filter(Boolean);
  if (parts.length) return parts.map((part) => part.trim().charAt(0)).join('').slice(0, 2).toUpperCase();
  return userDisplayName(user).split(/\s+/).map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase();
}

export function transactionToneClass(transaction) {
  const seed = String(
    transaction.expand?.category?.name
    || transaction.expand?.subcategory?.name
    || transaction.title
    || 'x'
  ).toLowerCase();
  const tones = ['emerald', 'indigo', 'amber', 'rose', 'violet'];
  const index = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length;
  return `transaction-tone-${tones[index]}`;
}

export function transactionAvatarLabel(transaction) {
  const text = String(transaction.title || transaction.expand?.subcategory?.name || transaction.expand?.category?.name || 'T').trim();
  return (text[0] || 'T').toUpperCase();
}

export function isApprovedUser(user) {
  if (!user) return false;
  if (user.isAdmin || user.kind === 'admin') return true;
  return Boolean(user.verified && user.approved);
}

export function verificationBadge(user) {
  return user?.verified
    ? createElement(StatusPill, { variant: 'success' }, 'Verified')
    : createElement(StatusPill, { variant: 'warning' }, 'Pending verification');
}

export function approvalBadge(user) {
  return isApprovedUser(user)
    ? createElement(StatusPill, { variant: 'success' }, 'Approved')
    : createElement(StatusPill, { variant: 'warning' }, 'Approval pending');
}
