# Protein Price Compare (MVP)

React + Node.js で作った、プロテイン比較サイトの初期版です。
この段階では Prisma + PostgreSQL を使ってデータを保存し、APIで表示します。

## 構成

- frontend: React (Vite)
- backend: Node.js (Express)

## 起動方法

```bash
npm run dev
```

上記で以下を同時に起動します。

- フロント: http://localhost:5173
- バックエンド API: http://localhost:4000

## API

- GET /api/health
- GET /api/products
- GET /api/sync/providers
- POST /api/sync

### クエリ例

- `GET /api/products?category=ソイプロテイン`
- `GET /api/products?sort=priceYen&order=asc`
- `GET /api/products?category=全カテゴリ&sort=proteinPricePerGram&order=asc`

固定データは `backend/data/proteins.js` にあります。

## Prisma / DB セットアップ

```bash
npm --prefix backend install
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
```

本番運用は PostgreSQL を想定しています。ローカルでも使う場合は `DATABASE_URL` を PostgreSQL の接続文字列にしてください。

## データ取得パイプライン

ローカル固定データをDBに取り込む:

```bash
npm --prefix backend run sync -- --provider mock
```

外部JSON URLから取り込む:

```bash
npm --prefix backend run sync -- --provider jsonUrl --url https://example.com/products.json
```

楽天APIから取り込む:

```bash
npm --prefix backend run sync -- --provider rakuten --keyword プロテイン --hits 20 --pages 2
```

事前に `backend/.env` へ `RAKUTEN_APP_ID` を設定してください。

APIから取り込み実行:

```bash
curl -X POST http://localhost:4000/api/sync \
	-H "Content-Type: application/json" \
	-d '{"provider":"mock"}'
```

楽天APIを API から実行する例:

```bash
curl -X POST http://localhost:4000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"provider":"rakuten","keyword":"プロテイン","hits":20,"pages":1}'
```

## ビルド

```bash
npm run build
```

フロントエンドを本番ビルドします。

## リリース手順

このプロジェクトを公開する場合は、まずバックエンドとフロントエンドを別々にデプロイします。

Railway を使う場合は、[docs/railway-deploy.md](docs/railway-deploy.md) を先に見てください。
AWS Lightsail を使う場合は、[docs/lightsail-deploy.md](docs/lightsail-deploy.md) を先に見てください。

### 1. 公開先を決める

- フロントエンド: Vercel など
- バックエンド: Render / Railway / Fly.io など
- 楽天APIを呼ぶのはバックエンドなので、Allowed websites にはバックエンドの公開ドメインを登録します

### 2. 本番用の環境変数を用意する

バックエンドに以下を設定します。

```env
DATABASE_URL="本番DBの接続先"
RAKUTEN_APP_ID="楽天ウェブサービスのアプリID"
RAKUTEN_AFFILIATE_ID="必要なら設定"
RAKUTEN_KEYWORD="プロテイン"
```

### 3. 本番DBを準備する

今の構成は PostgreSQL 前提です。Railway では PostgreSQL サービスを作成して、その接続文字列を `DATABASE_URL` に設定します。

Prisma のマイグレーションを本番DBに適用します。

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
```

本番では `npm --prefix backend run prisma:deploy` を使ってください。

### 4. バックエンドをデプロイする

- `npm --prefix backend run start` で起動できることを確認する
- `GET /api/health` が返ることを確認する
- `GET /api/products` が公開URLで見えることを確認する
- `GET /api/sync/providers` に `rakuten` が含まれることを確認する

### 5. フロントエンドをデプロイする

フロントエンド側の API ベース URL を本番バックエンドに向けます。

- Vite の環境変数に本番 API URL を設定する
- `npm run build` でビルドできることを確認する
- 公開URLで一覧表示とソートが動くことを確認する

### 6. 楽天の設定を確認する

楽天ウェブサービス側の Allowed websites には、実際に楽天APIを呼ぶサーバーの公開ドメインを登録します。

例:

```text
https://api.example.com
```

### 7. 実データ同期を試す

```bash
curl -X POST https://your-backend.example.com/api/sync \
	-H "Content-Type: application/json" \
	-d '{"provider":"rakuten","keyword":"プロテイン","hits":20,"pages":1}'
```

### 8. 公開後に確認する項目

- 商品一覧が表示される
- カテゴリ切り替えが動く
- ソートが動く
- 楽天同期が成功する
- 価格や比較指標が正しく更新される
