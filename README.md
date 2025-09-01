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

### 实例管理 API

#### `hasInstance(instanceName?)`

检查指定实例是否存在。

**参数：**

- `instanceName?: InstanceName` - 实例名称，默认为默认实例

**返回：**

- `boolean` - 实例是否存在

**示例：**

```typescript
import { hasInstance } from '@seed-fe/request';

if (hasInstance('api1')) {
  console.log('api1 实例已存在');
}
```

#### `clearInstance(instanceName?)`

清除指定实例及其配置。

**参数：**

- `instanceName?: InstanceName` - 实例名称，默认为默认实例

**返回：**

- `boolean` - 是否成功清除实例

**示例：**

```typescript
import { clearInstance } from '@seed-fe/request';

// 清除指定实例
const cleared = clearInstance('api1');
console.log(cleared ? '实例已清除' : '实例不存在');

// 清除默认实例
clearInstance();
```

#### `clearAllInstances()`

清除所有实例及其配置。

**示例：**

```typescript
import { clearAllInstances } from '@seed-fe/request';

// 清除所有实例
clearAllInstances();
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
    instanceName: 'mainAPI',
    baseURL: 'https://api.example.com',
    timeout: 5000
  },
  {
    instanceName: 'authAPI',
    baseURL: 'https://auth.example.com',
    timeout: 3000
  }
]);

// 使用不同实例
const users = await request({
  url: '/users',
  instanceName: 'mainAPI'
});

const authInfo = await request({
  url: '/login',
  instanceName: 'authAPI'
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

### 错误处理

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

// 跳过错误处理的请求
const data = await httpRequest.get('/api/users', {
  skipErrorHandler: true
});
```

```typescript
// 所有错误都以标准的 Promise.reject(Error) 格式抛出
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
