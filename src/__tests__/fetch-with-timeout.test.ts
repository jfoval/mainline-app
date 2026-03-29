import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

// Polyfill AbortController for the test environment
global.AbortController = AbortController;

describe('fetchWithTimeout', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves with the response on a successful fetch', async () => {
    const mockResponse = new Response('OK', { status: 200 });
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await fetchWithTimeout('https://example.com/api');
    expect(result.status).toBe(200);
  });

  it('passes options through to fetch', async () => {
    const mockResponse = new Response('{}', { status: 201 });
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

    const options: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'value' }),
    };

    await fetchWithTimeout('https://example.com/api', options);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('attaches an AbortSignal to the request', async () => {
    const mockResponse = new Response('OK', { status: 200 });
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

    await fetchWithTimeout('https://example.com/api');

    const calledOptions = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(calledOptions.signal).toBeDefined();
    expect(calledOptions.signal).toBeInstanceOf(AbortSignal);
  });

  it('aborts the request when the timeout fires', async () => {
    jest.useFakeTimers();

    // fetch never resolves — simulates a hanging request
    jest.spyOn(global, 'fetch').mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          (options?.signal as AbortSignal)?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );

    const promise = fetchWithTimeout('https://example.com/api', undefined, 5000);
    jest.advanceTimersByTime(5001);

    await expect(promise).rejects.toThrow('Aborted');
    jest.useRealTimers();
  });

  it('clears the timeout after a successful fetch (no lingering timers)', async () => {
    jest.useFakeTimers();
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('OK', { status: 200 }));

    await fetchWithTimeout('https://example.com/api', undefined, 10000);

    expect(clearSpy).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
