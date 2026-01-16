import { Module } from '@nestjs/common';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';

@Module({
  controllers: [CoreController],
  providers: [CoreService],
  exports: [CoreService],
})
export class CoreModule {}
