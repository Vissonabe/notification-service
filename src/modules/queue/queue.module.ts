import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { KafkaService } from './kafka.service';
import { RedisService } from './redis.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  providers: [KafkaService, RedisService],
  exports: [KafkaService, RedisService],
})
export class QueueModule {} 