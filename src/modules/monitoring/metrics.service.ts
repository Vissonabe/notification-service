import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private counters: Record<string, number> = {};
  private histograms: Record<string, number[]> = {};

  constructor() {
    // Initialize common metrics
    this.counters = {
      'notifications.created': 0,
      'notifications.delivered': 0,
      'notifications.failed': 0,
      'notifications.expired': 0,
      'devices.registered': 0,
      'devices.updated': 0,
    };
    
    this.histograms = {
      'notification.processing_time': [],
      'notification.delivery_time': [],
    };
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    if (!this.counters[name]) {
      this.counters[name] = 0;
    }
    
    this.counters[name] += value;
    
    // In a real implementation, we would send this to a metrics system like Prometheus
    this.logger.debug(`Metric ${name} = ${this.counters[name]}${tags ? ' ' + JSON.stringify(tags) : ''}`);
  }

  /**
   * Record a value in a histogram metric
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.histograms[name]) {
      this.histograms[name] = [];
    }
    
    this.histograms[name].push(value);
    
    // In a real implementation, we would send this to a metrics system like Prometheus
    this.logger.debug(`Histogram ${name} = ${value}${tags ? ' ' + JSON.stringify(tags) : ''}`);
  }

  /**
   * Measure the execution time of a function
   */
  async measureExecutionTime<T>(
    metricName: string, 
    fn: () => Promise<T>, 
    tags?: Record<string, string>
  ): Promise<T> {
    const startTime = Date.now();
    try {
      return await fn();
    } finally {
      const executionTime = Date.now() - startTime;
      this.recordHistogram(metricName, executionTime, tags);
    }
  }

  /**
   * Get all current metrics (for debugging/admin purposes)
   */
  getAllMetrics(): { counters: Record<string, number>, histograms: Record<string, number[]> } {
    return {
      counters: { ...this.counters },
      histograms: { ...this.histograms },
    };
  }
} 