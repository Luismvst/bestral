import { describe, it, expect } from 'vitest';
import { APP_NAME } from './version';

describe('version', () => {
  it('expone el nombre de la aplicación', () => {
    expect(APP_NAME).toBe('Bestral');
  });
});
