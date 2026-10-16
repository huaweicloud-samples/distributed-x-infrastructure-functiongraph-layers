# 部署指南：多区域 FunctionGraph Layer 分发

## 前置条件

- 华为云账号，持有有效 AKSK
- 华为云 CLI（`huaweicloud-cli`）或 OBSUTIL/CloudCLI 工具
- 已安装 Terraform ≥ 1.5.0
- 已安装 Git
- 已安装 Node.js ≥ 18.x 和 npm

## 架构概述

本解决方案部署一套 CI/CD 流水线，实现以下功能：
1. 从 CodeHub 源码构建 Node.js layer 包
2. 将 Layer 分发到多个华为云区域
3. 在各区域注册 FunctionGraph Layer 版本

## 第一步：配置凭据

设置华为云凭据为环境变量：

```bash
export HW_ACCESS_KEY="<您的 Access Key>"
export HW_SECRET_KEY="<您的 Secret Key>"
export HW_REGION="cn-north-4"  # 流水线的主区域
```

或在 `~/.huaweicloud/credentials` 创建凭据文件：

```ini
[default]
hw_access_key = <您的 Access Key>
hw_secret_key = <您的 Secret Key>
region = cn-north-4
```

## 第二步：配置变量

编辑 `infra/terraform.tfvars` 或交互式设置变量：

```hcl
# 流水线的主区域
primary_region = "cn-north-4"

# Layer 分发的目标区域
target_regions = ["cn-north-4", "cn-east-1", "cn-south-1"]

# Layer 配置
layer_name       = "sample-layer"
layer_description = "Sample layer distributed to multiple regions"
layer_runtimes   = ["Node.js 18.x", "Node.js 20.x"]
```

## 第三步：初始化 Terraform

```bash
cd infra
terraform init

# 预期输出：
# Initializing the backend...
# Initializing provider plugins...
# Terraform has been successfully initialized!
```

## 第四步：规划与审查

```bash
terraform plan

# 审查计划变更：
# - VPC 和子网创建
# - OBS 桶（主区域 + 各区域）
# - CodeHub 仓库
# - CloudBuild 项目
# - CodeArts Pipeline
# - FunctionGraph 函数（layer 分发器）
# - IAM 委托和策略
```

## 第五步：部署

```bash
terraform apply

# 出现提示时输入 'yes'
# 预期输出：
# Apply complete! Resources: 15 created.
```

## 第六步：初始化 CodeHub 仓库

Terraform 部署完成后，用示例 layer 内容初始化 CodeHub 仓库：

```bash
# 从 terraform 输出获取 CodeHub 仓库 HTTPS URL
CODUHUB_URL=$(terraform output -raw codehub_repository_url)

# 克隆并推送示例内容
cd /tmp
git clone $CODUHUB_URL functiongraph-layer-source
cd functiongraph-layer-source
cp /path/to/this/repo/src/example/package.json node_layer/nodejs/
git add .
git commit -m "Initial layer content"
git push origin main
```

## 第七步：触发流水线

代码推送到 CodeHub 后流水线会自动触发。如需手动触发：

```bash
# 获取流水线 ID
PIPELINE_ID=$(terraform output -raw pipeline_id)

# 通过 API 触发流水线
huaweicloud codearts pipeline run \
  --region cn-north-4 \
  --pipeline-id $PIPELINE_ID
```

## 第八步：验证 Layer 分发

检查所有目标区域是否创建了 Layer：

```bash
# 列出各区域的 Layer
for region in cn-north-4 cn-east-1 cn-south-1; do
  echo "=== 区域: $region ==="
  huaweicloud functiongraph layers list \
    --region $region \
    --layer-name sample-layer
done
```

## 创建的资源

| 资源类型 | 名称 | 区域 |
|----------|------|------|
| VPC | functiongraph-vpc | cn-north-4 |
| 子网 | functiongraph-subnet | cn-north-4 |
| OBS 桶（主区域） | layer-artifacts-{project_id} | cn-north-4 |
| OBS 桶（各区域） | layer-artifacts-{project_id}-{region} | 各目标区域 |
| CodeHub 仓库 | functiongraph-layer-source | cn-north-4 |
| CloudBuild 项目 | functiongraph-layer-builder | cn-north-4 |
| CodeArts Pipeline | functiongraph-layer-pipeline | cn-north-4 |
| FunctionGraph 函数 | layer-distributor | cn-north-4 |
| IAM 委托 | LayerDistributorAgency | cn-north-4 |

## 自定义配置

### 添加更多区域

编辑 `infra/terraform.tfvars`：

```hcl
target_regions = ["cn-north-4", "cn-east-1", "cn-south-1", "cn-southwest-2"]
```

然后运行 `terraform apply`。

### 更改 Layer 内容

1. 用您的依赖更新 `src/example/package.json`
2. 推送到 CodeHub main 分支
3. 流水线自动重新构建并分发

### 更改 Layer 配置

编辑以下 Terraform 变量：

| 变量 | 说明 |
|------|------|
| `layer_name` | FunctionGraph Layer 的名称 |
| `layer_description` | Layer 描述 |
| `layer_runtimes` | 兼容的运行时 |

## 故障排除

### 流水线在 Build 阶段失败
```bash
# 检查 CloudBuild 日志
huaweicloud cloudbuild builds list --region cn-north-4
```

### 流水线在 Distribute 阶段失败
```bash
# 检查 FunctionGraph 函数日志
huaweicloud functiongraph functions logs \
  --region cn-north-4 \
  --function-name layer-distributor
```

### OBS 访问被拒绝
```bash
# 验证 IAM 委托权限
huaweicloud iam agencies list --name LayerDistributorAgency
```

### 某些区域找不到 Layer
```bash
# 检查 OBS 桶是否存在
huaweicloud obs ls --region cn-east-1 --bucket layer-artifacts-xxx-cn-east-1
```

## 清理资源

销毁所有资源：

```bash
terraform destroy

# 注意：OBS 桶在删除前可能需要手动清空
# CodeArts Pipeline 执行历史会被删除
# 如果 terraform 失败，FunctionGraph Layers 需要手动删除
```

Terraform destroy 后，手动删除（如有残留）：
- OBS 桶（如未自动删除）
- 各区域的 FunctionGraph Layers
- CodeHub 仓库（如 terraform destroy 失败）
