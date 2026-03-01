import { Module } from '@nestjs/common';
import { BedrockService } from './bedrock.service';

@Module({
  providers: [BedrockService],
  exports: [BedrockService],
})
export class BedrockModule {}
