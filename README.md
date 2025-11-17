# @seed-fe/request

基于 Axios 封装的企业级 HTTP 请求库，支持多实例管理和灵活的拦截器配置。

## 特性

- 🚀 基于 Axios，保持原有 API 兼容性
- 🏗️ 支持多实例管理，灵活配置不同的请求环境
- 🔧 丰富的拦截器配置选项（函数、对象、元组形式）
- 📦 TypeScript 支持，完整的类型定义
- 🛡️ 统一的错误处理机制
- ⚡ 支持请求级别的配置覆盖

## 安装

```bash
npm install @seed-fe/request axios
```

```bash
yarn add @seed-fe/request axios
```

```bash
pnpm add @seed-fe/request axios
```

> 注意：axios 是 peer dependency，需要单独安装

## 快速开始

### 配置实例

```typescript
import { defineRequestConfig } from '@seed-fe/request';

// 定义默认配置
defineRequestConfig({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  interceptors: {
    request: {
      onConfig: (config) => {
        config.headers.Authorization = `Bearer ${getToken()}`;
        return config;
      }
    },
    response: {
      onConfig: (response) => response.data, // 默认已支持
      onError: (error) => {
        console.error('请求失败:', error);
        return Promise.reject(error);
      }
    }
  }
});
```

### 基础使用

```typescript
import httpRequest from '@seed-fe/request';

// 发送 GET 请求
const data = await httpRequest.get('/api/users');

// 发送 POST 请求
const result = await httpRequest.post('/api/users', { name: 'John' });
```

## API 参考

### 核心 API

#### `defineRequestConfig(config)`

注册请求实例配置。

**参数：**

- `config: CustomRequestConfig | CustomRequestConfig[]` - 单个配置或配置数组

**示例：**

```typescript
// 单个配置
defineRequestConfig({
  baseURL: 'https://api.example.com',
  timeout: 5000
});

// 多个配置
defineRequestConfig([
  { instanceName: 'api1', baseURL: 'https://api1.example.com' },
  { instanceName: 'api2', baseURL: 'https://api2.example.com' }
]);
```

#### `getRequestInstance(instanceName?)`

获取指定的请求实例。

**参数：**

- `instanceName?: InstanceName` - 实例名称，默认为默认实例

**返回：**

- `RequestInstance` - 请求实例

**示例：**

```typescript
import { getRequestInstance } from '@seed-fe/request';

const apiInstance = getRequestInstance('api1');
const data = await apiInstance.get('/users');
```

#### `request(config)`

全局请求方法。

**参数：**

- `config: CustomRequestConfig` - 请求配置

**示例：**

```typescript
import { request } from '@seed-fe/request';

const data = await request({
  url: '/api/users',
  method: 'GET',
  instanceName: 'api1' // 可选，指定使用的实例
});
```

### HTTP 方法快捷方式

在 `request` 函数的基础上添加了便捷方法。

#### `httpRequest.get(url, config?)`

#### `httpRequest.post(url, data?, config?)`

#### `httpRequest.put(url, data?, config?)`

#### `httpRequest.delete(url, config?)`

#### `httpRequest.patch(url, data?, config?)`

#### `httpRequest.head(url, config?)`

#### `httpRequest.options(url, config?)`

**示例：**

```typescript
// GET 请求
const users = await httpRequest.get('/api/users');
const user = await httpRequest.get('/api/users/1', {
  params: { include: 'profile' }
});

// POST 请求
const newUser = await httpRequest.post('/api/users', {
  name: 'John',
  email: 'john@example.com'
});

// PUT 请求
const updatedUser = await httpRequest.put('/api/users/1', {
  name: 'John Doe'
});

// DELETE 请求
await httpRequest.delete('/api/users/1');
```

## 配置选项

### CustomRequestConfig

继承自 `AxiosRequestConfig`，并添加了以下选项：

```typescript
interface CustomRequestConfig extends AxiosRequestConfig {
  // 实例名称
  instanceName?: InstanceName;

  // 是否返回完整响应对象（包含状态码、响应头等）
  withFullResponse?: boolean;

  // 是否跳过错误处理
  skipErrorHandler?: boolean;

  // 错误处理配置
  errorConfig?: {
    errorHandler?: (error: unknown, options: { config: CustomRequestConfig }) => void;
  };

  // 拦截器配置
  interceptors?: {
    request?: RequestInterceptorConfig;
    response?: ResponseInterceptorConfig;
  };

  // 兼容旧版本的拦截器配置
  requestInterceptors?: RequestInterceptorConfig;
  responseInterceptors?: ResponseInterceptorConfig;
}
```

## 拦截器配置

### 支持的拦截器格式

#### 1. 函数形式

```typescript
interceptors: {
  request: (config) => {
    // 处理请求配置
    return config;
  },
  response: (response) => {
    // 处理响应数据
    return response;
  }
}
```

