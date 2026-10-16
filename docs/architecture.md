# 架构说明：多区域 FunctionGraph Layer 分发

## 概述

本解决方案提供了一套自动化的 CI/CD 流水线，用于在多个华为云区域间构建和分发 FunctionGraph（华为云函数计算）Layers。它使用 CodeArts Pipeline 进行流程编排、CloudBuild 进行构建、OBS 进行产物存储、FunctionGraph 进行 Layer 分发。

## 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         源码阶段                                      │
│  ┌─────────────┐                                                    │
│  │ CodeHub     │                                                    │
│  │ 代码仓库     │                                                    │
│  └──────┬──────┘                                                    │
└─────────┼───────────────────────────────────────────────────────────┘
          │ 代码变更
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         构建阶段                                      │
│  ┌─────────────┐     ┌─────────────┐                                │
│  │ CloudBuild  │────▶│   OBS 桶    │                                │
│  │   构建项目   │     │ layer.zip  │                                │
│  └─────────────┘     └──────┬──────┘                                │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ 上传 layer.zip
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      分发阶段 - 每区域并行                             │
│                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ 区域: cn-north-4 │  │ 区域: cn-east-1  │  │ 区域: cn-south-1│     │
│  │                 │  │                 │  │                 │     │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │     │
│  │ │FunctionGraph│ │  │ │FunctionGraph│ │  │ │FunctionGraph│ │     │
│  │ │Layer分发器  │ │  │ │Layer分发器  │ │  │ │Layer分发器  │ │     │
│  │ └──────┬──────┘ │  │ └──────┬──────┘ │  │ └──────┬──────┘ │     │
│  │        │        │  │        │        │  │        │        │     │
│  │        ▼        │  │        ▼        │  │        ▼        │     │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │     │
│  │ │   OBS 桶    │ │  │ │   OBS 桶    │ │  │ │   OBS 桶    │ │     │
│  │ │ cn-north-4  │ │  │ │ cn-east-1   │ │  │ │ cn-south-1  │ │     │
│  │ └──────┬──────┘ │  │ └──────┬──────┘ │  │ └──────┬──────┘ │     │
│  │        │        │  │        │        │  │        │        │     │
│  │        ▼        │  │        ▼        │  │        ▼        │     │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │     │
│  │ │FunctionGraph│ │  │ │FunctionGraph│ │  │ │FunctionGraph│ │     │
│  │ │    Layer    │ │  │ │    Layer    │ │  │ │    Layer    │ │     │
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
└───────────────────────────────────────────────────────────────────────┘
```

## 组件说明

### 1. CodeHub 仓库
- **用途**：Layer 内容（package.json、依赖）的源代码仓库
- **华为云服务**：CodeHub（代码托管）
- **配置**：HTTPS/SSH 访问、分支保护

### 2. CloudBuild 项目
- **用途**：从源码构建 layer.zip 产物
- **华为云服务**：CloudBuild（云构建）
- **构建流程**：
  1. 将 package.json 复制到 `node_layer/nodejs/`
  2. 运行 `npm install`
  3. 打包成 `layer.zip`
- **输出**：`layer.zip` 存储在 OBS（主区域）

### 3. OBS 桶（主区域）
- **用途**：layer.zip 的中心产物存储
- **华为云服务**：OBS（对象存储服务）
- **桶策略**：FunctionGraph 执行委托具有读取权限

### 4. CodeArts Pipeline
- **用途**：编排多阶段 CI/CD 工作流
- **华为云服务**：CodeArts Pipeline（流水线）
- **阶段**：
  1. **Source（源码）**：CodeHub 仓库，提交触发
  2. **Build（构建）**：CloudBuild 项目执行
  3. **Distribute（分发）**：并行调用 FunctionGraph（每个目标区域一个）

### 5. FunctionGraph Layer 分发器
- **用途**：从 OBS 下载 layer.zip，上传到区域 OBS，注册为 FunctionGraph Layer
- **华为云服务**：FunctionGraph（函数计算）
- **运行时**：Node.js 18.x / 20.x
- **触发器**：CodeArts Pipeline（Distribute 阶段并行操作）
- **每个区域的处理流程**：
  1. 从流水线接收区域代码 + Layer 参数
  2. 从主 OBS 下载 `layer.zip`
  3. 上传到区域 OBS 桶
  4. 调用 `RegisterLayerVersion` API
  5. 向流水线报告成功/失败

### 6. OBS 桶（各区域）
- **用途**：layer.zip 分发的区域存储
- **华为云服务**：OBS
- **桶策略**：FunctionGraph 委托具有写入权限，下载公开读取

### 7. FunctionGraph Layer
- **用途**：附加到函数的复用 Layer
- **华为云服务**：FunctionGraph Layers
- **Layer 内容**：`node_layer/nodejs/`，包含 npm 包
- **兼容运行时**：Node.js 18.x、20.x

## 数据流

```
1. 开发者将代码推送到 CodeHub main 分支
       ↓
2. CodeArts Pipeline 被触发（Source 阶段）
       ↓
3. CloudBuild 执行 build_config：
   - mkdir -p node_layer/nodejs
   - cp package.json ./node_layer/nodejs/
   - cd ./node_layer/nodejs && npm install
   - zip ../layer.zip * -r
       ↓
4. layer.zip 上传到主区域 OBS 桶
       ↓
5. Distribute 阶段：并行调用 Layer Distributor 函数
   （每个配置的目标区域一个）
       ↓
6. 每个 Layer Distributor 函数：
   a. 从主 OBS 下载 layer.zip
   b. 上传到区域 OBS 桶
   c. 向 FunctionGraph 注册 Layer 版本
   d. 向 CodeArts Pipeline 报告结果
       ↓
7. 流水线以成功/失败状态完成
```

## 网络与安全

### VPC 配置
- FunctionGraph 使用专用 VPC 连接器访问 OBS
- IAM 委托提供跨服务凭据

### IAM 委托
```
LayerDistributor 委托权限：
├── FunctionGraph: FullAccess（注册 Layer 版本）
├── OBS: WriteAccess（上传 layer.zip 到各区域桶）
└── CodeArts Pipeline: InvokeAccess（报告任务结果）
```

### OBS 桶策略
- 主桶：FunctionGraph 委托只读，CloudBuild 可写
- 区域桶：FunctionGraph 委托可写，下载公开读取

## 区域支持

本架构支持分发到任意华为云区域。默认区域：
- cn-north-4（华北-北京四）
- cn-east-1（华东-上海一）
- cn-south-1（华南-广州）

如需添加更多区域，请在 Terraform 中更新 `target_regions` 变量，并确保 OBS 桶存在。

## 局限性

| 局限性 | 说明 | 变通方案 |
|--------|------|---------|
| Layer 共享 | FunctionGraph Layers 是区域级的，无法跨区域共享 | 各区域维护自己的 Layer 版本 |
| Layer 大小 | 压缩后 Layer ≤ 50MB | 拆分大型依赖 |
| 冷启动 | 并行区域调用可能有冷启动 | 使用预留并发（如需要） |
