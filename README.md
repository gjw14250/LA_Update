# LA 静态资源

资源站点：<https://gjw14250.github.io/LA_Update/>

资源根地址：<https://gjw14250.github.io/LA_Update/assets/>

文件清单：<https://gjw14250.github.io/LA_Update/resource-manifest.json>

本次从当前项目重新构建的 Cocos Creator 3.8.7 Web Mobile 产物中提取 20 个资源 Bundle，共 2,184 个文件、362,034,190 字节（约 345.3 MiB）。清单包含每个 Bundle 的版本和依赖，以及每个文件的大小和 SHA-256 校验值。保留生成的文件名、目录和 JSON 内容，以维持资源引用一致性。

包含业务资源、游戏配置和引擎内置资源；Bundle 的 `index.*.js` 是必要的空注册入口或 Cocos 内置渲染代码。业务逻辑 Bundle、客户端入口、服务器工程、开发配置、依赖缓存和源码映射均不在本次发布范围内。

这是资源站点，尚无游戏试玩入口。`startup-res` 依赖同次构建的客户端 `main` Bundle（版本 `5118d`），必须由匹配的客户端提供。接入时需同步客户端的 Bundle 版本及远程资源地址；本地开发工程当前仍使用本地资源和本机后端。

GitHub Pages 使用 `main` 分支根目录发布；`.nojekyll` 保证资源按原目录提供。每次修改推送后需等待 Pages 部署完成。此仓库和站点公开可访问。
