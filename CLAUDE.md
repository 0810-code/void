以下は、あなたのパズル攻略サイトを **OpenCV（スクショ解析）前提**で再整理した「エンジニア向け実装ドキュメント」です。
特にご要望の **出力JSONの検証ロジック** と **誤認識時の自動リトライ戦略**、そして **盤面を戻したり自由に試す（遊ぶ）機能を必須要件として組み込み**ました。

---

# 0. 本ドキュメントの目的

* 8×8盤面＋固定向き41ピース（回転不可）のブロックパズルを完全再現
* ユーザーが

  * スクショ入力（OpenCV）または手動入力で **盤面＋手札3ピース**を与える
  * 「解を探す関数」（=3手で置き切れるか探索）を実行して **推奨手順**を得る
  * 盤面上で **配置→消去→次の盤面** を視覚的に確認できる
* さらに「遊び機能」として

  * 自分で自由に配置して試す
  * 1手戻る/やり直す（Undo/Redo）
  * 過去状態から別分岐を試す（ブランチ）
  * 盤面編集（セルON/OFF）
    を必須で実装する

---

# 1. 推奨アーキテクチャ（OpenCV採用版）

## 結論（おすすめ）

* フロント：**Next.js（React） + TypeScript**
* ソルバ（探索/盤面シミュレーション）：**TypeScript（フロント内で完結）**

  * 3手探索は軽いので、スマホでも十分動く
* スクショ解析（OpenCV）：**Python + FastAPI（サーバ側）**

  * OpenCVはPythonが最もチューニング・検証しやすい
  * 認識の自動リトライやデバッグ画像の保存がやりやすい
  * クライアントは重いopencv.jsを持たなくてよい（起動が軽い）

> 代替案：opencv.js（WASM）でブラウザ内解析も可能だが、
> バンドル肥大・端末差・デバッグ難易度が上がるので、初期はPythonサーバ推奨。

---

# 2. ゲーム仕様（再現ルール）

* 盤面：8×8（64マス）
* ピース：41種類、**回転不可**
* ピース配置：

  * 盤面外にはみ出さない
  * 既存ブロックと重ならない
* クリア：

  * 置いた直後に、横8埋まりの行・縦8埋まりの列をすべて同時消去
  * 重力なし
* 手札：常に3ピース（次の3つが来る）
* 本サイトの目的：

  * 「現在の盤面 + 手札3ピース」を入力として
  * 3手で置き切れる手順（順番も含む）を探索し提示
  * ユーザーがその手順を適用/戻す/分岐して試せる

---

# 3. データ表現（盤面・ピース）

## 3.1 盤面：64bitビットボード

* マス(x,y) → idx = y*8 + x（0..63）
* occupied: 64bit集合（TSでは `bigint`）

利点：

* 重なり判定が高速：`(board & mask) === 0n`
* 行/列の埋まり判定が高速：事前マスクとAND

## 3.2 ピース定義

* `pieces.json`（41件）
* 各ピースは固定向きで `cells: [ [dx,dy], ... ]`, `w`, `h`
* ピースの「識別」や「スクショ認識の一致確認」に使うため、

  * すべてのピースに **canonical hash** を付けるのを推奨

例：正規化座標をソートして `"x,y;x,y;..."` の文字列化
（回転しないので、平行移動だけ正規化すれば一致する）

---

# 4. コアロジック（盤面シミュレーション）

## 4.1 行/列マスク

* `ROW_MASK[8]` と `COL_MASK[8]` を事前計算

## 4.2 クリア処理

* boardに対して「埋まった行/列」のbit集合 `clearMask` を作り `board & ~clearMask`

## 4.3 置く処理

* `applyPlacement(board, pieceMask)`

  * placed = board | pieceMask
  * clearLines(placed)
  * 戻り値：boardAfter + clearedRows/Cols

---

# 5. 解探索（3ピースを置き切る関数）

## 5.1 探索方式

* 3ピースの順序は 3! = 6通り
* 各ピースは全配置候補（x,y）を試す
* DFS深さ3で1つ以上解が見つかればOK

## 5.2 「攻略力」を上げる（任意・推奨）

