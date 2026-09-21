import { App } from 'aws-cdk-lib';
import { getEnvironmentConfiguration } from './Configuration';
import { PipelineStack } from './PipelineStack';
import { SandboxPortalStack } from './SandboxPortalStack';

const app = new App();

const branchToBuild = process.env.BRANCH_NAME ?? 'development';
const configuration = getEnvironmentConfiguration(branchToBuild);

/**
 * Manual deploy target for the learning app: `npx cdk deploy
 * SandboxPortalStack`. This talks directly to the sandbox account and
 * skips the CodePipeline entirely - fast to iterate on while we're
 * still building things by hand. See SandboxPortalStack.ts.
 */
new SandboxPortalStack(app, 'SandboxPortalStack', {
  env: configuration.deploymentEnvironment,
  configuration,
});

/**
 * The existing CI/CD pipeline stack. Not used yet - we'll hook the
 * SandboxPortalStack into it as a pipeline stage once the manually
 * deployed version works end-to-end (see the project README).
 */
new PipelineStack(app, configuration.pipelineStackCdkName, {
  env: configuration.buildEnvironment,
  configuration,
});

app.synth();
