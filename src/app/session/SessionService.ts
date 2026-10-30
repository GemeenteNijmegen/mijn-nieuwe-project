import { randomBytes } from 'node:crypto';
import { Cookie } from './cookie';
import { CreatedSession, Session } from './Session';
import { SessionStore } from './SessionStore';

export interface SessionServiceOptions {
  ttlSeconds: number;
  cookieSecure: boolean;
  cookiePath: string;
  now?: () => number; // Optional function to get the current time in seconds, useful for testing);
}

const COOKIE_NAME = 'sessionId';
const SESSION_ID_LENGTH = 64; // 32 bytes in base64url encoding
const SESSION_ID_REGEX = /^[A-Za-z0-9_-]+$/;

export class SessionService {
  private store: SessionStore;
  private options: SessionServiceOptions;

  constructor(sessionStore: SessionStore, options: SessionServiceOptions) {
    this.store = sessionStore;
    this.options = options;
  }


  async create(userId: string): Promise<CreatedSession> {
    const now = this.now();
    const sessionId = this.generateSessionId();
    const expiresAt = now + this.options.ttlSeconds;

    const session: Session = {
      sessionId,
      userId,
      createdAt: now,
      expiresAt,
    };

    await this.store.put(session);
    return { session, cookie: this.generateCookie(sessionId, this.options) };
  }

  async load(cookies: string[] | undefined): Promise<Session | undefined> {
    const prefix = `${COOKIE_NAME}=`;
    const sessionCookie = cookies?.map(cookie => cookie.trim()).find(cookie => cookie.startsWith(prefix));
    const sessionId = sessionCookie?.slice(prefix.length);

    if (!sessionId || !SESSION_ID_REGEX.test(sessionId)) {
      return undefined;
    }

    return this.get(sessionId);
  }

  private async get(sessionId: string): Promise<Session | undefined> {
    this.validateSessionId(sessionId);
    const session = await this.store.get(sessionId);
    if (session && session.expiresAt <= this.now()) {
      return undefined;
    }
    return session;
  }

  async destroy(sessionId: string, options: SessionServiceOptions): Promise<Cookie> {
    await this.store.delete(sessionId);
    const expiredCookie = new Cookie(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, secure: options.cookieSecure, path: options.cookiePath });
    return expiredCookie;
  }

  private generateSessionId(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateCookie(sessionId: string, options: SessionServiceOptions): Cookie {
    return new Cookie(COOKIE_NAME, sessionId, {
      httpOnly: true,
      maxAge: options.ttlSeconds,
      secure: options.cookieSecure,
      path: options.cookiePath,
    });
  }
  private now(): number {
    return this.options.now ? this.options.now() : Math.floor(Date.now() / 1000);
  }

  private validateSessionId(sessionId: string): void {
    if (!(sessionId.length === SESSION_ID_LENGTH && SESSION_ID_REGEX.test(sessionId))) {
      throw new Error('Invalid session ID');
    }
  }
}