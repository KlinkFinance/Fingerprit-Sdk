import {
  FingerprintSDKError,
  FingerprintAPIError,
  FingerprintNetworkError,
  FingerprintTimeoutError,
  FingerprintAuthError,
  FingerprintConfigError,
  FingerprintValidationError,
  FingerprintBlockedError,
} from '../errors';

describe('FingerprintSDKError', () => {
  it('sets message and code', () => {
    const err = new FingerprintSDKError('msg', 'CODE');
    expect(err.message).toBe('msg');
    expect(err.code).toBe('CODE');
  });

  it('is instanceof Error', () => {
    expect(new FingerprintSDKError('msg', 'CODE')).toBeInstanceOf(Error);
  });
});

describe('FingerprintAPIError', () => {
  const err = new FingerprintAPIError('not found', 404, { detail: 'missing' });

  it('has statusCode', () => expect(err.statusCode).toBe(404));
  it('has code API_ERROR', () => expect(err.code).toBe('API_ERROR'));
  it('stores responseBody', () => expect(err.responseBody).toEqual({ detail: 'missing' }));
  it('is instanceof FingerprintSDKError', () => expect(err).toBeInstanceOf(FingerprintSDKError));
  it('is instanceof Error', () => expect(err).toBeInstanceOf(Error));
});

describe('FingerprintNetworkError', () => {
  const err = new FingerprintNetworkError('connection refused');

  it('has code NETWORK_ERROR', () => expect(err.code).toBe('NETWORK_ERROR'));
  it('has correct message', () => expect(err.message).toBe('connection refused'));
  it('is instanceof FingerprintSDKError', () => expect(err).toBeInstanceOf(FingerprintSDKError));
  it('is instanceof Error', () => expect(err).toBeInstanceOf(Error));

  it('accepts an optional cause', () => {
    const cause = new Error('root cause');
    const withCause = new FingerprintNetworkError('wrapped', cause);
    expect(withCause.cause).toBe(cause);
  });
});

describe('FingerprintTimeoutError', () => {
  const err = new FingerprintTimeoutError(5000);

  it('has timeoutMs', () => expect(err.timeoutMs).toBe(5000));
  it('message contains the timeout value', () => expect(err.message).toContain('5000'));
  it('has code TIMEOUT_ERROR', () => expect(err.code).toBe('TIMEOUT_ERROR'));
  it('is instanceof FingerprintSDKError', () => expect(err).toBeInstanceOf(FingerprintSDKError));
  it('is instanceof Error', () => expect(err).toBeInstanceOf(Error));
});

describe('FingerprintAuthError', () => {
  const err401 = new FingerprintAuthError('unauthorized', 401);
  const err403 = new FingerprintAuthError('forbidden', 403);

  it('has statusCode 401', () => expect(err401.statusCode).toBe(401));
  it('has statusCode 403', () => expect(err403.statusCode).toBe(403));
  it('has code AUTH_ERROR', () => expect(err401.code).toBe('AUTH_ERROR'));
  it('is instanceof FingerprintSDKError', () => expect(err401).toBeInstanceOf(FingerprintSDKError));
  it('is instanceof Error', () => expect(err401).toBeInstanceOf(Error));
});

describe('FingerprintConfigError', () => {
  const err = new FingerprintConfigError('bad config');

  it('has code CONFIG_ERROR', () => expect(err.code).toBe('CONFIG_ERROR'));
  it('has correct message', () => expect(err.message).toBe('bad config'));
  it('is instanceof FingerprintSDKError', () => expect(err).toBeInstanceOf(FingerprintSDKError));
  it('is instanceof Error', () => expect(err).toBeInstanceOf(Error));
});

describe('FingerprintValidationError', () => {
  it('has code VALIDATION_ERROR', () => {
    const err = new FingerprintValidationError('invalid payload', 400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('has statusCode', () => {
    const err = new FingerprintValidationError('invalid payload', 422);
    expect(err.statusCode).toBe(422);
  });

  it('defaults statusCode to 400', () => {
    const err = new FingerprintValidationError('invalid payload');
    expect(err.statusCode).toBe(400);
  });

  it('is instanceof FingerprintSDKError', () => {
    expect(new FingerprintValidationError('msg', 400)).toBeInstanceOf(FingerprintSDKError);
  });

  it('is instanceof Error', () => {
    expect(new FingerprintValidationError('msg', 400)).toBeInstanceOf(Error);
  });
});

describe('FingerprintBlockedError', () => {
  const err = new FingerprintBlockedError(['webdriver'], 100);

  it('has flags array', () => expect(err.flags).toEqual(['webdriver']));
  it('has riskScore', () => expect(err.riskScore).toBe(100));
  it('has code BLOCKED_ERROR', () => expect(err.code).toBe('BLOCKED_ERROR'));
  it('is instanceof FingerprintSDKError', () => expect(err).toBeInstanceOf(FingerprintSDKError));
  it('is instanceof Error', () => expect(err).toBeInstanceOf(Error));
});
