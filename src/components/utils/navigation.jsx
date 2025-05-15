/**
 * Creates a URL for the specified page
 * @param {string} pageName - The name of the page to create URL for
 * @returns {string} The URL for the specified page
 */
export function createPageUrl(pageName) {
  // If no page specified, default to Dashboard
  if (!pageName) {
    return '/Dashboard';
  }
  return `/${pageName}`;
}