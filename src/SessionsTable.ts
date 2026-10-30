import { aws_dynamodb as DynamoDB, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './Statics';


/**
 * The Sessions Table is a DynamoDB table which stores
 * short-lived session data. The application is responsible
 * for using the table correctly, the table provides a 'sessionId'
 * partition key and a 'expiresAt' attribute.
 */
export class SessionsTable extends Construct {
  table: DynamoDB.Table;
  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.table = new DynamoDB.Table(this, Statics.sessionTableName, {
      partitionKey: { name: 'sessionId', type: DynamoDB.AttributeType.STRING },
      billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
