import { describe, expect, it } from 'vitest';
import httpRequest, { DEFAULT_INSTANCE_NAME, defineRequestConfig, getRequestInstance } from '../src/index';

describe('模块导出', () => {
  it('应该正确导出所有主要函数和常量', () => {
    expect(typeof httpRequest).toBe('function');
    expect(typeof httpRequest.get).toBe('function');
    expect(typeof httpRequest.post).toBe('function');
    expect(typeof httpRequest.put).toBe('function');
    expect(typeof httpRequest.delete).toBe('function');
    expect(typeof httpRequest.patch).toBe('function');
    expect(typeof httpRequest.head).toBe('function');
    expect(typeof httpRequest.options).toBe('function');

    expect(typeof defineRequestConfig).toBe('function');
    expect(typeof getRequestInstance).toBe('function');
    expect(typeof DEFAULT_INSTANCE_NAME).toBe('symbol');
  });

  it('DEFAULT_INSTANCE_NAME应该是Symbol.for("default")', () => {
    expect(DEFAULT_INSTANCE_NAME).toBe(Symbol.for('default'));
  });
});
