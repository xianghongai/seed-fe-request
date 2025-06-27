import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

/**
 * 响应数据可能是成功数据（任何类型）或错误响应
 */
export type ResponseStructure<T = unknown> = T;

export type InstanceName = symbol | string;

/**
 * 错误处理函数类型
 */
export type ErrorHandler = (error: unknown) => unknown;

/**
 * 请求拦截器处理函数
 */
export type RequestHandler = (
  config: InternalAxiosRequestConfig,
) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;

/**
 * 响应拦截器处理函数
 */
export type ResponseHandler = (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>;

/**
 * 拦截器对象基础接口
 */
export interface InterceptorObjectBase<TConfig, TError = ErrorHandler> {
  onConfig?: TConfig;
  onError?: TError;
}

/**
 * 请求拦截器对象接口
 */
export type RequestInterceptorObject = InterceptorObjectBase<RequestHandler>;

/**
 * 响应拦截器对象接口
 */
export type ResponseInterceptorObject = InterceptorObjectBase<ResponseHandler>;

/**
 * 请求拦截器 - 函数或元组形式
 */
export type RequestInterceptorFn = RequestHandler | [RequestHandler, ErrorHandler];

/**
 * 响应拦截器 - 函数或元组形式
 */
export type ResponseInterceptorFn = ResponseHandler | [ResponseHandler, ErrorHandler];

/**
 * 请求拦截器类型 - 可以是对象或函数/元组
 */
export type AnyRequestInterceptor = RequestInterceptorObject | RequestInterceptorFn;

/**
 * 响应拦截器类型 - 可以是对象或函数/元组
 */
export type AnyResponseInterceptor = ResponseInterceptorObject | ResponseInterceptorFn;

// 保持向后兼容性，使用新的类型别名
export type RequestInterceptor = RequestInterceptorFn;
export type ResponseInterceptor = ResponseInterceptorFn;

/**
 * 自定义请求配置接口，扩展 AxiosRequestConfig
 */
export type CustomRequestConfig<D = unknown> = AxiosRequestConfig<D> & {
  /**
   * 实例名称
   */
  instanceName?: InstanceName;
  /**
   * 是否跳过错误处理
   */
  skipErrorHandler?: boolean;
  /**
   * 是否返回完整响应
   */
  withFullResponse?: boolean;
  /**
   * 错误配置
   */
  errorConfig?: {
    /**
     * 错误处理函数，用于处理错误
     * @param error 错误
     * @param options 选项，包含请求配置
     */
    errorHandler?: (error: unknown, options: { config: CustomRequestConfig }) => void;
    /**
     * 错误抛出函数，用于抛出错误
     * 后端自定义异常结构时主动抛错（比如 success: false 但 http 状态码还是 200），需要主动抛出错误，以供 errorHandler 处理
     * @param response 响应数据
     */
    errorThrower?: (response: ResponseStructure<unknown>) => void;
  };
  /**
   * 拦截器配置，支持多种格式
   * 对象格式: { onConfig, onError }
   * 数组格式: 数组中的元素可以是函数、元组或对象
   */
  interceptors?: {
    request?: RequestInterceptorObject | AnyRequestInterceptor[];
    response?: ResponseInterceptorObject | AnyResponseInterceptor[];
  };

  /**
   * 拦截器配置,兼容 umi
   * @deprecated 推荐使用 interceptors 代替
   */
  requestInterceptors?: RequestInterceptorFn[];

  /**
   * 拦截器配置,兼容 umi
   * @deprecated 推荐使用 interceptors 代替
   */
  responseInterceptors?: ResponseInterceptorFn[];
};

/**
 * 拦截器 ID 类型
 * -1 表示拦截器添加失败
 * 0 或正整数表示拦截器的唯一标识
 */
export type InterceptorId = number;

/**
 * HTTP请求接口
 */
export interface HttpRequest {
  <T = unknown>(config: CustomRequestConfig): Promise<T>;
  get: <T = unknown>(url: string, config?: CustomRequestConfig) => Promise<T>;
  post: <T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig) => Promise<T>;
  put: <T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig) => Promise<T>;
  delete: <T = unknown>(url: string, config?: CustomRequestConfig) => Promise<T>;
  patch: <T = unknown>(url: string, data?: unknown, config?: CustomRequestConfig) => Promise<T>;
  head: <T = unknown>(url: string, config?: CustomRequestConfig) => Promise<T>;
  options: <T = unknown>(url: string, config?: CustomRequestConfig) => Promise<T>;
}

export interface RequestInstance extends HttpRequest {
  // 继承HttpRequest的所有属性和方法
}
