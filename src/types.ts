import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

/**
 * 响应数据可能是成功数据（任何类型）或错误响应
 */
export type ResponseStructure<T = unknown> = T;

export type InstanceName = symbol | string;

/**
 * 错误处理函数类型
 */
export type ErrorHandler = (error: unknown) => unknown; // legacy, to be removed in future major

/**
 * 共享错误处理的上下文信息（最小充分）
 */
// 旧版 ErrorContext（含 cause 字段）已移除，统一使用下方新接口（error/state 字段）

/**
 * 全局共享错误处理函数类型（不改变现有实例/请求级签名以保持兼容）
 */
export type GlobalErrorHandler = (error: unknown, context: ErrorContext) => void | Promise<void>;

/**
 * 请求拦截器处理函数
 */
export type RequestHandler = (
  config: InternalAxiosRequestConfig
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
   * 是否跳过错误处理（legacy）
   * 说明：与 skipErrorPipeline 等价，保留兼容；新代码推荐使用 skipErrorPipeline。
   */
  skipErrorHandler?: boolean;
  /**
   * 跳过整条错误中间件管道
   * 说明：跳过“请求/实例/全局”三层错误管道；与共享预设 onError 无关。
   */
  skipErrorPipeline?: boolean;
  /**
   * 是否返回完整响应
   */
  withFullResponse?: boolean;
  /**
   * 是否启用共享预设（Shared Preset）
   * - 实例级默认启用；如需禁用，在实例或请求上将其设为 false
   */
  useSharedPreset?: boolean;
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
   * 请求级错误中间件管道（Koa 风格）
   */
  errorPipeline?: ErrorMiddleware[];
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
  /**
   * （可选）请求级共享预设覆盖与合并策略
   */
  presetOverrides?: PresetOverrides;
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

/**
 * 错误处理中间件（Koa 风格）
 */
export interface ErrorContext {
  error: unknown;
  normalized: Error;
  config: CustomRequestConfig;
  instanceName?: InstanceName;
  response?: unknown;
  state: Record<string, unknown>;
}

export type ErrorNext = () => Promise<void>;
export type ErrorMiddleware = (ctx: ErrorContext, next: ErrorNext) => void | Promise<void>;

/**
 * 共享预设（Shared Preset）相关类型
 * 说明：本库仅提供“机制”与类型契约，不预置具体业务行为。
 */

// 共享上下文（只读视图），用于阶段钩子读取运行期的键值参数
export type PresetContext = Readonly<Record<string, unknown>>;

// 阶段参数（只读视图），供阶段钩子消费
export type StageParams = Readonly<Record<string, unknown>>;

// 各阶段可用的处理器形态
export type RequestStageHook = AnyRequestInterceptor;
export type ResponseStageHook = AnyResponseInterceptor;
export type ErrorStageHook = ErrorMiddleware;

// 聚合的“阶段处理器”类型（在部分工具类型中作为联合类型使用）
export type StageHook = RequestStageHook | ResponseStageHook | ErrorStageHook;

// 阶段配置（只读契约）；handlers 支持单个或数组
export interface StageConfig<THandler = unknown> {
  enabled?: boolean;
  params?: StageParams;
  handlers?: ReadonlyArray<THandler> | THandler;
}

// 共享预设的顶层形状（只读契约）
export interface SharedPreset {
  id?: string;
  context?: PresetContext;
  onRequest?: StageConfig<RequestStageHook>;
  onResponse?: StageConfig<ResponseStageHook>;
  onError?: StageConfig<ErrorStageHook>;
}

// 层级覆盖（请求/实例级）允许覆盖 SharedPreset 的子集
export type PresetOverrides = Partial<{
  context: Partial<PresetContext>;
  onRequest: StageConfig<RequestStageHook>;
  onResponse: StageConfig<ResponseStageHook>;
  onError: StageConfig<ErrorStageHook>;
  /** 当为 true 时，handlers 采用“追加”而非“整组覆盖” */
  appendHandlers: boolean;
}>;

/**
 * 重要说明：
 * - presetOverrides.onError.enabled 仅影响“共享预设阶段”是否向响应拦截器追加一个 onRejected；
 *   它不会禁用或跳过“请求/实例/全局”的错误管道。
 * - 若要在某个请求上完全不执行错误管道（请求/实例/全局），请使用 config.skipErrorPipeline（或 legacy: skipErrorHandler）。
 */

// 统一错误合同（给调用方消费，技术无关）
export interface StandardizedError {
  type: string; // http | network | timeout | cancelled | unknown
  message: string;
  status?: number;
  requestId?: string;
  cause?: unknown;
  // 可观测标记：表明该错误已走过标准化路径
  standardized?: true;
}