見つけた解が複数ある場合、最終盤面の評価で選ぶ。

推奨評価関数：**mobility最大化**

* `mobility(board) = Σ(pieceId=1..41) legalPlacementsCount(board, pieceId)`

実装簡単で強いです（次に詰みにくい盤面を作りやすい）。

---

# 6. 必須：ユーザーが「戻す・試す・遊ぶ」機能

この要件はUI以前に **状態設計が最重要**です。

## 6.1 状態モデル（ブランチ対応）

「Undo/Redoだけ」なら線形履歴で十分ですが、「いろいろ試す」を強く満たすなら **状態ツリー（分岐）**が便利です。

### 推奨：状態ツリー（簡易Gitみたいなモデル）

* `Node` が盤面状態を持ち、親子関係で分岐を表現

```ts
type NodeId = string;

type Move = {
  type: "PLACE",
  pieceId: number,
  x: number, y: number,
  clearedRows: number[],
  clearedCols: number[],
};

type GameNode = {
  id: NodeId,
  parentId: NodeId | null,
  childrenIds: NodeId[],
  board: bigint,
  hand: number[],        // 3つ（または将来拡張でN）
  handUsed: boolean[],   // 使用済み
  lastMove: Move | null,
  createdAt: number,
  note?: string          // ユーザーが「ここ良い盤面」等メモ
};
```

UIは後回しでも、ロジックとして以下を提供：

* `applyMove(nodeId, move) -> newNodeId`（子ノードを作る）
* `checkout(nodeId)`（過去ノードへ移動＝盤面を戻す）
* `deleteBranch(nodeId)`（任意）
* `bookmark(nodeId)`（任意）

> 「Undo」は `checkout(parentId)`
> 「別の置き方を試す」は同じ親から別の子を作るだけ。

## 6.2 盤面の手動編集（必須）

* スクショ認識の誤り補正にも必須
* イベント：

  * `TOGGLE_CELL(x,y)`
  * `FILL_ROW(y)` / `CLEAR_ROW(y)`（デバッグ用にあると便利）
* 編集は新ノードを作ってもよい（「編集ブランチ」）

## 6.3 手札の編集（必須）

* `SET_HAND([id1,id2,id3])`
* `SET_HAND_SLOT(i, pieceId)`
* 「盤面は同じで手札だけ変えて試す」用途がある

---

# 7. OpenCVスクショ解析：全体設計

## 7.1 目標

スクショ画像から以下のJSONを生成：

```json
{
  "board": [[0,1,0,0,0,1,0,0], ... x8],
  "pieceIds": [3, 27, 6],
  "meta": {
    "confidence": 0.92,
    "boardRoi": {"x":123,"y":456,"w":789,"h":789},
    "pieceRois": [{"x":...,"y":...,"w":...,"h":...}, ...],
    "attemptId": 12,
    "needsUserFix": false
  }
}
```

* `confidence` は後述のスコアから算出
* `needsUserFix` は「自動リトライしても確度が低い」場合に true

## 7.2 推奨：デバッグ画像も返せるようにする

解析は必ず失敗します（端末差・UI差・圧縮・広告など）。
なので `debug` モードで以下を返せる設計にすると開発が爆速になります。

* `debug/board_warp.png`（盤面を正面化した画像）
* `debug/board_cells_overlay.png`（セルごとのoccupied判定を色で重ねる）
* `debug/piece_{i}_mask.png`（各ピースの2値マスク）
* `debug/piece_{i}_blocks.png`（ブロック中心点を描画）
* `debug/piece_{i}_grid.png`（抽出した(dx,dy)を可視化）
* `debug/roi_candidates.png`（候補ROIを描画）

---

# 8. OpenCV解析パイプライン（推奨実装）

以下を **Candidate（候補）生成**として複数回回します（=自動リトライの核）。

## 8.1 盤面ROI検出（Board ROI）

### 方法A：テンプレマッチ（最優先・安定）

* 盤面外枠の角などをテンプレとして用意（数枚でOK）
* multi-scale template matching で座標を推定
* 盤面の外接矩形を得る

