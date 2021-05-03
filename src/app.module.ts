import { AppLogger } from './utils/app-logger.util';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileService } from './services/file.service';
import { BotService } from './services/bot.service';
import { GuildController } from './controllers/guild.controller';
import { UserController } from './controllers/user.controller';
import { PassportModule } from '@nestjs/passport';
import { OauthService } from './services/oauth.service';
import { HttpModule } from "@nestjs/common";

@Module({
  imports: [
    AppLogger,
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: ["**/*.entity.js"],
      synchronize: process.env.NODE_ENV === "dev",
    }),
    PassportModule.register({}),
    HttpModule
  ],
  controllers: [GuildController, UserController],
  providers: [FileService, BotService, OauthService],
})
export class AppModule {}
