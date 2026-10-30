import { DynamoSessionStore } from './DynamoSessionStore';
import { InMemorySessionStore } from './InMemorySessionStore';
import { SessionService } from './SessionService';
import { SessionStore } from './SessionStore';

export function createSessionStore(): SessionStore {
  const storeType = process.env.SESSION_STORE_TYPE;
  if (!storeType) {
    throw new Error('SESSION_STORE_TYPE environment variable is not set.');
  }
  if (storeType === 'in-memory') {
    return new InMemorySessionStore();
  }
  if (storeType === 'dynamo') {
    const tableName = process.env.SESSION_TABLE_NAME;
    if (!tableName) {
      throw new Error('SESSION_TABLE_NAME environment variable is not set for DynamoDB session store.');
    }
    return new DynamoSessionStore(tableName);
  }
  throw new Error(`Unsupported session store type: ${storeType}`);
}

export function createSessionService(store: SessionStore = createSessionStore()): SessionService {
  return new SessionService(store, {
    ttlSeconds: 900, // 15 minutes
    cookieSecure: process.env.COOKIE_SECURE !== 'false', // default to true unless explicitly set to 'false'
    cookiePath: process.env.COOKIE_PATH ?? '/', // default to root path
  });
}