### 方法B：輪郭＋矩形フィルタ（フォールバック）

* グレースケール→Canny→輪郭抽出
* 4頂点近似の矩形を候補として列挙
* フィルタ：

  * 面積が大きい
  * 縦横比が1に近い
  * 画像内の位置が「中央〜上寄り」など期待範囲
* 候補を複数残し、後段の「検証」で選ぶ

### 正面化（必須）

* ROIは台形になりがちなので `getPerspectiveTransform`→`warpPerspective`
* warpサイズは 512×512 or 640×640（試行パラメータ）

---

## 8.2 盤面セルのoccupied判定（8×8）

warp後の盤面を 8×8 に分割し、各セルの中心領域（例：セル幅の30%）から特徴量を取る。

推奨特徴量：

* HSVの `S平均 + V平均`
* または Labの `L平均`

分類方法（リトライ対象）：

* 方法1：K-means(k=2)で64セルを2クラスタに分ける（推奨）
* 方法2：Otsuで閾値
* 方法3：Adaptive threshold（照明ムラに強い）

出力：`board[8][8]`（0/1）

---

## 8.3 手札3ピースのROI検出

盤面が取れたら「盤面下の領域」を切り出す（相対位置で安定させる）。

* `piecesArea = image[y = boardBottom .. boardBottom + α*boardSize]`

  * αは0.6など（UIに合わせて調整）
* HSVで彩度の高い領域（ブロック）を抽出し、連結成分を取る
* 面積上位の成分を3つ選ぶ（ただしUIの別パーツが混ざる可能性があるので位置フィルタも併用）
* それぞれを `pieceRoi` とする

---

## 8.4 ピース形状の抽出（ブロック分割→グリッド化）

ピースROIから「ブロック（1×1）」の中心点集合を得て `(dx,dy)` に変換します。

推奨手順：

1. `mask = threshold(HSVのSとV)` でブロック領域抽出
2. morphology close/open で穴埋め
3. distance transform → ピーク検出 → watershed でブロック分離
4. 各ブロック領域の重心（centroid）を得る
5. x座標列とy座標列をそれぞれクラスタリングしてグリッド化

   * 近い値をまとめる（許容幅 = 推定ブロックサイズ×0.5 など）
6. 得られた整数座標集合を原点正規化（minX/minYを0にする）
7. `(dx,dy)`集合と `(w,h)` を算出

---

## 8.5 41ピースへのマッチング（回転なし）

* 抽出セル集合 `S_extracted`
* 事前定義 `S_piece[id]`
* 一致条件：

  * ブロック数一致
  * 正規化済み座標集合が完全一致
  * w/hも一致（念のため）

高速化：

* `hash -> pieceId` の辞書を持つ（canonical hash）

失敗時：

* `pieceId = null` とし、このCandidateは低スコアにする

---

# 9. 重要：出力JSONの検証ロジック（＋誤認識なら自動リトライ）

ここが今回の追記の中心です。

## 9.1 検証は「段階的」に行う

スクショ解析は複数パラメータで何度も試すため、**早い段階で落とす**のが重要です。

### 検証レベル（推奨）

**(A) 構造検証（超高速）**

* boardが8×8か
* 値が0/1のみか
* pieceIdsが3つあるか
* pieceIdsが 1..41 の範囲か（nullなら失敗）

**(B) 妥当性検証（軽い）**

* occupiedセル数が 0..64の範囲（当然だが異常検出）
* pieceが3つすべて「個別に1手で置ける場所がある」か

  * 置けないピースが1つでもある→そのCandidateはほぼ誤認識

**(C) 決定的検証（最強）**
以下は、あなたのパズル攻略サイトを **OpenCV（スクショ解析）前提**で再整理した「エンジニア向け実装ドキュメント」です。
特にご要望の **出力JSONの検証ロジック** と **誤認識時の自動リトライ戦略**、そして **盤面を戻したり自由に試す（遊ぶ）機能を必須要件として組み込み**ました。

---

# 0. 本ドキュメントの目的

