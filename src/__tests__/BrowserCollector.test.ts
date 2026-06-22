import { BrowserCollector } from '../collectors/BrowserCollector';

// Running under Node (no window), so BrowserCollector should report unavailability
// and return an empty object from collect().

describe('BrowserCollector — Node environment', () => {
  it('isAvailable() returns false', () => {
    expect(BrowserCollector.isAvailable()).toBe(false);
  });

  it('collect() resolves to an empty object', async () => {
    const result = await BrowserCollector.collect();
    expect(result).toEqual({});
  });

  it('collect() return value is a Promise', () => {
    const ret = BrowserCollector.collect();
    expect(ret).toBeInstanceOf(Promise);
  });
});
