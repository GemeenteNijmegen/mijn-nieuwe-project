import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, CfnOutput, Duration, RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
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
    const homeLogGroup = new LogGroup(this, 'home-logs', {
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

    // The home handler imports a `.mustache` file as a plain string. By
    // default esbuild doesn't know what to do with a `.mustache`
    // extension, so we tell it (via `bundling.loader`) to treat that
    // extension as raw text and inline its contents into the bundled
    // JS file at build time.
    const homeLambda = new NodejsFunction(this, 'home-lambda', {
      entry: `${__dirname}/lambda/home/index.ts`,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(5),
      logGroup: homeLogGroup,
      environment: {
        LOG_LEVEL: props.configuration.logLevel ?? 'INFO',
      },
      bundling: {
        loader: { '.mustache': 'text' },
      },
    });

    // Static assets (CSS, images) belong in S3, not in a Lambda. They
    // don't change per-request, don't need any server-side logic to
    // produce, and S3 serves them far cheaper and faster than paying
    // for a Lambda invocation on every page load of a stylesheet.
    //
    // This bucket is kept private (BLOCK_ALL public access, SSL-only,
    // encrypted) - it is not reachable from a browser yet. Making an S3
    // bucket public is a common source of real-world data leaks, so we
    // don't do that even for static assets. Once CloudFront is added in
    // a later phase, it will read from this bucket privately (via an
    // Origin Access Control) and be the thing browsers actually talk
    // to - the same CloudFront distribution will also sit in front of
    // the HTTP API, so static and dynamic content end up on one domain.
    const staticAssetsBucket = new Bucket(this, 'static-assets', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Sandbox/learning defaults: let `cdk destroy` fully remove this
      // bucket (including its contents) instead of leaving an empty
      // bucket behind forever, which is what CDK does by default
      // (RemovalPolicy.RETAIN) to protect real data.
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Uploads everything in the repo's static/ folder to the bucket
    // at deploy time. Under the hood this provisions a temporary,
    // deploy-time-only Lambda (a CDK "custom resource") that does the
    // upload - the same bundling machinery as NodejsFunction, just
    // packaging a folder of assets instead of a handler.
    new BucketDeployment(this, 'static-assets-deployment', {
      destinationBucket: staticAssetsBucket,
      sources: [Source.asset(`${__dirname}/../static`)],
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

    httpApi.addRoutes({
      path: '/home',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('home-integration', homeLambda),
    });

    new CfnOutput(this, 'api-url', {
      value: httpApi.apiEndpoint,
      description: 'Base URL of the HTTP API (try appending /health)',
    });

    new CfnOutput(this, 'static-assets-bucket-name', {
      value: staticAssetsBucket.bucketName,
      description: 'S3 bucket holding static assets (private - not browser-reachable yet)',
    });
  }
}
