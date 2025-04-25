import { Injectable } from '@nestjs/common';

@Injectable()
export class MockRedisService {
  private readonly storage: Record<string, string> = {};
  private readonly rateLimits: Record<string, number> = {};
  private readonly deviceStates: Record<string, string> = {};

  /**
   * Mock set method
   * @param key Key to set
   * @param value Value to set
   * @param ttl Time to live in seconds (optional)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.storage[key] = value;
  }

  /**
   * Mock get method
   * @param key Key to get
   * @returns Value or null if not found
   */
  async get(key: string): Promise<string | null> {
    return this.storage[key] || null;
  }

  /**
   * Mock delete method
   * @param key Key to delete
   */
  async del(key: string): Promise<void> {
    delete this.storage[key];
  }

  /**
   * Mock exists method
   * @param key Key to check
   * @returns True if key exists
   */
  async exists(key: string): Promise<boolean> {
    return key in this.storage;
  }

  /**
   * Mock increment method
   * @param key Key to increment
   * @returns New value
   */
  async incr(key: string): Promise<number> {
    const value = parseInt(this.storage[key] || '0', 10);
    const newValue = value + 1;
    this.storage[key] = newValue.toString();
    return newValue;
  }

  /**
   * Mock checkRateLimit method
   * @param key Rate limit key
   * @param limit Maximum attempts
   * @param windowInSeconds Time window in seconds
   * @returns Whether rate limit is exceeded
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowInSeconds: number,
  ): Promise<boolean> {
    const count = this.rateLimits[key] || 0;
    this.rateLimits[key] = count + 1;
    return count < limit;
  }

  /**
   * Mock setDeviceState method
   * @param deviceId Device ID
   * @param state State to set
   */
  async setDeviceState(deviceId: string, state: string): Promise<void> {
    this.deviceStates[deviceId] = state;
  }

  /**
   * Mock getDeviceState method
   * @param deviceId Device ID
   * @returns Device state
   */
  async getDeviceState(deviceId: string): Promise<string | null> {
    return this.deviceStates[deviceId] || null;
  }

  /**
   * Reset all mock data
   */
  reset(): void {
    Object.keys(this.storage).forEach(key => delete this.storage[key]);
    Object.keys(this.rateLimits).forEach(key => delete this.rateLimits[key]);
    Object.keys(this.deviceStates).forEach(key => delete this.deviceStates[key]);
  }

  /**
   * Connect mock method (no-op)
   */
  async connect(): Promise<void> {
    // No-op for mock
  }

  /**
   * Disconnect mock method (no-op)
   */
  async disconnect(): Promise<void> {
    // No-op for mock
  }
} 