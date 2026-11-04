# Little Island Tower

小さな島に建つ塔を育てる箱庭ゲームです。波打ち際のシーグラスを集めて塔を3階まで建て、家具を置き、動物たちにおやつやおもちゃをあげます。

**遊ぶ:** https://wilkinson1905.github.io/LittleIslandTower/

スマホ向けの縦画面です。進み具合はブラウザの中に自動で保存され、別の端末には引き継げません。画像や外部ライブラリは使わず、すべてのドットをコードで描いています。

## 開発

Node 22 以降が必要です。テストには Google Chrome も使います（パスは `tools/drive.mjs` の先頭）。

```bash
node build.mjs             # src/ を1つの dollhouse.html にまとめる
node tools/verify.mjs      # 120秒ループ、動き、メモリなどの検証
node tools/game_test.mjs   # 最初から完成までの通しテスト
node tools/publish.mjs     # 公開ページ（gh-pages ブランチ）を更新する
```

URL の指定: `seed`、`loop`、`block`、`debug`、`floors`、`full=1`（完成状態の確認用）。キー操作: `D` デバッグパネル、`Space` 一時停止、`F` 全画面。

仕様と設計は `docs/` にあります。
