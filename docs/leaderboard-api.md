# 经典模式排行榜接口

当前仓库没有可用的成绩后端；Lamps 开放平台接口只负责上传作品，不提供玩家成绩存储。因此页面默认使用本地缓存，并预留 `lamps.common.request` 网络适配层。

## 接口契约

部署一个 HTTPS 服务，并把页面运行环境中的 `window.LAMPS_LEADERBOARD_API_URL` 设为服务根地址。

### `POST /scores`

请求 JSON：

```json
{"mode":1,"time":83,"player":"玩家名"}
```

`mode` 只能是 `1`、`2`、`4`，`time` 是完成秒数。服务端按 `(player, mode)` 做最短时间 upsert，并返回 `2xx`。

### `GET /scores?mode=1`

返回 JSON：

```json
{"scores":[{"player":"玩家名","time":83}]}
```

服务端按 `time ASC` 排序并限制返回前 50 条。其余花色使用 `mode=2` 和 `mode=4`。

## 部署方案

推荐使用 Cloudflare Workers + D1：Workers 提供 `/scores` 的 GET/POST 路由，D1 建立 `scores(player, mode, time, updated_at, UNIQUE(player, mode))` 表；POST 使用事务执行最短时间 upsert，GET 使用 `ORDER BY time ASC LIMIT 50`。配置 CORS 仅允许游戏正式域名，并增加请求频率限制。

部署完成后，把 Worker 地址配置到 `LAMPS_LEADERBOARD_API_URL`，再重新上传 Lamps 作品。GitHub Pages 端若未配置地址仍会安全地显示本地缓存，不会发起无效请求。
