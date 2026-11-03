import { Cookie } from '../../../src/app/session/cookie';
import { InMemorySessionStore } from '../../../src/app/session/InMemorySessionStore';
import { SessionService } from '../../../src/app/session/SessionService';
import { SessionStore } from '../../../src/app/session/SessionStore';

/**
 * A browser stores the full `Set-Cookie` header but only sends back
 * `name=value` (that's what ends up in `event.cookies`).
 */
function asRequestCookie(cookie: Cookie): string {
  return cookie.toString().split(';')[0];
}

describe('SessionService', () => {
  const ttlSeconds = 900;
  let now: number;
  let sessionStore: SessionStore;
  let sessionService: SessionService;

  beforeEach(() => {
    now = 1_000_000;
    sessionStore = new InMemorySessionStore();
    sessionService = new SessionService(sessionStore, {
      ttlSeconds,
      cookieSecure: true,
      cookiePath: '/',
      now: () => now,
    });
  });

  describe('create', () => {
    test('create and load a session', async () => {
      const userId = 'user123';
      const { session, cookie } = await sessionService.create(userId);

      expect(session.userId).toBe(userId);

      const loadedSession = await sessionService.load([asRequestCookie(cookie)]);
      expect(loadedSession).toEqual(session);
    });

    test('sets createdAt and expiresAt from the clock', async () => {
      const { session } = await sessionService.create('user123');

      expect(session.createdAt).toBe(now);
      expect(session.expiresAt).toBe(now + ttlSeconds);
    });

    test('session id is 32 random bytes in base64url', async () => {
      const { session } = await sessionService.create('user123');

      expect(session.sessionId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    test('every session gets a new id', async () => {
      const first = await sessionService.create('user123');
      const second = await sessionService.create('user123');

      expect(first.session.sessionId).not.toBe(second.session.sessionId);
    });

    test('cookie has the secure flags', async () => {
      const { session, cookie } = await sessionService.create('user123');
      const header = cookie.toString();

      expect(header.startsWith(`sessionId=${session.sessionId};`)).toBe(true);
      expect(header).toContain('HttpOnly');
      expect(header).toContain('Secure');
      expect(header).toContain('SameSite=Lax');
      expect(header).toContain('Path=/');
      expect(header).toContain(`Max-Age=${ttlSeconds}`);
    });

    test('cookie has no Secure flag when cookieSecure is false', async () => {
      const localService = new SessionService(sessionStore, {
        ttlSeconds,
        cookieSecure: false,
        cookiePath: '/',
        now: () => now,
      });
      const { cookie } = await localService.create('user123');

      expect(cookie.toString()).not.toContain('Secure');
    });
  });

  describe('expiry', () => {
    test('session is valid one second before it expires', async () => {
      const { session, cookie } = await sessionService.create('user123');
      now += ttlSeconds - 1;

      expect(await sessionService.load([asRequestCookie(cookie)])).toEqual(session);
    });

    test('session is gone at expiresAt', async () => {
      const { cookie } = await sessionService.create('user123');
      now += ttlSeconds;

      expect(await sessionService.load([asRequestCookie(cookie)])).toBeUndefined();
    });

    test('expired session is rejected even if the store still has it (TTL is eventual)', async () => {
      const { session, cookie } = await sessionService.create('user123');
      now += ttlSeconds + 3600;

      expect(await sessionStore.get(session.sessionId)).toBeDefined();
      expect(await sessionService.load([asRequestCookie(cookie)])).toBeUndefined();
    });
  });

  describe('destroy', () => {
    test('session can no longer be loaded', async () => {
      const { session, cookie } = await sessionService.create('user123');

      await sessionService.destroy(session.sessionId);

      expect(await sessionService.load([asRequestCookie(cookie)])).toBeUndefined();
      expect(await sessionStore.get(session.sessionId)).toBeUndefined();
    });

    test('returns a cookie that clears the session cookie', async () => {
      const { session } = await sessionService.create('user123');

      const expired = await sessionService.destroy(session.sessionId);
      const header = expired.toString();

      expect(header.startsWith('sessionId=;')).toBe(true);
      expect(header).toContain('Max-Age=0');
      expect(header).toContain('Path=/');
    });
  });

  describe('load', () => {
    test.each([
      ['undefined', undefined],
      ['an empty list', []],
      ['only other cookies', ['theme=dark', 'lang=nl']],
    ])('returns undefined for %s', async (_, cookies) => {
      expect(await sessionService.load(cookies)).toBeUndefined();
    });

    test('finds the session cookie between other cookies', async () => {
      const { session, cookie } = await sessionService.create('user123');

      const loaded = await sessionService.load(['theme=dark', ` ${asRequestCookie(cookie)} `, 'lang=nl']);

      expect(loaded).toEqual(session);
    });

    test('returns undefined for a well-formed but unknown session id', async () => {
      const unknownId = 'A'.repeat(43);

      expect(await sessionService.load([`sessionId=${unknownId}`])).toBeUndefined();
    });

    test.each([
      ['an empty value', ''],
      ['too short', 'abc'],
      ['too long', 'A'.repeat(44)],
      ['invalid characters', `${'A'.repeat(42)}=`],
      ['standard base64 characters', `${'A'.repeat(41)}+/`],
      ['an injection attempt', `${'A'.repeat(20)}' OR 1=1 --`],
      ['a very long value', 'A'.repeat(10_000)],
    ])('returns undefined (not a crash) for %s', async (_, value) => {
      await expect(sessionService.load([`sessionId=${value}`])).resolves.toBeUndefined();
    });

    test('does not match a cookie whose name only starts with sessionId', async () => {
      const { session } = await sessionService.create('user123');

      expect(await sessionService.load([`sessionIdOld=${session.sessionId}`])).toBeUndefined();
    });
  });
});