#### 2. 对象形式

```typescript
interceptors: {
  request: {
    onConfig: (config) => config,
    onError: (error) => Promise.reject(error)
  },
  response: {
    onConfig: (response) => response,
    onError: (error) => Promise.reject(error)
  }
}
```

#### 3. 元组形式

```typescript
interceptors: {
  request: [
    (config) => config,           // onFulfilled
    (error) => Promise.reject(error) // onRejected
  ],
  response: [
    (response) => response,
    (error) => Promise.reject(error)
  ]
}
```

#### 4. 数组形式（多个拦截器）

```typescript
interceptors: {
  request: [
    (config) => config,
    {
      onConfig: (config) => config,
      onError: (error) => Promise.reject(error)
    },
    [
      (config) => config,
      (error) => Promise.reject(error)
    ]
  ]
}
```

## 使用示例

### 多实例管理

```typescript
// 配置多个实例
defineRequestConfig([
  {
    instanceName: 'userAPI',
    baseURL: 'https://api.example.com',
    timeout: 5000
  },
  {
    instanceName: 'authAPI',
    baseURL: 'https://auth.example.com',
    timeout: 3000
  }
]);

// 获取不同实例
const usersRequest = getRequestInstance('userAPI');
const authRequest = getRequestInstance('authAPI');

// 使用不同实例
const users = await usersRequest({
  url: '/users',
  method: 'GET',
});

const authInfo = await authRequest({
  url: '/login',
  method: 'POST',
  data: payload,
});
```

### 获取完整响应

```typescript
// 获取完整响应对象
const response = await httpRequest.get('/api/users', {
  withFullResponse: true
});

console.log(response.status);   // 状态码
console.log(response.headers);  // 响应头
console.log(response.data);     // 响应数据
```

### 共享预设（Shared Preset）与层级覆盖（请求 > 实例 > 共享）

> 本库不预置业务动作（认证/i18n 仅为示例），通过“共享预设 + 阶段钩子”机制在请求/响应/错误三个阶段执行自定义逻辑。

```ts
import { defineSharedPreset, updateSharedContext, defineRequestConfig, request } from '@seed-fe/request';

// 1) 定义共享预设（示例：请求阶段打标签；错误阶段统一标准化为 Promise.reject(Error)）
defineSharedPreset({
  onRequest: {
    handlers: [
      (cfg) => {
        cfg.headers = cfg.headers || {};
        (cfg.headers as any)['X-App'] = 'demo';
        return cfg;
      },
    ],
  },
  onError: { handlers: [] }, // 启用错误阶段：将通过响应 onRejected 注入 normalize
});

// 2) 定义两个实例（默认启用共享预设），如需禁用，可设置 useSharedPreset: false
defineRequestConfig({ instanceName: 'svcA', baseURL: '/a' }); // 默认启用
defineRequestConfig({ instanceName: 'svcB', baseURL: '/b', useSharedPreset: false }); // 显式禁用

// 3) 运行期更新共享上下文（示例：语言），后续请求读取最新值（当次派发快照）
updateSharedContext({ lang: 'zh-CN' });
await request({ instanceName: 'svcA', url: '/users' });
updateSharedContext({ lang: 'en-US' });
await request({ instanceName: 'svcA', url: '/users' });

// 4) 层级覆盖：请求级 > 实例级 > 共享级
//   - 临时禁用错误阶段（本次请求不注入 normalize onRejected）
await request({ instanceName: 'svcB', url: '/files', presetOverrides: { onError: { enabled: false } } });

```

### 异常处理（Legacy，迁移中）

> 下列内容为旧版 errorHandler 方案示例，为兼容迁移暂时保留；
> 新项目推荐使用“错误处理（Middleware/next 风格 - alpha）”。详见 MIGRATION-alpha.md。

#### 异常处理（请求级，Legacy）

对单次请求临时指定错误处理器（独立于实例与共享配置）：

```typescript
import httpRequest, { request } from '@seed-fe/request';

// 使用 httpRequest 便捷方法
await httpRequest.get('/api/users', {
  errorConfig: {
    errorHandler: (error, { config }) => {
      // 单次请求特化处理（例如弹窗提示）
      console.warn('请求级失败:', config.url);
    }
  }
});

// 或使用 request 函数
await request({
  url: '/api/users/1',
  method: 'GET',
  errorConfig: {
    errorHandler: (error, { config }) => {
      console.warn('请求级失败:', config.url);
    }
  }
});
```

#### 异常处理（实例级，Legacy）

```typescript
defineRequestConfig({
  baseURL: 'https://api.example.com',
  errorConfig: {
    errorHandler: (error, { config }) => {
      if (error.response?.status === 401) {
        // 处理未授权错误
        redirectToLogin();
      }
    }
  }
});

// 跳过错误处理的请求（建议使用新版 skipErrorPipeline）
const data = await httpRequest.get('/api/users', {
  skipErrorPipeline: true
});
```

