import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Session } from './Session';
import { SessionStore } from './SessionStore';

// Created once per Lambda container and reused by warm invocations.
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export class DynamoSessionStore implements SessionStore {
  private tableName: string;
  private client: DynamoDBDocumentClient;

  constructor(
    tableName: string,
    client: DynamoDBDocumentClient = documentClient,
  ) {
    this.tableName = tableName;
    this.client = client;
  }

  async get(sessionId: string): Promise<Session | undefined> {
    return this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { sessionId },
    })).then(({ Item }) => Item as Session | undefined);
  }

  async put(session: Session): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: session,
    }));
  }

  async delete(sessionId: string): Promise<void> {
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { sessionId },
    }));
  }
}