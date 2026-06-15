{
  "Comment": "CogniMesh pipeline orchestrator - Vaquar Pattern: Rules -> Physical -> Verify -> Metadata",
  "StartAt": "IntegrityGate",
  "States": {
    "IntegrityGate": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": {
        "FunctionName": "${name_prefix}-integrity-gate",
        "Payload.$": "$"
      },
      "ResultPath": "$.gate",
      "Next": "GateChoice"
    },
    "GateChoice": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.gate.Payload.passed",
          "BooleanEquals": true,
          "Next": "ExtractSource"
        }
      ],
      "Default": "IntegrityFailed"
    },
    "IntegrityFailed": {
      "Type": "Fail",
      "Error": "IntegrityGateFailed",
      "Cause": "Vaquar-inspired integrity gate did not pass"
    },
    "ExtractSource": {
      "Type": "Task",
      "Resource": "arn:aws:states:::glue:startJobRun.sync",
      "Parameters": {
        "JobName": "${name_prefix}-extract"
      },
      "Next": "Transform"
    },
    "Transform": {
      "Type": "Task",
      "Resource": "arn:aws:states:::glue:startJobRun.sync",
      "Parameters": {
        "JobName": "${name_prefix}-transform"
      },
      "Next": "LoadTarget"
    },
    "LoadTarget": {
      "Type": "Task",
      "Resource": "arn:aws:states:::glue:startJobRun.sync",
      "Parameters": {
        "JobName": "${name_prefix}-load-iceberg"
      },
      "End": true
    }
  }
}