* 8×8盤面＋固定向き41ピース（回転不可）のブロックパズルを完全再現
* ユーザーが

  * スクショ入力（OpenCV）または手動入力で **盤面＋手札3ピース**を与える
  * 「解を探す関数」（=3手で置き切れるか探索）を実行して **推奨手順**を得る
  * 盤面上で **配置→消去→次の盤面** を視覚的に確認できる
* さらに「遊び機能」として

  * 自分で自由に配置して試す
  * 1手戻る/やり直す（Undo/Redo）
  * 過去状態から別分岐を試す（ブランチ）
  * 盤面編集（セルON/OFF）
    を必須で実装する

---

# 1. 推奨アーキテクチャ（OpenCV採用版）

## 結論（おすすめ）

* フロント：**Next.js（React） + TypeScript**
* ソルバ（探索/盤面シミュレーション）：**TypeScript（フロント内で完結）**

  * 3手探索は軽いので、スマホでも十分動く
* スクショ解析（OpenCV）：**Python + FastAPI（サーバ側）**

  * OpenCVはPythonが最もチューニング・検証しやすい
  * 認識の自動リトライやデバッグ画像の保存がやりやすい
  * クライアントは重いopencv.jsを持たなくてよい（起動が軽い）

> 代替案：opencv.js（WASM）でブラウザ内解析も可能だが、
> バンドル肥大・端末差・デバッグ難易度が上がるので、初期はPythonサーバ推奨。

---

# 2. ゲーム仕様（再現ルール）

* 盤面：8×8（64マス）
* ピース：41種類、**回転不可**
* ピース配置：

  * 盤面外にはみ出さない
  * 既存ブロックと重ならない
* クリア：

  * 置いた直後に、横8埋まりの行・縦8埋まりの列をすべて同時消去
  * 重力なし
* 手札：常に3ピース（次の3つが来る）
* 本サイトの目的：

  * 「現在の盤面 + 手札3ピース」を入力として
  * 3手で置き切れる手順（順番も含む）を探索し提示
  * ユーザーがその手順を適用/戻す/分岐して試せる

---

# 3. データ表現（盤面・ピース）

## 3.1 盤面：64bitビットボード

* マス(x,y) → idx = y*8 + x（0..63）
* occupied: 64bit集合（TSでは `bigint`）

利点：

* 重なり判定が高速：`(board & mask) === 0n`
* 行/列の埋まり判定が高速：事前マスクとAND

## 3.2 ピース定義

* `pieces.json`（41件）
* 各ピースは固定向きで `cells: [ [dx,dy], ... ]`, `w`, `h`
* ピースの「識別」や「スクショ認識の一致確認」に使うため、

  * すべてのピースに **canonical hash** を付けるのを推奨

例：正規化座標をソートして `"x,y;x,y;..."` の文字列化
（回転しないので、平行移動だけ正規化すれば一致する）

---

# 4. コアロジック（盤面シミュレーション）

## 4.1 行/列マスク

* `ROW_MASK[8]` と `COL_MASK[8]` を事前計算

## 4.2 クリア処理

* boardに対して「埋まった行/列」のbit集合 `clearMask` を作り `board & ~clearMask`

## 4.3 置く処理

* `applyPlacement(board, pieceMask)`

  * placed = board | pieceMask
  * clearLines(placed)
  * 戻り値：boardAfter + clearedRows/Cols

---

# 5. 解探索（3ピースを置き切る関数）

## 5.1 探索方式

* 3ピースの順序は 3! = 6通り
* 各ピースは全配置候補（x,y）を試す
* DFS深さ3で1つ以上解が見つかればOK

## 5.2 「攻略力」を上げる（任意・推奨）

見つけた解が複数ある場合、最終盤面の評価で選ぶ。

推奨評価関数：**mobility最大化**

* `mobility(board) = Σ(pieceId=1..41) legalPlacementsCount(board, pieceId)`

実装簡単で強いです（次に詰みにくい盤面を作りやすい）。

---

# 6. 必須：ユーザーが「戻す・試す・遊ぶ」機能

この要件はUI以前に **状態設計が最重要**です。

## 6.1 状態モデル（ブランチ対応）

「Undo/Redoだけ」なら線形履歴で十分ですが、「いろいろ試す」を強く満たすなら **状態ツリー（分岐）**が便利です。

