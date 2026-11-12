#!/usr/bin/env bash
# Imports a sample CRITICAL finding into AWS Security Hub in the current
# account/region. Does not change any resources.
#
# Usage: scripts/import-sample-finding.sh [region]
#   Uses your current AWS credentials/profile (AWS_PROFILE etc.).
set -euo pipefail

REGION="${1:-${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-1}}}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ID="sample-critical-$(date -u +%s)"

FINDINGS=$(cat <<JSON
[{
  "SchemaVersion": "2018-10-08",
  "Id": "${ID}",
  "ProductArn": "arn:aws:securityhub:${REGION}:${ACCOUNT}:product/${ACCOUNT}/default",
  "GeneratorId": "sample-finding-test",
  "AwsAccountId": "${ACCOUNT}",
  "Types": ["Software and Configuration Checks/Vulnerabilities/CVE"],
  "CreatedAt": "${NOW}",
  "UpdatedAt": "${NOW}",
  "FirstObservedAt": "${NOW}",
  "Severity": { "Label": "CRITICAL" },
  "Title": "Sample critical finding (health lambda is publicly invokable)",
  "Description": "Manually imported sample finding to test Security Hub visibility and alerting.",
  "Remediation": { "Recommendation": { "Text": "This is a sample finding. Archive it when done." } },
  "Resources": [{ "Type": "Other", "Id": "sample-resource-${ID}", "Region": "${REGION}" }],
  "Workflow": { "Status": "NEW" },
  "RecordState": "ACTIVE"
}]
JSON
)

aws securityhub batch-import-findings --region "$REGION" --findings "$FINDINGS"
echo "Imported ${ID} into ${REGION} (account ${ACCOUNT})."
echo "View: Security Hub -> Findings, filter Severity label = CRITICAL."
