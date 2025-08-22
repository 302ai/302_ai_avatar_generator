# <p align="center">🤖 302 Starter🚀✨</p>

<p align="center"><code>302 Starter</code>是一个基于 Next.js 14 的现代化 Web 应用程序启动模板，集成了最新的前端技术栈和最佳实践。</p>

<p align="center"><a href="https://302.ai/" target="blank"><img src="https://file.302.ai/gpt/imgs/github/20250102/72a57c4263944b73bf521830878ae39a.png" /></a></p >

<p align="center"><a href="README_zh.md">中文</a> | <a href="README.md">English</a> | <a href="README_ja.md">日本語</a></p>

![](docs/302_Starter.jpg)

## ✨ 302.AI介绍 ✨
[302.AI](https://302.ai)是一个按需付费的AI应用平台，为用户解决AI用于实践的最后一公里问题。
1. 🧠 集合了最新最全的AI能力和品牌，包括但不限于语言模型、图像模型、声音模型、视频模型。
2. 🚀 在基础模型上进行深度应用开发，我们开发真正的AI产品，而不是简单的对话机器人
3. 💰 零月费，所有功能按需付费，全面开放，做到真正的门槛低，上限高。
4. 🛠 功能强大的管理后台，面向团队和中小企业，一人管理，多人使用。
5. 🔗 所有AI能力均提供API接入，所有工具开源可自行定制（进行中）。
6. 💡 强大的开发团队，每周推出2-3个新应用，产品每日更新。有兴趣加入的开发者也欢迎联系我们

## 📖 项目介绍

这是一个功能丰富的 Next.js 启动模板，采用了 App Router 架构，集成了302AI鉴权、国际化、主题切换、表单处理等多个实用功能。项目使用 TypeScript 开发，确保了代码的类型安全性和可维护性。

## 📁 项目结构

```
src/
├── actions/      # 服务器操作
├── api/          # API 路由
├── app/          # Next.js 应用路由
├── components/   # React 组件
├── constants/    # 常量定义
├── hooks/        # 自定义 React Hooks
├── i18n/         # 国际化配置
├── lib/          # 工具库
├── services/     # 服务层
├── stores/       # 状态管理
├── styles/       # 样式文件
└── utils/        # 工具函数
```

## 🛠️ 技术栈

- **框架**: Next.js 14
- **语言**: TypeScript
- **样式**: TailwindCSS
- **UI组件**: Radix UI
- **状态管理**: Jotai
- **表单处理**: React Hook Form
- **HTTP客户端**: ky
- **国际化**: next-intl
- **主题**: next-themes
- **代码规范**: ESLint, Prettier
- **提交规范**: Husky, Commitlint

## 🚀 安装与启动

### ⚙️ 环境要求

- Node.js 18.17 或更高版本
- pnpm 8.0 或更高版本

### 📥 安装步骤

1. 克隆项目
```bash
git clone [项目地址]
cd 302-starter
```

2. 安装依赖
```bash
pnpm install
```

3. 环境配置
```bash
cp .env.example .env.local
```
根据需要修改 `.env.local` 中的环境变量。

4. 启动开发服务器
```bash
pnpm dev
```

5. 构建生产版本
```bash
pnpm build
pnpm start
```

## ✨ 主要功能

- 🔐 302AI鉴权系统
- 🌐 国际化支持
- 🎨 明暗主题切换
- 📝 表单验证和处理
- 🔒 类型安全的 API 调用
- 📦 模块化的组件库
- 🚀 优化的构建配置
- 🔧 完整的开发工具链

## 📐 代码规范

项目使用 ESLint 和 Prettier 进行代码格式化和规范检查：

- ✅ ESLint: 代码质量检查
- 🎨 Prettier: 代码格式化
- 🔄 Husky: Git hooks
- 📝 Commitlint: 提交信息规范

运行代码检查：
```bash
pnpm lint
```

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### 📝 提交规范

项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范，提交信息格式如下：

```
type(scope): description

[optional body]

[optional footer]
```

常用的 type 类型：
- ✨ feat: 新功能
- 🐛 fix: 修复
- 📚 docs: 文档更新
- 💄 style: 代码格式
- ♻️ refactor: 重构
- ✅ test: 测试
- 🔧 chore: 构建过程或辅助工具的变动

## ❓ 常见问题

### Q: 如何添加新的语言支持？
A: 在 `messages` 目录下添加对应语言的翻译文件，并在 `constants/values.ts` 中配置。

### Q: 如何自定义主题？
A: 修改 `tailwind.config.ts` 文件中的主题配置。

## 💬 技术支持

- 🐛 提交 Issue
- 📧 联系维护团队

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。
