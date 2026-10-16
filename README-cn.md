# 多区域 FunctionGraph Layer 分发

[![License: MIT-0](https://img.shields.io/badge/License-MIT--0-blue.svg)](LICENSE)
[![Huawei Cloud](https://img.shields.io/badge/Huawei%20Cloud-FunctionGraph-orange)](https://www.huaweicloud.com/product/functiongraph.html)

## 概述

本解决方案提供了一套自动化的 CI/CD 流水线，用于在多个华为云区域间构建和分发 FunctionGraph（华为云函数计算）Layers。它使用 CodeArts Pipeline 进行流程编排、CloudBuild 进行构建、OBS 进行产物存储、FunctionGraph 进行 Layer 分发。

**解决的问题**：手动将相同的 Layer 发布到多个华为云区域既耗时又容易出错。本解决方案实现了从代码推送，到多区域 Layer 分发的全流程自动化。

**适用对象**：需要在部署于多个华为云区域的 FunctionGraph 函数间共享公共代码（依赖、工具类、运行时）的开发者和 DevOps 团队。

---

## 目录

1. [概述](#概述)
2. [架构](#架构)
3. [方案亮点](#方案亮点)
4. [涉及云服务与费用](#涉及云服务与费用)
5. [前置条件](#前置条件)
6. [快速开始](#快速开始)
7. [分步部署](#分步部署)
8. [使用方法](#使用方法)
9. [清理资源](#清理资源)
10. [详细文档](#详细文档)
11. [依赖与致谢](#依赖与致谢)
12. [FAQ / 故障排除](#faq--故障排除)
13. [贡献指南](#贡献指南)
14. [许可证](#许可证)
15. [联系方式](#联系方式)

---

## 架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     华为云架构                                           │
│            多区域 FunctionGraph Layer 分发                               │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐      ┌──────────────┐      ┌──────────────────────────┐
  │ CodeHub  │──────│  CloudBuild │──────│   OBS (layer.zip)        │
  │ (代码源) │      │  (构建)     │      │   cn-north-4            │
  └──────────┘      └──────────────┘      └────────────┬─────────────┘
                                                        │
                       ┌────────────────────────────────┼────────────────┐
                       │         CodeArts Pipeline       │                │
                       │  Source → Build → Distribute   │                │
                       │                                │                │
                       │   Distribute Stage (并行):     │                │
                       │   ┌──────────┐ ┌──────────┐   │                │
                       │   │ FnGraph  │ │ FnGraph  │   │                │
                       │   │ cn-east-1│ │ cn-south-1│  │                │
                       │   └────┬─────┘ └────┬─────┘   │                │
                       │        │             │         │                │
                       │   OBS Bucket    OBS Bucket     │                │
                       │   (区域1)      (区域2)      │                │
                       └────────────────────────────────┼────────────────┘
```

**核心组件**：
- **CodeHub**：Layer 源代码的 Git 仓库
- **CloudBuild**：构建系统，将 npm 依赖打包成 layer.zip
- **OBS**：Layer 产物存储（主区域 + 各区域桶）
- **CodeArts Pipeline**：CI/CD 流程编排，Source → Build → Distribute 三个阶段
- **FunctionGraph**：无服务器函数，负责将 Layer 分发到每个目标区域

---

## 方案亮点

- **全自动化分发**：代码推送至 CodeHub → 自动多区域 Layer 发布
- **并行执行**：Layer 同时分发到所有目标区域
- **无服务器**：无需管理服务器；FunctionGraph 负责执行
- **成本高效**：仅按构建分钟数和函数调用次数付费
- **基础设施即代码**：全 Terraform 部署，环境可复现

---

## 涉及云服务与费用

| 服务 | 规格 | 
|------|------|
| OBS | 标准存储，约 100MB |
| CodeArts Pipeline | 1 条流水线 |
| CloudBuild | 1 构建分钟 |
| FunctionGraph | 512MB，15s 超时 | 

---

## 前置条件

### 1. 华为云账号
- 持有有效 AKSK 凭据的华为云账号
- 可访问目标区域（默认：cn-north-4、cn-east-1、cn-south-1）

### 2. IAM 权限
- IAM FullAccess（或最低：FunctionGraph、OBS、CodeArts、CodeHub 权限）
- 能够创建 IAM 委托

### 3. 工具
- **Terraform** ≥ 1.5.0（[安装](https://developer.hashicorp.com/terraform/downloads)）
- **Git**（[安装](https://git-scm.com/downloads)）
- **Node.js** ≥ 18.x + npm（[安装](https://nodejs.org/)）

### 4. 华为云 CLI（可选）
```bash
npm install -g @huaweicloud/huaweicloud-cli
```

---

## 快速开始

### 一键部署

```bash
# 1. 克隆本仓库
git clone <本仓库URL>
cd multi-region-functiongraph-layers

# 2. 设置凭据
export HW_ACCESS_KEY="<您的 Access Key>"
export HW_SECRET_KEY="<您的 Secret Key>"

# 3. 部署基础设施
cd infra
terraform init
terraform apply

# 4. 记录输出内容，然后初始化 CodeHub 仓库
#（详见部署指南第 6 步）
```

**预计部署时间：约 5-10 分钟**

---

## 分步部署

### 第一步：配置凭据

```bash
export HW_ACCESS_KEY="<您的 Access Key>"
export HW_SECRET_KEY="<您的 Secret Key>"
export HW_REGION="cn-north-4"
```

### 第二步：自定义变量

编辑 `infra/terraform.tfvars`：

```hcl
primary_region   = "cn-north-4"
target_regions   = ["cn-north-4", "cn-east-1", "cn-south-1"]
layer_name       = "sample-layer"
layer_runtimes   = ["Node.js 18.x", "Node.js 20.x"]
```

### 第三步：初始化并部署

```bash
cd infra
terraform init   # 初始化 Terraform，加载 huaweicloud provider
terraform plan   # 审查计划变更
terraform apply  # 输入 'yes' 确认部署
```

### 第四步：初始化 CodeHub 仓库

```bash
# 从 terraform 输出获取仓库 URL
CODUHUB_URL=$(terraform output -raw codehub_repository_url)

# 克隆、添加内容、推送
git clone $CODUHUB_URL functiongraph-layer-source
cd functiongraph-layer-source
cp ../src/example/package.json node_layer/nodejs/
git add .
git commit -m "Initial layer content"
git push origin main
```

### 第五步：触发流水线

代码推送到 CodeHub 后流水线会自动触发。如需手动触发：

```bash
PIPELINE_ID=$(terraform output -raw pipeline_id)
huaweicloud codearts pipeline run --region cn-north-4 --pipeline-id $PIPELINE_ID
```

---

## 使用方法

### 验证 Layer 分发

```bash
# 检查各区域的 Layer
for region in cn-north-4 cn-east-1 cn-south-1; do
  echo "=== 区域: $region ==="
  huaweicloud functiongraph layers list \
    --region $region \
    --layer-name sample-layer
done
```

**预期输出**：所有目标区域均列出 Layer，带版本号。

### 在函数中使用 Layer

```javascript
const { FunctionGraphClient, CreateFunctionRequest } = require('@huaweicloud/huaweicloud-sdk-functiongraph');

// 创建带 Layer 的函数
const request = new CreateFunctionRequest();
request.functionName = 'my-function';
request.runtime = 'Node.js 18.x';
request.layerName = 'sample-layer';
request.layerVersion = 1;  // 从 list 输出获取
```

### 为已有函数绑定 Layer

```bash
huaweicloud functiongraph functions update \
  --function-name my-function \
  --layer-name sample-layer \
  --layer-version 1
```

---

## 清理资源

为避免持续计费，销毁所有资源：

```bash
cd infra
terraform destroy

# 输入 'yes' 确认
# 预期：所有资源被销毁
```

**手动清理（如 terraform destroy 失败）**：
1. 删除 OBS 桶：`huaweicloud obs rm -r obs://layer-artifacts-*`
2. 删除各区域 FunctionGraph Layers
3. 删除 CodeHub 仓库（如 terraform destroy 失败）

---

## 详细文档

| 文档 | 内容 |
|------|------|
| [架构说明](docs/architecture.md) | 系统设计、组件、数据流 |
| [部署指南](docs/deployment-guide.md) | 分步部署说明 |
| [响应约束](docs/response-constraints.md) | 质量门禁清单 |

---

## 依赖与致谢

**主要依赖**：
- [huaweicloud Provider](https://registry.terraform.io/providers/huaweicloud/huaweicloud) - 华为云 Terraform Provider
- [esdk-obs-nodejs](https://www.npmjs.com/package/esdk-obs-nodejs) - OBS Node.js SDK
- [@huaweicloud/huaweicloud-sdk-functiongraph](https://www.npmjs.com/package/@huaweicloud/huaweicloud-sdk-functiongraph) - FunctionGraph SDK

**参考来源**：

**相关华为云服务**：
- [FunctionGraph](https://www.huaweicloud.com/product/functiongraph.html) - 无服务器函数
- [CodeArts Pipeline](https://www.huaweicloud.com/product/codearts-pipeline.html) - CI/CD 流水线
- [CloudBuild](https://www.huaweicloud.com/product/cloudbuild.html) - 云构建服务
- [OBS](https://www.huaweicloud.com/product/obs.html) - 对象存储服务

---

## FAQ / 故障排除

### Q: 流水线在 Build 阶段失败
**A**: 检查 CloudBuild 日志：
```bash
huaweicloud cloudbuild builds list --region cn-north-4
```

### Q: 流水线在 Distribute 阶段失败
**A**: 检查 FunctionGraph 函数日志：
```bash
huaweicloud functiongraph functions logs \
  --region cn-north-4 \
  --function-name layer-distributor
```

### Q: OBS 访问被拒绝
**A**: 验证 IAM 委托权限：
```bash
huaweicloud iam agencies list --name LayerDistributorAgency
```

### Q: 某些区域找不到 Layer
**A**: 检查该区域 OBS 桶是否存在：
```bash
huaweicloud obs ls --region cn-east-1 --bucket layer-artifacts-xxx-cn-east-1
```

### Q: 如何添加更多区域？
**A**: 在 `terraform.tfvars` 的 `target_regions` 中添加：
```hcl
target_regions = ["cn-north-4", "cn-east-1", "cn-south-1", "cn-southwest-2"]
```
然后运行 `terraform apply`。

---

## 贡献指南

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解更多。

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 提交 Pull Request

---

## 许可证

本库采用 **MIT-0 许可证**。详见 [LICENSE](LICENSE) 文件。

---

## 联系方式

| 角色 | 联系方式 |
|------|---------|
| 维护者 |
| 问题反馈 | 在本仓库提交 Issue |
| 文档 | 见 [docs/](docs/) 目录 |

---

_最后更新：2026-08-14_
