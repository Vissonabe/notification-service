import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { LogsService } from './logs.service';

@Module({
  providers: [MetricsService, LogsService],
  exports: [MetricsService, LogsService],
})
export class MonitoringModule {} 