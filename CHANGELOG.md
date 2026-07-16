# Changelog

## [2.0.0] - 2026-07-16

- 统一使用 `errorPipeline` 处理请求级、实例级和全局错误副作用。
- 删除旧 `errorHandler`、`skipErrorHandler` 和全局错误处理器 API。
- 删除 Umi 风格的 `requestInterceptors`、`responseInterceptors` 配置入口。
- 收敛拦截器错误回调和拦截器类型命名，不再导出 1.x 兼容别名。

## [1.2.0-alpha.1] - 2025-09-01

- 添加 `hasInstance`, `clearInstance`, `clearAllInstances` 方法进行实例管理，例如在微应用场景中，进入/离开微应用时检查/清理实例

## [1.2.0-alpha.0] - 2025-07-28

- 将单体代码库拆分为模块化组件

## [1.1.0] - 2025-07-28

- `axios` 作为 peer dependency
- 生成实例支持默认返回 `response.data`，可通过配置 `withFullResponse` 来获取完整的响应对象
- 添加测试用例

## [1.0.2] - 2025-06-30

- feat: export types

## [1.0.1] - 2025-06-27

- chore: remove vitest configuration file

## [1.0.0] - 2025-06-27

- feat: first commit :)
