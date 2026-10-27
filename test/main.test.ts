import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { getEnvironmentConfiguration } from '../src/Configuration';
import { SandboxPortalStack } from '../src/SandboxPortalStack';

test('Snapshot', () => {
  const app = new App();
  const config = getEnvironmentConfiguration('development');
  const stack = new SandboxPortalStack(app, 'test', {
    configuration: config,
  });

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});