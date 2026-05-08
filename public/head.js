import { seoConfig } from './seo.config.js';

const path = window.location.pathname;
const page = seoConfig.pages[path] || {};
const title = page.title ? `${page.title} | ${seoConfig.titleSuffix}` : seoConfig.defaultTitle;
const description = page.description || seoConfig.defaultDescription;
const keywords = (page.keywords || seoConfig.defaultKeywords).join(', ');
const canonicalUrl = `${window.location.origin}${path}`;

document.title = title;

const headEntries = [
  { tag: 'link', attrs: { rel: 'icon', type: 'image/x-icon', href: '/img/favicon.ico' } },
  { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/img/favicon-32x32.png' } },
  { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/img/favicon-16x16.png' } },
  { tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/img/apple-touch-icon.png' } },
  { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/img/android-chrome-192x192.png' } },
  { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/img/android-chrome-512x512.png' } },
  { tag: 'meta', attrs: { name: 'description', content: description } },
  { tag: 'meta', attrs: { name: 'keywords', content: keywords } },
  { tag: 'meta', attrs: { name: 'theme-color', content: seoConfig.themeColor } },
  { tag: 'meta', attrs: { name: 'robots', content: 'index,follow' } },
  { tag: 'meta', attrs: { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' } },
  { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'Oikos' } },
  { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.json' } },
  { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
  { tag: 'meta', attrs: { property: 'og:site_name', content: seoConfig.siteName } },
  { tag: 'meta', attrs: { property: 'og:locale', content: seoConfig.locale } },
  { tag: 'meta', attrs: { property: 'og:title', content: title } },
  { tag: 'meta', attrs: { property: 'og:description', content: description } },
  { tag: 'meta', attrs: { property: 'og:url', content: canonicalUrl } },
  { tag: 'meta', attrs: { name: 'twitter:card', content: seoConfig.twitterCard } },
  { tag: 'meta', attrs: { name: 'twitter:title', content: title } },
  { tag: 'meta', attrs: { name: 'twitter:description', content: description } },
  { tag: 'link', attrs: { rel: 'canonical', href: canonicalUrl } },
  { tag: 'link', attrs: { rel: 'stylesheet', href: '/styles.css' } }
];

function upsertHeadElement(tag, attrs) {
  const selector = Object.entries(attrs)
    .filter(([key]) => ['name', 'property', 'rel', 'sizes'].includes(key))
    .map(([key, value]) => `${tag}[${key}="${value}"]`)
    .join('');

  const existing = selector ? document.head.querySelector(selector) : null;
  const node = existing || document.createElement(tag);

  Object.entries(attrs).forEach(([key, value]) => {
    node.setAttribute(key, value);
  });

  if (!existing) document.head.appendChild(node);
}

headEntries.forEach(({ tag, attrs }) => upsertHeadElement(tag, attrs));
