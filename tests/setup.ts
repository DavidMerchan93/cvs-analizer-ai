/**
 * Global test setup for frontend (jsdom) tests.
 *
 * This file is executed once per test *file* before any describe/it blocks run.
 * We import @testing-library/jest-dom here so that every test file automatically
 * has access to matchers like:
 *   - toBeInTheDocument()
 *   - toHaveTextContent()
 *   - toBeVisible()
 *   - toBeDisabled()
 *
 * Without this import those matchers would be undefined and tests would fail
 * with cryptic "not a function" errors.
 */
import '@testing-library/jest-dom';
