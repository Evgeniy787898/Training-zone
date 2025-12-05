import { validateEnvironment } from '../config/env.js';

try {
  validateEnvironment();
  // eslint-disable-next-line no-console
  console.log('Environment validation succeeded.');
  process.exit(0);
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Environment validation failed:', error);
  process.exit(1);
}
