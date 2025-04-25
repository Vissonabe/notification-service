import { Injectable } from '@nestjs/common';

@Injectable()
export class MockKafkaService {
  private readonly topics: Record<string, Function[]> = {};
  private readonly producedMessages: Array<{ topic: string; message: any }> = [];

  /**
   * Get all produced messages for testing
   */
  getProducedMessages(): Array<{ topic: string; message: any }> {
    return [...this.producedMessages];
  }

  /**
   * Clear all produced messages (for test cleanup)
   */
  clearProducedMessages(): void {
    this.producedMessages.length = 0;
  }

  /**
   * Mock produce method
   * @param topic Topic to produce to
   * @param message Message to produce
   */
  async produce(topic: string, message: any): Promise<void> {
    this.producedMessages.push({ topic, message });
    
    // Trigger any subscribed handlers
    if (this.topics[topic]) {
      for (const handler of this.topics[topic]) {
        await handler(message);
      }
    }
  }

  /**
   * Mock subscribe method
   * @param topic Topic to subscribe to
   * @param handler Message handler
   */
  subscribe(topic: string, handler: Function): void {
    if (!this.topics[topic]) {
      this.topics[topic] = [];
    }
    this.topics[topic].push(handler);
  }

  /**
   * Connect mock (no-op)
   */
  async connect(): Promise<void> {
    // No-op for mock
  }

  /**
   * Disconnect mock (no-op)
   */
  async disconnect(): Promise<void> {
    // No-op for mock
  }
} 