### 推奨：状態ツリー（簡易Gitみたいなモデル）

* `Node` が盤面状態を持ち、親子関係で分岐を表現

```ts
type NodeId = string;

type Move = {
  type: "PLACE",
  pieceId: number,
  x: number, y: number,
  clearedRows: number[],
  clearedCols: number[],
};

type GameNode = {
  id: NodeId,
  parentId: NodeId | null,
  childrenIds: NodeId[],
  board: bigint,
  hand: number[],        // 3つ（または将来拡張でN）
  handUsed: boolean[],   // 使用済み
  lastMove: Move | null,
  createdAt: number,
  note?: string          // ユーザーが「ここ良い盤面」等メモ
};
```

UIは後回しでも、ロジックとして以下を提供：

* `applyMove(nodeId, move) -> newNodeId`（子ノードを作る）
* `checkout(nodeId)`（過去ノードへ移動＝盤面を戻す）
* `deleteBranch(nodeId)`（任意）
* `bookmark(nodeId)`（任意）

> 「Undo」は `checkout(parentId)`
> 「別の置き方を試す」は同じ親から別の子を作るだけ。

## 6.2 盤面の手動編集（必須）

* スクショ認識の誤り補正にも必須
* イベント：

  * `TOGGLE_CELL(x,y)`
  * `FILL_ROW(y)` / `CLEAR_ROW(y)`（デバッグ用にあると便利）
* 編集は新ノードを作ってもよい（「編集ブランチ」）

## 6.3 手札の編集（必須）

* `SET_HAND([id1,id2,id3])`
* `SET_HAND_SLOT(i, pieceId)`
* 「盤面は同じで手札だけ変えて試す」用途がある

---

# 7. OpenCVスクショ解析：全体設計

## 7.1 目標

スクショ画像から以下のJSONを生成：

```json
{
  "board": [[0,1,0,0,0,1,0,0], ... x8],
  "pieceIds": [3, 27, 6],
  "meta": {
    "confidence": 0.92,
    "boardRoi": {"x":123,"y":456,"w":789,"h":789},
    "pieceRois": [{"x":...,"y":...,"w":...,"h":...}, ...],
    "attemptId": 12,
    "needsUserFix": false
  }
}
```

* `confidence` は後述のスコアから算出
* `needsUserFix` は「自動リトライしても確度が低い」場合に true

## 7.2 推奨：デバッグ画像も返せるようにする

解析は必ず失敗します（端末差・UI差・圧縮・広告など）。
なので `debug` モードで以下を返せる設計にすると開発が爆速になります。

* `debug/board_warp.png`（盤面を正面化した画像）
* `debug/board_cells_overlay.png`（セルごとのoccupied判定を色で重ねる）
* `debug/piece_{i}_mask.png`（各ピースの2値マスク）
* `debug/piece_{i}_blocks.png`（ブロック中心点を描画）
* `debug/piece_{i}_grid.png`（抽出した(dx,dy)を可視化）
* `debug/roi_candidates.png`（候補ROIを描画）

---

# 8. OpenCV解析パイプライン（推奨実装）

以下を **Candidate（候補）生成**として複数回回します（=自動リトライの核）。

## 8.1 盤面ROI検出（Board ROI）

### 方法A：テンプレマッチ（最優先・安定）

* 盤面外枠の角などをテンプレとして用意（数枚でOK）
* multi-scale template matching で座標を推定
* 盤面の外接矩形を得る

### 方法B：輪郭＋矩形フィルタ（フォールバック）

* グレースケール→Canny→輪郭抽出
* 4頂点近似の矩形を候補として列挙
* フィルタ：

  * 面積が大きい
  * 縦横比が1に近い
  * 画像内の位置が「中央〜上寄り」など期待範囲
* 候補を複数残し、後段の「検証」で選ぶ

### 正面化（必須）

* ROIは台形になりがちなので `getPerspectiveTransform`→`warpPerspective`
* warpサイズは 512×512 or 640×640（試行パラメータ）

---

## 8.2 盤面セルのoccupied判定（8×8）

