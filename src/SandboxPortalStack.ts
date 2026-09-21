import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, CfnOutput, Duration, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface SandboxPortalStackProps extends StackProps, Configurable { }

/**
 * "Mijn Sandbox Portal" - the learning application.
 *
 * This is a CDK *stack*: a unit of deployment that maps 1:1 to a single
 * CloudFormation stack. Everything defined inside it (Lambda functions,
 * APIs, tables, buckets, ...) gets created, updated, and torn down
 * together. Grouping resources this way means `cdk deploy` and
 * `cdk destroy` operate on the whole application at once, instead of
 * you having to individually track dozens of separate resources.
 *
 * For now this stack is deployed directly with `cdk deploy
 * SandboxPortalStack` while we build features by hand. Later it can be
 * wrapped in a CDK *stage* and added to the existing PipelineStack for
 * automatic deploys - see PipelineStack.ts.
 */
export class SandboxPortalStack extends Stack {
  constructor(scope: Construct, id: string, props: SandboxPortalStackProps) {
    super(scope, id, props);
    Tags.of(this).add('Project', Statics.projectName);

    // Gemeente Nijmegen's landing zone denies IAM role creation unless the
    // role carries this specific permissions boundary (enforced by an SCP
    // at the org level). This aspect scans the stack for IAM roles/users
    // (including ones created implicitly by high-level constructs like
    // NodejsFunction) and attaches it automatically. See PipelineStack.ts
    // for the same pattern.
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    // A dedicated log group with a short retention period. Left
    // unconfigured, Lambda would create a log group that keeps logs
    // forever - fine for production, wasteful (and slightly costly at
    // scale) for a learning project.
    const healthLogGroup = new LogGroup(this, 'health-logs', {
      retention: RetentionDays.THREE_DAYS,
    });
    const versionLogGroup = new LogGroup(this, 'version-logs', {
      retention: RetentionDays.THREE_DAYS,
    });

    // NodejsFunction bundles this TypeScript file (and its dependencies)
    // into a single JavaScript file using esbuild, at `cdk synth` time.
    // No manual `tsc` build step and no Docker required.
    const healthLambda = new NodejsFunction(this, 'health-lambda', {
      entry: `${__dirname}/lambda/health/index.ts`,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(5),
      logGroup: healthLogGroup,
      environment: {
        LOG_LEVEL: props.configuration.logLevel ?? 'INFO',
      },
    });

    const versionLambda = new NodejsFunction(this, 'version-lambda', {
      entry: `${__dirname}/lambda/version/index.ts`,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(5),
      logGroup: versionLogGroup,
      environment: {
        LOG_LEVEL: props.configuration.logLevel ?? 'INFO',
      },
    });

    // API Gateway HTTP API: a cheap, low-latency way to route HTTP
    // requests to Lambda functions. No servers to patch or scale -
    // AWS runs the routing layer for us ("serverless").
    const httpApi = new HttpApi(this, 'http-api', {
      apiName: `${Statics.projectName}-api`,
      description: 'Mijn Sandbox Portal HTTP API',
    });

    httpApi.addRoutes({
      path: '/health',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('health-integration', healthLambda),
    });

    httpApi.addRoutes({
      path: '/version',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('version-integration', versionLambda),
    });

    new CfnOutput(this, 'api-url', {
      value: httpApi.apiEndpoint,
      description: 'Base URL of the HTTP API (try appending /health)',
    });
  }
}
