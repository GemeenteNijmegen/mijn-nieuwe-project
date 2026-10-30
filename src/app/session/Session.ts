import { Cookie } from './cookie';

export type Session = {
  sessionId: string;
  userId: string;
  createdAt: number; // Unix timestamp in seconds
  expiresAt: number; // Unix timestamp in seconds
};

export interface CreatedSession {
  session: Session;
  cookie: Cookie;
}