warp後の盤面を 8×8 に分割し、各セルの中心領域（例：セル幅の30%）から特徴量を取る。

推奨特徴量：

* HSVの `S平均 + V平均`
* または Labの `L平均`

分類方法（リトライ対象）：

* 方法1：K-means(k=2)で64セルを2クラスタに分ける（推奨）
* 方法2：Otsuで閾値
* 方法3：Adaptive threshold（照明ムラに強い）

出力：`board[8][8]`（0/1）

---

## 8.3 手札3ピースのROI検出

盤面が取れたら「盤面下の領域」を切り出す（相対位置で安定させる）。

* `piecesArea = image[y = boardBottom .. boardBottom + α*boardSize]`

  * αは0.6など（UIに合わせて調整）
* HSVで彩度の高い領域（ブロック）を抽出し、連結成分を取る
* 面積上位の成分を3つ選ぶ（ただしUIの別パーツが混ざる可能性があるので位置フィルタも併用）
* それぞれを `pieceRoi` とする

---

## 8.4 ピース形状の抽出（ブロック分割→グリッド化）

ピースROIから「ブロック（1×1）」の中心点集合を得て `(dx,dy)` に変換します。

推奨手順：

1. `mask = threshold(HSVのSとV)` でブロック領域抽出
2. morphology close/open で穴埋め
3. distance transform → ピーク検出 → watershed でブロック分離
4. 各ブロック領域の重心（centroid）を得る
5. x座標列とy座標列をそれぞれクラスタリングしてグリッド化

   * 近い値をまとめる（許容幅 = 推定ブロックサイズ×0.5 など）
6. 得られた整数座標集合を原点正規化（minX/minYを0にする）
7. `(dx,dy)`集合と `(w,h)` を算出

---

## 8.5 41ピースへのマッチング（回転なし）

* 抽出セル集合 `S_extracted`
* 事前定義 `S_piece[id]`
* 一致条件：

  * ブロック数一致
  * 正規化済み座標集合が完全一致
  * w/hも一致（念のため）

高速化：

* `hash -> pieceId` の辞書を持つ（canonical hash）

失敗時：

* `pieceId = null` とし、このCandidateは低スコアにする

---

# 9. 重要：出力JSONの検証ロジック（＋誤認識なら自動リトライ）

ここが今回の追記の中心です。

## 9.1 検証は「段階的」に行う

スクショ解析は複数パラメータで何度も試すため、**早い段階で落とす**のが重要です。

### 検証レベル（推奨）

**(A) 構造検証（超高速）**

* boardが8×8か
* 値が0/1のみか
* pieceIdsが3つあるか
* pieceIdsが 1..41 の範囲か（nullなら失敗）

**(B) 妥当性検証（軽い）**

* occupiedセル数が 0..64の範囲（当然だが異常検出）
* pieceが3つすべて「個別に1手で置ける場所がある」か

  * 置けないピースが1つでもある→そのCandidateはほぼ誤認識

**(C) 決定的検証（最強）**

* `solveTriple(board, pieceIds)` を実行し、**解が見つかるか**

  * あなたのゲーム前提：解のない3ピースは出ない
    → 解が出ないなら「誤認識」可能性が極めて高い

> (C) はソルバが必要ですが、3手探索は軽いのでサーバ側でもクライアント側でも実行可能。
> 解析サーバで (C) までやると「認識が怪しい時だけ再試行」が可能になり完成度が上がります。

---

## 9.2 Candidateスコアリング（confidence算出）

複数回解析した結果から「最良」を選ぶため、Candidateに点数を付けます。

例（目安）：

* +100：`solveTriple` が成功（解あり）
* +30：ピース3つがすべてID確定（nullなし）
* +15：各ピースが個別に置ける（×3で最大45）
* +10：盤面セル分類が明瞭（例：kmeansの2クラスタ平均との差が大きい）
* -50：ピース数が3つ取れていない
* -50：pieceIdがnullを含む
* -30：盤面ROIが不自然（サイズ/比率/位置が想定外）
* -20：occupiedが極端（例：64近い、または0でクラスタ分離が極端に悪い等）

