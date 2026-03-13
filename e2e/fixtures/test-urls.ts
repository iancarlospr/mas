/** URLs to scan in E2E tests. Use stable, well-known sites. */
export const TEST_URLS = {
  simple: 'https://example.com',
  saas: 'https://hubspot.com',
  ecommerce: 'https://shopify.com',
  invalid: 'not-a-url',
  unreachable: 'https://this-domain-does-not-exist-12345.com',
} as const;
