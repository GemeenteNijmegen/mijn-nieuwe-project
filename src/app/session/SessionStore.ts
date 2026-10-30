import { Session } from './Session';

export interface SessionStore {
  get(sessionId: string): Promise<Session | undefined>;
  put(session: Session): Promise<void>;
  delete(sessionId: string): Promise<void>;
}