confidenceへの変換（例）：

* `confidence = sigmoid(score / 40)` みたいに0..1化
* もしくは「成功=0.95、他=スコア正規化」など簡略でもOK

---

## 9.3 自動リトライ戦略（パラメータ探索）

「失敗したら同じ処理を繰り返す」ではなく、**失敗しやすい箇所を変化させて再試行**します。

### リトライの基本方針

* 盤面ROI検出：テンプレ→輪郭→候補複数
* 盤面セル分類：kmeans / otsu / adaptive を切替
* ピース抽出：HSV閾値・モルフォロジーサイズ・watershed閾値を変える
* ピースROI：盤面下領域の高さαを変える、左右マージンを変える
* 早期終了：

  * `solveTriple` 成功 & confidenceが閾値以上（例0.9）なら即return

### 具体的なリトライ・グリッド例

* board warpサイズ：{512, 640}
* セル分類：{kmeans, otsu, adaptive}
* HSV閾値：

  * S_min：{40, 55, 70}
  * V_min：{60, 80, 100}
* morphology kernel：{3, 5, 7}
* piecesArea高さ係数α：{0.45, 0.55, 0.65}

これを総当たりすると増えすぎるので、優先順位を付けます：

1. warpサイズ×セル分類（少数）
2. ピース抽出閾値（少数）
3. まだダメならαなどROIの揺らし

---

## 9.4 自動リトライ実装（擬似コード）

### サーバ側：parse_screenshot の骨格

```python
def parse_screenshot(image, debug=False):
    candidates = []

    for board_method in ["template", "contour"]:
        board_rois = detect_board_rois(image, method=board_method)   # 複数候補
        for board_roi in top_k(board_rois, k=5):
            for warp_size in [512, 640]:
                board_warp = warp_board(image, board_roi, warp_size)

                for cell_method in ["kmeans", "otsu", "adaptive"]:
                    board = classify_cells(board_warp, method=cell_method)

                    # ここまでで構造検証(A)を通らないものは捨てる
                    if not validate_board_structure(board):
                        continue

                    for alpha in [0.45, 0.55, 0.65]:
                        pieces_area = crop_pieces_area(image, board_roi, alpha)

                        for hsv_params in [(40,80),(55,80),(70,80),(55,60),(55,100)]:
                            for morph in [3,5,7]:
                                piece_rois = detect_three_piece_rois(pieces_area, hsv_params, morph)
                                if len(piece_rois) != 3:
                                    continue

                                piece_ids = []
                                piece_meta = []
                                ok = True
                                for roi in piece_rois:
                                    piece = extract_piece_signature(pieces_area, roi, hsv_params, morph)
                                    pid = match_piece(piece)  # 1..41 or None
                                    if pid is None:
                                        ok = False
                                        break
                                    piece_ids.append(pid)

                                if not ok:
                                    continue
                                # (B) 個別置けるか検証
                                if not each_piece_placeable(board, piece_ids):
                                solution = solve_triple(board, piece_ids)  # None or steps

                                cand = build_candidate(board, piece_ids, board_roi, piece_rois, solution, meta=...)
                                cand.score = score_candidate(cand)
                                candidates.append(cand)


    best = select_best(candidates)
    if best is None:
    # 最高でも解が出ない場合：誤認識の可能性を明示して返す
    if best.solution is None:
        best.needsUserFix = True
    return finalize(best, debug=debug)
```

---

## 9.5 「誤認識時」のユーザー救済（必須設計）

自動リトライしてもダメなケースは必ず出ます。
そのときにユーザー体験を壊さない設計が重要です。

返すJSONに以下を含める：

* `needsUserFix: true`
* `confidence`
* `board_overlay` 等のデバッグ可視化（ユーザー向けは簡易でもOK）
* `suggestedFixes`（任意：例「手札右が認識不能。候補: 6/24/13」など）

フロント側で必須：

* 認識した盤面を表示し、ユーザーがタップでセル修正できる
* 認識した3ピースを表示し、ドロップダウンでpieceIdを修正できる
* 修正後に `solveTriple` を即実行して「解あり」を確認

---

