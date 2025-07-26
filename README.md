# @seed-fe/request

基于 Axios 封装的 HTTP 请求库。

## 特性

- 支持多实例管理
- 灵活的拦截器配置

## 安装

```bash
# npm
npm install axios
npm install @seed-fe/request

# yarn
yarn add axios
yarn add @seed-fe/request

# pnpm (推荐)
pnpm add axios
pnpm add @seed-fe/request
```

## 使用

建议是分步操作：

定义请求配置 → 创建注册方法 → 项目入口文件注册 → 声明业务请求服务 → 视图中使用请求服务。

### 定义请求配置

`src/configs/request-default/index.ts`

```typescript
const defaultRequestConfig = {
  baseURL: 'https://api.example.com',
  timeout: 5000,
  interceptors: {
    request: {
      onConfig: (config) => {
        // 添加 Token
        config.headers.Authorization = `Bearer ${getToken()}`;
        return config;
      }
    },
    response: {
      onConfig: (response) => {
        // 处理响应数据
        return response.data;
      },
      onError: (error: unknown): Promise<never> => {
        // 仅处理未认证，其它异常由全局异常模块处理

        // 如果需要处理未认证的逻辑，可以在这里处理

        // 如果不需要处理，直接返回 Promise.reject(error)
        return Promise.reject(error);
      },
    }
  }
};

export default defaultRequestConfig;
```

拦截器支持多种配置结构，请参考源码类型定义。

### 声明配置函数

`src/services/request.ts`

```typescript
import type { AxiosRequestConfig } from "axios";
import httpRequest, { defineRequestConfig, getRequestInstance, type HttpRequest } from '@seed-fe/request';
import defaultRequestConfig from '@/configs/request-default';
import anotherRequestConfig from '@/configs/request-another';

/**
 * <Feature>请求实例
 */
let anotherRequestInstance: HttpRequest;

/**
 * 注册请求实例
 */
export function configureRequest() {
  // 全局默认请求实例
  defineRequestConfig(defaultRequestConfig);

  // <Feature>请求实例
  defineRequestConfig(anotherRequestConfig);
}

// 导出默认实例
export default httpRequest;

// 导出<Feature>请求实例
export function anotherRequest(option: AxiosRequestConfig) {
  anotherRequestInstance ??= getRequestInstance("AnotherRequestKey");
  return anotherRequestInstance(option);
}
```

`defineRequestConfig()` 支持多种配置结构，请参考源码类型定义。

### 项目入口文件注册

`src/main.ts`

```typescript
import { configureRequest } from '@/services/request';

// 注册请求配置
configureRequest();
```

### 声明业务请求服务

`src/services/feature/index.ts`

```typescript
import httpRequest from '@/services/request';

// 使用实例发送请求
export async function getFeature() {
  return await httpRequest({
    url: '/feature',
    method: 'GET',
  });
}
```

### 视图中使用请求服务

`src/pages/features/index.tsx`

```typescript
import { useRequest } from 'ahooks';
import { Empty, Spin } from 'antd';
import { getFeature } from '@/services/features';

export default function FeaturesHomePage() {
  const { data, loading, error } = useRequest(getFeature);

  if (loading) return <Spin />;
  if (error) return <Empty description="加载数据异常" />;

  return <div>{data}</div>;
}
```

### 异常

不要 `try...catch` 请求服务，异常应该由统一的全局拦截器处理。

- [@seed-fe/exception-handler - npm](https://www.npmjs.com/package/@seed-fe/exception-handler)

## License

MIT
