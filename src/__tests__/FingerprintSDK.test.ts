import { FingerprintSDK } from '../FingerprintSDK';
import { FingerprintConfigError } from '../errors';

const VALID_CONFIG = { baseUrl: 'https://fingerprint.klinkfinance.com' };

describe('FingerprintSDK — config validation', () => {
  it('throws FingerprintConfigError when baseUrl is missing', () => {
    expect(() => new FingerprintSDK({} as never)).toThrow(FingerprintConfigError);
  });

  it('throws FingerprintConfigError when baseUrl is an empty string', () => {
    expect(() => new FingerprintSDK({ baseUrl: '' })).toThrow(FingerprintConfigError);
  });

  it('throws FingerprintConfigError when baseUrl is not a valid URL', () => {
    expect(() => new FingerprintSDK({ baseUrl: 'not-a-url' })).toThrow(FingerprintConfigError);
  });

  it('throws FingerprintConfigError when timeout is negative', () => {
    expect(() => new FingerprintSDK({ ...VALID_CONFIG, timeout: -1 })).toThrow(FingerprintConfigError);
  });

  it('throws FingerprintConfigError when timeout is zero', () => {
    // timeout <= 0 is invalid per the source
    expect(() => new FingerprintSDK({ ...VALID_CONFIG, timeout: 0 })).toThrow(FingerprintConfigError);
  });

  it('throws FingerprintConfigError when retries is negative', () => {
    expect(() => new FingerprintSDK({ ...VALID_CONFIG, retries: -1 })).toThrow(FingerprintConfigError);
  });

  it('does not throw for valid config', () => {
    expect(() => new FingerprintSDK(VALID_CONFIG)).not.toThrow();
  });

  it('does not throw when retries is 0', () => {
    expect(() => new FingerprintSDK({ ...VALID_CONFIG, retries: 0 })).not.toThrow();
  });

  it('does not throw when timeout is a positive number', () => {
    expect(() => new FingerprintSDK({ ...VALID_CONFIG, timeout: 5000 })).not.toThrow();
  });
});

describe('FingerprintSDK — service properties', () => {
  let sdk: FingerprintSDK;

  beforeAll(() => {
    sdk = new FingerprintSDK(VALID_CONFIG);
  });

  it('exposes fingerprint service', () => expect(sdk.fingerprint).toBeDefined());
  it('exposes fraud service', () => expect(sdk.fraud).toBeDefined());
  it('exposes bot service', () => expect(sdk.bot).toBeDefined());
  it('exposes tokens service', () => expect(sdk.tokens).toBeDefined());
  it('exposes offers service', () => expect(sdk.offers).toBeDefined());
  it('exposes status service', () => expect(sdk.status).toBeDefined());
});

describe('FingerprintSDK — getConfig()', () => {
  it('returns a frozen object', () => {
    const sdk = new FingerprintSDK(VALID_CONFIG);
    const config = sdk.getConfig();
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('returned config contains the supplied baseUrl', () => {
    const sdk = new FingerprintSDK(VALID_CONFIG);
    expect(sdk.getConfig().baseUrl).toBe(VALID_CONFIG.baseUrl);
  });

  it('returned config reflects all supplied fields', () => {
    const full = { ...VALID_CONFIG, apiKey: 'key-123', timeout: 8000, retries: 2 };
    const sdk = new FingerprintSDK(full);
    const config = sdk.getConfig();
    expect(config.apiKey).toBe('key-123');
    expect(config.timeout).toBe(8000);
    expect(config.retries).toBe(2);
  });
});
