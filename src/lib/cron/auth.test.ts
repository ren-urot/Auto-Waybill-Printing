import { describe, it, expect } from 'vitest';
import { isAuthorizedCronRequest } from './auth';

describe('isAuthorizedCronRequest', () => {
  it('accepts a matching bearer token', () => {
    expect(isAuthorizedCronRequest('Bearer abc123', 'abc123')).toBe(true);
  });

  it('rejects a missing header', () => {
    expect(isAuthorizedCronRequest(null, 'abc123')).toBe(false);
  });

  it('rejects a mismatched token', () => {
    expect(isAuthorizedCronRequest('Bearer wrong', 'abc123')).toBe(false);
  });
});
