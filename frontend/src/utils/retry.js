/**
 * Retry wrapper for async operations (exponential backoff)
 * Extracted from index.html withRetry().
 */

/**
 * Retry an async function with exponential backoff.
 * @param {() => Promise} fn - The async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts (default 3)
 * @param {string} label - Label for logging (default 'operation')
 * @returns {Promise} - The result of fn()
 */
export async function withRetry(fn, maxRetries = 3, label = "operation") {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === maxRetries) {
        console.error(
          `withRetry: ${label} failed after ${maxRetries + 1} attempts:`,
          e
        );
        throw e;
      }
      const delay =
        Math.min(1000 * Math.pow(2, attempt), 8000) + Math.random() * 500;
      console.warn(
        `withRetry: ${label} attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
