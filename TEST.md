# 测试

📁 测试文件结构：

- `vitest.config.ts` - 测试配置
- `test/mocks.ts` - Mock工具函数
- `test/interceptors.test.ts` - 拦截器管理测试
- `test/instance.test.ts` - 实例管理测试
- `test/http-methods.test.ts` - HTTP方法测试
- `test/error-handling.test.ts` - 错误处理测试
- `test/index.test.ts` - 模块导出测试

核心功能测试覆盖：

- HTTP方法测试
- 实例管理测试
- 拦截器管理测试
- 模块导出测试

测试重点覆盖：

- 多种拦截器格式（对象/函数/元组/数组）
- 实例创建和管理（默认/命名/Symbol实例）
- HTTP便捷方法（GET/POST/PUT/DELETE等）
- 一次性拦截器的添加和清理
- 配置合并和优先级
- 错误处理流程

🔥 验证：多格式拦截器支持、实例隔离管理、配置优先级等复杂逻辑！