# 10. API設計（OpenCVサーバ）

## 10.1 `POST /parse_screenshot`

* multipartで画像アップロード
* query：`debug=true|false`

レスポンス：

```json
{
  "board": [[...],[...]],
  "pieceIds": [..,..,..],
  "meta": {
    "confidence": 0.87,
    "needsUserFix": true,
    "attemptId": 18
  },
  "debug": {
    "boardWarpPngBase64": "...",
    "boardOverlayPngBase64": "...",
    "pieceOverlays": ["...", "...", "..."]
  }
}
```

## 10.2 `POST /solve`（任意：サーバで解探索もやる場合）

フロント完結でも良いですが、parseとsolveを同一サーバで完結させると「解がないなら再試行」がしやすいです。

---

# 11. フロント機能（必須一覧：遊ぶ/戻す）

最低限この5つが揃えば「攻略+遊び」が成立します。

1. **手動入力**

* 盤面のセルをタップでON/OFF
* 41ピースから手札3つを選択

2. **自由配置**

* 手札のピースを選び、盤面に配置（プレビュー）
* 置ける場所をハイライト（合法手だけ）

* 現在ノードの盤面+手札から `solveTriple`
* 結果ステップを「適用（1手ずつ/全部）」できる
5. **スクショ入力（OpenCV）**
* `needsUserFix` のときは修正UIへ誘導

---

# 12. テスト戦略（スクショ解析は特に重要）

## 12.1 スクショのゴールデンセット

* 端末/解像度/明るさ/広告有無など、最低50枚は集める
* それぞれに正解JSON（board + pieceIds）を用意して回帰テスト

## 12.2 検証の要

* `parse_screenshot` の出力に対して `solveTriple` が通る率（成功率）をKPIにする

  * あなたの前提上「本物のスクショなら解がある」はずなので、成功率は実質「認識精度」です

---

# 13. 実装順（失敗しない順）

1. 盤面・ピースのシミュレーション（TSで完成）
2. 状態ツリー＋自由配置＋Undo/Redo（遊べる最低限UI）
3. ソルバ（first解→best解）
4. OpenCVサーバ：盤面ROI→セル分類だけ（ピースは手動入力）
5. OpenCVサーバ：ピースROI→形状抽出→41マッチング
6. 検証ロジック(C)（solveで解が出ないなら自動リトライ）
7. `needsUserFix` 時の補正UI

---

## 最後に（重要な実務メモ）

* **「solveTripleが通るか」を最終検証に使う**のが、このゲーム特性（必ず解がある3ピースのみ出る）と相性抜群です。
  つまり、スクショ解析は「画像認識」ではなく **“解が存在する” 制約付き復元問題**になります。これが精度を大きく押し上げます。
* 自動リトライの実装は「やりすぎると遅い」ので、

  * 候補を絞る（board ROIはtop5まで）
  * 早期終了（解が出たら即返す）
  * debug画像はオプション
    を必ず入れてください。

---

必要なら次の追記もすぐ書けます（どれが欲しいか言わなくても、優先度高い順に出します）：

* 盤面ROIのテンプレマッチ用テンプレをどう作るか（切り出し箇所/サイズ/スケール探索の設定）
* watershedでブロック分割する具体パラメータ例（距離変換閾値、marker生成法）
* 「ピースROIから3つを安定して取る」ためのスコアリング（位置・面積・縦横比）
* `needsUserFix` 時に「候補ピースIDを上位3つ返す」ロジック（部分一致・編集距離的な近さ）

* 解析→盤面と手札が自動入力される
* 適用は新しいブランチとして保存（ユーザーが後から戻れる）

4. **ソルバによる推奨手順**

* 状態ツリー（推奨）または線形Undo/Redo
* 「戻して別の置き方を試す」ができること
* 置いたら自動で行/列消去のアニメ（後回しでOK）

3. **Undo/Redo**

        return {"error": "parse_failed", "needsUserFix": True}

                                if solution is not None and cand.confidence >= 0.90:
                                    return finalize(cand, debug=debug)

                                # (C) 解の存在で最終検証
                                    # 候補としては残してよいがスコアは低め
                                    pass