- 发生错误将会进入“所在实例”的 `errorHandler`；单次请求可用 `skipErrorHandler` 关闭。
- 若后端采用 200 + `success=false` 这类协议，请在响应拦截器中主动 throw，使异常统一进入 `errorHandler` (不建议这种 API 设计，推荐**响应体直接是资源数据，没有额外的包装层**，采用 [GitHub REST API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2022-11-28) 或 [Google Resource-oriented design (AIP-121)](https://google.aip.dev/121) 社区最佳实践)。

```typescript
// 所有错误都应以标准的 Promise.reject(Error) 格式抛出
import { normalizeError } from '@seed-fe/request';

// 请求拦截器错误处理
const requestInterceptor = {
  onError: (error: unknown) => normalizeError(error)
};

// 响应拦截器错误处理
const responseInterceptor = {
  onError: (error: unknown) => normalizeError(error)
};
```

#### 异常处理（共享级，Legacy）

当你有多个微服务实例，但错误处理策略希望统一时，可以使用共享错误处理：

```typescript
import { setGlobalErrorHandler, clearGlobalErrorHandler } from '@seed-fe/request';

// 配置共享错误处理（注意不要记录敏感信息）
setGlobalErrorHandler(async (error, { config, instanceName, normalized }) => {
  console.warn('请求失败', normalized.message, { url: config.url, instanceName });
});

// 撤销共享处理
// clearGlobalErrorHandler();
```

优先级说明（新管线）：

- 请求级 > 实例级 > 共享级
- 仅当中间件调用 `await next()` 时才会进入下一环
- 当 `skipErrorPipeline: true` 时，任何级别都不会执行

## 错误处理（Middleware/next 风格 - alpha）

顺序：请求级 → 实例级 → 共享级。调用 `await next()` 才会进入下一环；未调用 `next` 即在当前层终止。跳过开关：`skipErrorPipeline`。

### 请求级中间件

```ts
await httpRequest.get('/api/users', {
  errorPipeline: [
    async (ctx, next) => {
      // UI 提示（注意脱敏）
      console.warn('请求失败:', ctx.normalized.message, ctx.config.url);
      await next(); // 下探实例/共享
    },
  ],
});
```

### 实例级中间件（特有错误优先）

```ts
defineRequestConfig({
  instanceName: 'svcA',
  baseURL: '/svcA',
  errorPipeline: [
    async (ctx, next) => {
      if ((ctx as any).response?.status === 409) return; // 命中特有冲突错误终止
      await next(); // 否则交由共享
    },
  ],
});
```

### 共享级中间件（统一记录/告警）

```ts
import { setGlobalErrorPipeline } from '@seed-fe/request';

setGlobalErrorPipeline([
  async (ctx) => {
    console.warn('统一记录:', ctx.normalized.message, { url: ctx.config.url, instance: ctx.instanceName });
  },
]);
```

### 跳过整条错误管线

```ts
await httpRequest.get('/api/users', { skipErrorPipeline: true });
```

注意：中间件仅用于副作用（记录/告警/提示），最终错误仍以 Promise.reject(Error) 形式抛出；请勿记录敏感信息。

### 辅助函数

为在 TypeScript 严格模式下安全读取 `ctx.response.status`，本库提供了以下 helper（避免 `any` 断言）：

```ts
import { hasResponseStatus, getResponseStatus, type ErrorMiddleware } from '@seed-fe/request';

// 实例级：命中 409 则终止，未命中继续下探
export const svcAErrorPipeline: ErrorMiddleware[] = [
  async (ctx, next) => {
    if (hasResponseStatus(ctx.response) && ctx.response.status === 409) return;
    await next();
  },
];

// 共享级：统一拦截 401
const global401: ErrorMiddleware = async (ctx, next) => {
  if (getResponseStatus(ctx) === 401) {
    // 统一处理（注意脱敏/不可吞错）；示例：发出容器级 unhandledrejection 等
    return;
  }
  await next();
};
```

## 类型定义

```typescript
// 实例名称类型
type InstanceName = string | symbol;

// 请求实例类型
interface RequestInstance {
  <T = unknown>(config: CustomRequestConfig): Promise<T>;
  get<T = unknown>(url: string, config?: CustomRequestConfig): Promise<T>;
  post<T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig): Promise<T>;
  put<T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig): Promise<T>;
  delete<T = unknown>(url: string, config?: CustomRequestConfig): Promise<T>;
  patch<T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig): Promise<T>;
  head<T = unknown>(url: string, config?: CustomRequestConfig): Promise<T>;
  options<T = unknown>(url: string, config?: CustomRequestConfig): Promise<T>;
}
```

## License

MIT
