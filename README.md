# Multi-Region FunctionGraph Layer Distribution

[![License: MIT-0](https://img.shields.io/badge/License-MIT--0-blue.svg)](LICENSE)
[![Huawei Cloud](https://img.shields.io/badge/Huawei%20Cloud-FunctionGraph-orange)](https://www.huaweicloud.com/product/functiongraph.html)

## Overview

This solution provides an automated CI/CD pipeline for building and distributing FunctionGraph (Huawei Cloud Serverless Functions) Layers across multiple Huawei Cloud regions. It uses CodeArts Pipeline for orchestration, CloudBuild for construction, OBS for artifact storage, and FunctionGraph for Layer distribution.

**Problem Solved**: Manually publishing the same Layer to multiple Huawei Cloud regions is time-consuming and error-prone. This solution implements full automation from code push to multi-region Layer distribution.

**Target Users**: Developers and DevOps teams who need to share common code (dependencies, utilities, runtime) across FunctionGraph functions deployed in multiple Huawei Cloud regions.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Key Features](#key-features)
4. [Cloud Services and Costs](#cloud-services-and-costs)
5. [Prerequisites](#prerequisites)
6. [Quick Start](#quick-start)
7. [Step-by-Step Deployment](#step-by-step-deployment)
8. [Usage](#usage)
9. [Cleanup](#cleanup)
10. [Detailed Documentation](#detailed-documentation)
11. [Dependencies and Acknowledgments](#dependencies-and-acknowledgments)
12. [FAQ / Troubleshooting](#faq--troubleshooting)
13. [Contributing](#contributing)
14. [License](#license)
15. [Contact](#contact)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Huawei Cloud Architecture                           │
│            Multi-Region FunctionGraph Layer Distribution               │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐      ┌──────────────┐      ┌──────────────────────────┐
  │ CodeHub  │──────│  CloudBuild │──────│   OBS (layer.zip)        │
  │ (Source) │      │  (Build)    │      │   cn-north-4            │
  └──────────┘      └──────────────┘      └────────────┬─────────────┘
                                                        │
                       ┌────────────────────────────────┼────────────────┐
                       │         CodeArts Pipeline       │                │
                       │  Source → Build → Distribute   │                │
                       │                                │                │
                       │   Distribute Stage (parallel):  │                │
                       │   ┌──────────┐ ┌──────────┐   │                │
                       │   │ FnGraph  │ │ FnGraph  │   │                │
                       │   │ cn-east-1│ │ cn-south-1│  │                │
                       │   └────┬─────┘ └────┬─────┘   │                │
                       │        │             │         │                │
                       │   OBS Bucket    OBS Bucket     │                │
                       │   (Region 1)   (Region 2)    │                │
                       └────────────────────────────────┼────────────────┘
```

**Core Components**:
- **CodeHub**: Git repository for Layer source code
- **CloudBuild**: Build system that packages npm dependencies into layer.zip
- **OBS**: Layer artifact storage (primary region + regional buckets)
- **CodeArts Pipeline**: CI/CD orchestration with Source → Build → Distribute stages
- **FunctionGraph**: Serverless functions that distribute Layers to each target region

---

## Key Features

- **Fully Automated Distribution**: Code push to CodeHub → automatic multi-region Layer publication
- **Parallel Execution**: Layers distributed to all target regions simultaneously
- **Serverless**: No servers to manage; FunctionGraph handles execution
- **Cost-Efficient**: Pay only for build minutes and function invocations
- **Infrastructure as Code**: Fully Terraform-deployed, reproducible environments

---

## Cloud Services and Costs

| Service | Spec | 
|---------|------|---------------------|-------|
| OBS | Standard storage, ~100MB |
| CodeArts Pipeline | 1 pipeline | 
| CloudBuild | 1 build minute | 
| FunctionGraph | 512MB, 15s timeout | 

---

## Prerequisites

### 1. Huawei Cloud Account
- Valid AKSK credentials for Huawei Cloud
- Access to target regions (default: cn-north-4, cn-east-1, cn-south-1)

### 2. IAM Permissions
- IAM FullAccess (or minimum: FunctionGraph, OBS, CodeArts, CodeHub permissions)
- Ability to create IAM agencies

### 3. Tools
- **Terraform** ≥ 1.5.0 ([Install](https://developer.hashicorp.com/terraform/downloads))
- **Git** ([Install](https://git-scm.com/downloads))
- **Node.js** ≥ 18.x + npm ([Install](https://nodejs.org/))

### 4. Huawei Cloud CLI (Optional)
```bash
npm install -g @huaweicloud/huaweicloud-cli
```

---

## Quick Start

### One-Click Deployment

```bash
# 1. Clone this repository
git clone <repository-url>
cd multi-region-functiongraph-layers

# 2. Set credentials
export HW_ACCESS_KEY="<Your Access Key>"
export HW_SECRET_KEY="<Your Secret Key>"

# 3. Deploy infrastructure
cd infra
terraform init
terraform apply

# 4. Record outputs, then initialize CodeHub repository
# (See Deployment Guide Step 6 for details)
```

**Estimated deployment time: 5-10 minutes**

---

## Step-by-Step Deployment

### Step 1: Configure Credentials

```bash
export HW_ACCESS_KEY="<Your Access Key>"
export HW_SECRET_KEY="<Your Secret Key>"
export HW_REGION="cn-north-4"
```

### Step 2: Customize Variables

Edit `infra/terraform.tfvars`:

```hcl
primary_region   = "cn-north-4"
target_regions   = ["cn-north-4", "cn-east-1", "cn-south-1"]
layer_name       = "sample-layer"
layer_runtimes   = ["Node.js 18.x", "Node.js 20.x"]
```

### Step 3: Initialize and Deploy

```bash
cd infra
terraform init   # Initialize Terraform, load huaweicloud provider
terraform plan   # Review planned changes
terraform apply  # Enter 'yes' to confirm deployment
```

### Step 4: Initialize CodeHub Repository

```bash
# Get repository URL from terraform output
CODUHUB_URL=$(terraform output -raw codehub_repository_url)

# Clone, add content, push
git clone $CODUHUB_URL functiongraph-layer-source
cd functiongraph-layer-source
cp ../src/example/package.json node_layer/nodejs/
git add .
git commit -m "Initial layer content"
git push origin main
```

### Step 5: Trigger Pipeline

Pipeline triggers automatically on CodeHub push. To trigger manually:

```bash
PIPELINE_ID=$(terraform output -raw pipeline_id)
huaweicloud codearts pipeline run --region cn-north-4 --pipeline-id $PIPELINE_ID
```

---

## Usage

### Verify Layer Distribution

```bash
# Check Layers in each region
for region in cn-north-4 cn-east-1 cn-south-1; do
  echo "=== Region: $region ==="
  huaweicloud functiongraph layers list \
    --region $region \
    --layer-name sample-layer
done
```

**Expected Output**: All target regions list the Layer with version numbers.

### Use Layer in Functions

```javascript
const { FunctionGraphClient, CreateFunctionRequest } = require('@huaweicloud/huaweicloud-sdk-functiongraph');

// Create function with Layer
const request = new CreateFunctionRequest();
request.functionName = 'my-function';
request.runtime = 'Node.js 18.x';
request.layerName = 'sample-layer';
request.layerVersion = 1;  // Get from list output
```

### Bind Layer to Existing Function

```bash
huaweicloud functiongraph functions update \
  --function-name my-function \
  --layer-name sample-layer \
  --layer-version 1
```

---

## Cleanup

To avoid ongoing charges, destroy all resources:

```bash
cd infra
terraform destroy

# Enter 'yes' to confirm
# Expected: All resources destroyed
```

**Manual Cleanup (if terraform destroy fails)**:
1. Delete OBS buckets: `huaweicloud obs rm -r obs://layer-artifacts-*`
2. Delete FunctionGraph Layers in each region
3. Delete CodeHub repository (if terraform destroy fails)

---

## Detailed Documentation

| Document | Content |
|----------|---------|
| [Architecture](docs/architecture.md) | System design, components, data flow |
| [Deployment Guide](docs/deployment-guide.md) | Step-by-step deployment instructions |
| [Response Constraints](docs/response-constraints.md) | Quality gate checklist |

---

## Dependencies and Acknowledgments

**Major Dependencies**:
- [huaweicloud Provider](https://registry.terraform.io/providers/huawei/huaweicloud) - Huawei Cloud Terraform Provider
- [esdk-obs-nodejs](https://www.npmjs.com/package/esdk-obs-nodejs) - OBS Node.js SDK
- [@huaweicloud/huaweicloud-sdk-functiongraph](https://www.npmjs.com/package/@huaweicloud/huaweicloud-sdk-functiongraph) - FunctionGraph SDK

**Reference Source**:

**Related Huawei Cloud Services**:
- [FunctionGraph](https://www.huaweicloud.com/product/functiongraph.html) - Serverless Functions
- [CodeArts Pipeline](https://www.huaweicloud.com/product/codearts-pipeline.html) - CI/CD Pipeline
- [CloudBuild](https://www.huaweicloud.com/product/cloudbuild.html) - Cloud Build Service
- [OBS](https://www.huaweicloud.com/product/obs.html) - Object Storage Service

---

## FAQ / Troubleshooting

### Q: Pipeline fails at Build stage
**A**: Check CloudBuild logs:
```bash
huaweicloud cloudbuild builds list --region cn-north-4
```

### Q: Pipeline fails at Distribute stage
**A**: Check FunctionGraph function logs:
```bash
huaweicloud functiongraph functions logs \
  --region cn-north-4 \
  --function-name layer-distributor
```

### Q: OBS access denied
**A**: Verify IAM agency permissions:
```bash
huaweicloud iam agencies list --name LayerDistributorAgency
```

### Q: Layer not found in some regions
**A**: Check if OBS bucket exists in that region:
```bash
huaweicloud obs ls --region cn-east-1 --bucket layer-artifacts-xxx-cn-east-1
```

### Q: How to add more regions?
**A**: Add to `target_regions` in `terraform.tfvars`:
```hcl
target_regions = ["cn-north-4", "cn-east-1", "cn-south-1", "cn-southwest-2"]
```
Then run `terraform apply`.

---

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This library is licensed under **MIT-0**. See [LICENSE](LICENSE) file.

---

## Contact

| Role | Contact |
|------|---------|
| Maintainer | 
| Issues | Open an Issue in this repository |
| Documentation | See [docs/](docs/) directory |

---

_Last updated: 2026-08-14_
