"use strict";

const {
  buildLambdaQualifiedArn,
  resolveIntegrityGateFunctionName,
} = require("../aws/resource-arns");

/**
 * Vaquar PVDM Step Functions - resume loop after IceGuard rollback
 * @see aws-serverless-datamesh-framework stepfunctions/state_machine.asl.json.tpl
 */
function compileVaquarStateMachine(contract, options = {}) {
  const domain = contract.metadata?.domain;
  const lambdaArn = buildLambdaQualifiedArn({
    accountId: options.accountId,
    region: options.region,
    namePrefix: options.namePrefix,
    domain,
  });

  const lambdaTimeout = options.lambdaInvokeTimeoutSeconds || 930;
  const maxResumeAttempts = options.maxResumeAttempts || 8;
  const resumeWaitSeconds = options.resumeWaitSeconds || 10;
  const integrityGateFn =
    options.integrityGateFunctionName || resolveIntegrityGateFunctionName(options);

  return {
    Comment: `CogniMesh Vaquar PVDM: ${contract.metadata.name}@${contract.metadata.version}`,
    StartAt: "IntegrityGate",
    States: {
      IntegrityGate: {
        Type: "Task",
        Resource: "arn:aws:states:::lambda:invoke",
        Parameters: {
          FunctionName: integrityGateFn,
          Payload: { contract: contract },
        },
        ResultPath: "$.gate",
        Next: "GateChoice",
      },
      GateChoice: {
        Type: "Choice",
        Choices: [
          {
            Variable: "$.gate.Payload.passed",
            BooleanEquals: true,
            Next: "InitializeRetryCounter",
          },
        ],
        Default: "IntegrityFailed",
      },
      IntegrityFailed: {
        Type: "Fail",
        Error: "IntegrityGateFailed",
        Cause: "Design-time integrity gate failed",
      },
      InitializeRetryCounter: {
        Type: "Pass",
        Parameters: {
          "workload.$": "$",
          resume_attempt: 0,
          contract: contract,
        },
        Next: "InvokeDomainWriter",
      },
      InvokeDomainWriter: {
        Type: "Task",
        Resource: "arn:aws:states:::lambda:invoke",
        TimeoutSeconds: lambdaTimeout,
        Parameters: {
          FunctionName: lambdaArn,
          "Payload.$": "$.workload",
        },
        ResultSelector: {
          "outcome.$": "$.Payload.outcome",
          "workload_id.$": "$.Payload.workload_id",
          "message.$": "$.Payload.message",
          "resume_offset.$": "$.Payload.resume_offset",
          "chunks.$": "$.Payload.chunks",
          "snapshot_id.$": "$.Payload.snapshot_id",
          "vrp_verdict.$": "$.Payload.vrp_verdict",
        },
        ResultPath: "$.result",
        Retry: [
          {
            ErrorEquals: [
              "Lambda.ServiceException",
              "Lambda.AWSLambdaException",
              "Lambda.SdkClientException",
            ],
            IntervalSeconds: 5,
            MaxAttempts: 3,
            BackoffRate: 2.0,
          },
        ],
        Next: "RouteOutcome",
      },
      RouteOutcome: {
        Type: "Choice",
        Choices: [
          { Variable: "$.result.outcome", StringEquals: "committed", Next: "Success" },
          { Variable: "$.result.outcome", StringEquals: "resumed", Next: "Success" },
          { Variable: "$.result.outcome", StringEquals: "rolled_back", Next: "IncrementResumeAttempt" },
          { Variable: "$.result.outcome", StringEquals: "verification_failed", Next: "VerificationFailed" },
        ],
        Default: "UnknownFailure",
      },
      IncrementResumeAttempt: {
        Type: "Pass",
        Parameters: {
          "workload.$": "$.workload",
          "resume_attempt.$": "States.MathAdd($.resume_attempt, 1)",
          "result.$": "$.result",
        },
        Next: "CheckResumeLimit",
      },
      CheckResumeLimit: {
        Type: "Choice",
        Choices: [
          {
            Variable: "$.resume_attempt",
            NumericGreaterThanEquals: maxResumeAttempts,
            Next: "ResumeLimitExceeded",
          },
        ],
        Default: "WaitBeforeResume",
      },
      WaitBeforeResume: {
        Type: "Wait",
        Seconds: resumeWaitSeconds,
        Next: "InvokeDomainWriter",
      },
      Success: { Type: "Succeed" },
      VerificationFailed: {
        Type: "Fail",
        Error: "VerificationFailed",
        Cause: "VRP validate-then-commit blocked metadata commit. Inspect proof artifacts in S3.",
      },
      ResumeLimitExceeded: {
        Type: "Fail",
        Error: "ResumeLimitExceeded",
        Cause: "IceGuard rollback resume loop exceeded max attempts.",
      },
      UnknownFailure: {
        Type: "Fail",
        Error: "UnknownOutcome",
        Cause: "Domain writer returned an unrecognized outcome.",
      },
    },
    cognimesh: {
      pattern: "vaquar-pvdm",
      pipelineId: contract.metadata.name,
      phases: ["Rules", "Physical", "Verify", "Durable", "Metadata"],
    },
  };
}

module.exports = { compileVaquarStateMachine };
