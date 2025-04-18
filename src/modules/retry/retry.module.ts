import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RetryService } from './retry.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  providers: [RetryService],
  exports: [RetryService],
})
export class RetryModule {} 