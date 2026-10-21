# LA 静态资源

<!-- Managed by tools/publish/publish-github-resources.ps1 in the development project. -->

资源站点：<https://gjw14250.github.io/LA_Update/>

资源根地址：<https://gjw14250.github.io/LA_Update/assets/>

文件清单：<https://gjw14250.github.io/LA_Update/resource-manifest.json>

资源来自当前项目的 Cocos Creator 3.8.7 Web Mobile 构建。清单记录每个 Bundle 的版本和依赖，以及每个文件的大小和 SHA-256 校验值。资源总量以清单为准。

包含业务资源、游戏配置和引擎内置资源。资源 Bundle 的 `index.*.js` 是必要的空注册入口或 Cocos 内置渲染代码。业务逻辑 Bundle、客户端入口、服务器工程、开发配置、依赖缓存和源码映射均不在发布范围内。

这是资源站点，尚无游戏试玩入口。`startup-res` 依赖同次构建的客户端 `main` Bundle，其版本记录在清单的 `clientDependencies` 中。接入时需同步客户端的 Bundle 版本及远程资源地址；本地开发工程当前仍使用本地资源和本机后端。

GitHub Pages 使用 `main` 分支根目录发布；`.nojekyll` 保证资源按原目录提供。修改推送后需等待 Pages 部署完成。此仓库和站点公开可访问。
