/**
 * 性能监控工具
 * 用于监控和分析系统性能瓶颈
 */

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  totalOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  slowestOperations: PerformanceMetric[];
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 1000; // 限制内存使用

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 记录性能指标
   */
  record(operation: string, duration: number, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      metadata
    };

    this.metrics.push(metric);

    // 限制内存使用
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  /**
   * 获取性能统计
   */
  getStats(): PerformanceStats {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        slowestOperations: []
      };
    }

    const durations = this.metrics.map(m => m.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = totalDuration / this.metrics.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    // 获取最慢的10个操作
    const slowestOperations = [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      totalOperations: this.metrics.length,
      averageDuration,
      minDuration,
      maxDuration,
      slowestOperations
    };
  }

  /**
   * 获取指定操作的统计
   */
  getOperationStats(operation: string): PerformanceStats {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    
    if (operationMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        slowestOperations: []
      };
    }

    const durations = operationMetrics.map(m => m.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = totalDuration / operationMetrics.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    return {
      totalOperations: operationMetrics.length,
      averageDuration,
      minDuration,
      maxDuration,
      slowestOperations: operationMetrics
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
    };
  }

  /**
   * 清除所有指标
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * 打印性能报告
   */
  printReport(): void {
    const stats = this.getStats();
    
    console.log('\n📊 性能监控报告');
    console.log('='.repeat(50));
    console.log(`总操作数: ${stats.totalOperations}`);
    console.log(`平均耗时: ${stats.averageDuration.toFixed(2)}ms`);
    console.log(`最快操作: ${stats.minDuration}ms`);
    console.log(`最慢操作: ${stats.maxDuration}ms`);
    
    if (stats.slowestOperations.length > 0) {
      console.log('\n🐌 最慢的5个操作:');
      stats.slowestOperations.forEach((metric, index) => {
        console.log(`${index + 1}. ${metric.operation}: ${metric.duration}ms`);
        if (metric.metadata) {
          console.log(`   详情: ${JSON.stringify(metric.metadata)}`);
        }
      });
    }

    // 按操作类型分组统计
    const operationGroups = new Map<string, PerformanceMetric[]>();
    this.metrics.forEach(metric => {
      if (!operationGroups.has(metric.operation)) {
        operationGroups.set(metric.operation, []);
      }
      operationGroups.get(metric.operation)!.push(metric);
    });

    console.log('\n📈 各操作类型统计:');
    operationGroups.forEach((metrics, operation) => {
      const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
      console.log(`${operation}: ${avgDuration.toFixed(2)}ms (${metrics.length}次)`);
    });
  }
}

/**
 * 性能监控装饰器
 */
export function monitorPerformance(operationName?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        PerformanceMonitor.getInstance().record(operation, duration);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        PerformanceMonitor.getInstance().record(operation, duration, { error: true });
        throw error;
      }
    };
  };
} 