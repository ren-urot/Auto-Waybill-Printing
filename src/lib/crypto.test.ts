import { describe, it, expect, beforeAll } from 'vitest';
import { encryptToken, decryptToken } from './crypto';

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});

describe('token encryption', () => {
  it('round-trips a plaintext token', () => {
    const ciphertext = encryptToken('shpat_secret_value');
    expect(ciphertext).not.toContain('shpat_secret_value');
    expect(decryptToken(ciphertext)).toBe('shpat_secret_value');
  });

  it('produces different ciphertext for the same plaintext each call', () => {
    const a = encryptToken('same-value');
    const b = encryptToken('same-value');
    expect(a).not.toBe(b);
  });

  it('throws on malformed ciphertext', () => {
    expect(() => decryptToken('not-valid')).toThrow();
  });
});
