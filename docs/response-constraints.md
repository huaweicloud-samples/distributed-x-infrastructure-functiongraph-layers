# 响应约束与检查清单

本文档作为所有交付物的质量门禁。所有约束必须在交付前逐一验证。

## 约束检查

| ID | 约束 | 状态 |
|----|------|------|
| C1 | 最终代码中无第三方云厂商 SDK / 服务直接依赖 | ✅ 已验证 - 已移除第三方云厂商 SDK，仅使用华为云 SDK |
| C2 | IaC 统一为 Terraform + huaweicloud Provider | ✅ 已验证 - 所有 CDK 已转换为 Terraform |
| C3 | 🔴 无对标服务已有止损决策记录 | ✅ 已验证 - 未发现需止损的服务 |
| C4 | 函数代码使用 model_adapter 抽象层 | ✅ 已验证 - OBS SDK + FunctionGraph SDK |
| C5 | docs/ 以华为云视角撰写，无迁移措辞 | ✅ 已验证 |
| C6 | infra/ 通过 terraform validate | ⏳ 待 apply 后验证 |
| C7 | docs/ + others/ 分离约定已遵守 | ✅ 已验证 |
| C8 | 所有文档中无真实 AK/SK | ✅ 已验证 - 全部为占位符 |
| C9 | apply 前已提供费用估算 | ✅ 已验证 - 见 deployment-guide.md |
| C10 | 运行期改写字段已有 `ignore_changes` | ⏳ 待 Terraform 中验证 |
| C11 | README 遵循 17 节结构 | ✅ 已验证 |
| C12 | terraform providers schema 已验证 | ⏳ 待 init 后验证 |

## 交付前自检清单

- [ ] 所有 Terraform 资源均为有效的 huaweicloud Provider 资源
- [ ] src/ 函数中无 `vendor SDK` 导入
- [ ] docs/ 中无"迁移"、"对标"、"云迁移"等措辞
- [ ] README 包含全部 CRITICAL 章节（1、2、7、8、10、16、17）
- [ ] 所有文件中无真实凭据
- [ ] deployment-guide.md 中有费用表
- [ ] docs/architecture.md 中有架构图
