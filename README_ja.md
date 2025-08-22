# <p align="center">🤖 302 Starter🚀✨</p>

<p align="center"><code>302 Starter</code>は、Next.js 14をベースにした最新のフロントエンド技術スタックとベストプラクティスを統合したモダンなWebアプリケーションスターターテンプレートです。</p>

<p align="center"><a href="https://302.ai/ja/" target="blank"><img src="https://file.302.ai/gpt/imgs/github/20250102/72a57c4263944b73bf521830878ae39a.png" /></a></p >

<p align="center"><a href="README_zh.md">中文</a> | <a href="README.md">English</a> | <a href="README_ja.md">日本語</a></p>

![](docs/302_Starter.jpg)

## ✨ 302.AIについて ✨
[302.AI](https://302.ai)は、AIの能力と実用的な実装の間のギャップを埋める、従量制のAIアプリケーションプラットフォームです。
1. 🧠 包括的なAI機能：主要AIブランドの最新の言語、画像、音声、ビデオモデルを統合。
2. 🚀 高度なアプリケーション開発：単なるシンプルなチャットボットではなく、本格的なAI製品を構築。
3. 💰 月額料金なし：すべての機能が従量制で、完全にアクセス可能。低い参入障壁と高い可能性を確保。
4. 🛠 強力な管理ダッシュボード：チームやSME向けに設計 - 一人で管理し、多くの人が使用可能。
5. 🔗 すべてのAI機能へのAPIアクセス：すべてのツールはオープンソースでカスタマイズ可能（進行中）。
6. 💪 強力な開発チーム：大規模で高度なスキルを持つ開発者集団。毎週2-3の新しいアプリケーションをリリースし、毎日製品更新を行っています。才能ある開発者の参加を歓迎します。

## 📖 プロジェクト概要

これは、App Routerアーキテクチャを採用し、302AI認証、国際化、テーマ切り替え、フォーム処理など、多くの実用的な機能を統合した機能豊富なNext.jsスターターテンプレートです。TypeScriptを使用して開発され、コードの型安全性と保守性を確保しています。

## 📁 プロジェクト構造

```
src/
├── actions/      # サーバーアクション
├── api/          # APIルート
├── app/          # Next.jsアプリルーター
├── components/   # Reactコンポーネント
├── constants/    # 定数
├── hooks/        # カスタムReactフック
├── i18n/         # 国際化
├── lib/          # ライブラリ
├── services/     # サービス
├── stores/       # 状態管理
├── styles/       # スタイル
└── utils/        # ユーティリティ
```

## 🛠️ 技術スタック

- **フレームワーク**: Next.js 14
- **言語**: TypeScript
- **スタイリング**: TailwindCSS
- **UIコンポーネント**: Radix UI
- **状態管理**: Jotai
- **フォーム処理**: React Hook Form
- **HTTPクライアント**: ky
- **国際化**: next-intl
- **テーマ**: next-themes
- **コード規約**: ESLint, Prettier
- **コミット規約**: Husky, Commitlint

## 🚀 インストールと設定

### ⚙️ 必要条件

- Node.js 18.17以上
- pnpm 8.0以上

### 📥 インストール手順

1. プロジェクトのクローン
```bash
git clone [リポジトリURL]
cd 302-starter
```

2. 依存関係のインストール
```bash
pnpm install
```

3. 環境設定
```bash
cp .env.example .env.local
```
必要に応じて`.env.local`の環境変数を修正してください。

4. 開発サーバーの起動
```bash
pnpm dev
```

5. プロダクションビルド
```bash
pnpm build
pnpm start
```

## ✨ 主な機能

- 🔐 302AI認証
- 🌐 国際化対応
- 🎨 ライト/ダークテーマ
- 📝 フォームバリデーション
- 🔒 型安全なAPI呼び出し
- 📦 モジュラーコンポーネント
- 🚀 最適化されたビルド
- 🔧 完全な開発ツールチェーン

## 📐 コード規約

プロジェクトではESLintとPrettierを使用してコードのフォーマットと規約を管理しています：

- ✅ ESLint: コード品質
- 🎨 Prettier: コードフォーマット
- 🔄 Husky: Gitフック
- 📝 Commitlint: コミットメッセージ規約

コードチェックの実行：
```bash
pnpm lint
```

## 🤝 コントリビューション

1. プロジェクトをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. プルリクエストを作成

### 📝 コミット規約

プロジェクトは[Conventional Commits](https://www.conventionalcommits.org/)に従っています：

```
type(scope): description

[optional body]

[optional footer]
```

一般的なtype：
- ✨ feat: 新機能
- 🐛 fix: バグ修正
- 📚 docs: ドキュメント
- 💄 style: コードスタイル
- ♻️ refactor: リファクタリング
- ✅ test: テスト
- 🔧 chore: ビルドプロセスやツール

## ❓ よくある質問

### Q: 新しい言語サポートを追加するには？
A: `messages`ディレクトリに翻訳ファイルを追加し、`constants/values.ts`で設定します。

### Q: テーマをカスタマイズするには？
A: `tailwind.config.ts`でテーマ設定を修正します。

## 💬 サポート

- 🐛 Issue報告
- 📧 メンテナンスチームへの連絡

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています - 詳細は[LICENSE](LICENSE)ファイルをご覧ください。
