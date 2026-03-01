import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { BedrockModule } from './bedrock/bedrock.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EntriesModule } from './entries/entries.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    PrismaModule,
    BedrockModule,
    AuthModule,
    EntriesModule,
    FilesModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
