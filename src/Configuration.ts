import { Statics } from './Statics';

/**
 * Adds a configuration field to another interface
 */
export interface Configurable {
  configuration: Configuration;
}

/**
 * Environment object (required fields)
 */
export interface Environment {
  account: string;
  region: string;
}

/**
 * Basic configuration options per environment
 */
export interface Configuration {
  /**
     * Branch name for the applicible branch (this branch)
     */
  branch: string;

  /**
     * The pipeline will run from this environment
     *
     * Use this environment for your initial manual deploy
     */
  buildEnvironment: Environment;

  /**
     * Environment to deploy the application to
     *
     * The pipeline (which usually runs in the build account) will
     * deploy the application to this environment. This is usually
     * the workload AWS account in our default region.
     */
  deploymentEnvironment: Environment;

  /**
     * The CDK name of the pipeline stack (can be removed after
     * moving to new lz)
     */
  pipelineStackCdkName: string;
  pipelineName: string;

  /**
     * Sets the log level for parts of this application
     * @default INFO
     */
  readonly logLevel?: 'DEBUG' | 'INFO' | 'ERROR';

  /**
     * Additional node options passed to the app lambdas
     * @default -
     */
  readonly nodeOptions?: string;
}


const EnvironmentConfigurations: { [key: string]: Configuration } = {
  development: {
    branch: 'development',
    buildEnvironment: Statics.gnSandBoxIndyEnvironment,
    deploymentEnvironment: Statics.gnSandBoxIndyEnvironment,
    pipelineStackCdkName: 'mijnnieuweproject-pipeline-development',
    pipelineName: 'mijnnieuweproject-development',
    logLevel: 'DEBUG',
  },
};

/**
 * Retrieve a configuration object by passing a branch string
 *
 * **NB**: This retrieves the subobject with key `branchName`, not
 * the subobject containing the `branchName` as the value of the `branch` key
 *
 * @param branchName the branch for which to retrieve the environment
 * @returns the configuration object for this branch
 */
export function getEnvironmentConfiguration(branchName: string): Configuration {
  const conf = EnvironmentConfigurations[branchName];
  if (!conf) {
    throw Error(`No configuration found for branch ${branchName}`);
  }
  return conf;
}
