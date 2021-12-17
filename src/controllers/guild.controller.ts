import { CacheService } from './../services/cache.service';
import { Profile } from 'passport-discord';
import { GuildGuard } from './../guards/guild.guard';
import { CurrentProfile } from './../decorators/current-profile.decorator';
import { monthDate } from './../utils/timezones.util';
import { GuildOutModel, MemberOutModel } from './../models/out/guild.out.model';
import { BotService } from './../services/bot.service';
import { BadRequestException, Body, Controller, Delete, Get, MessageEvent, Param, Patch, Post, Query, Sse, UploadedFiles, UseGuards, UseInterceptors, CacheInterceptor, InternalServerErrorException } from '@nestjs/common';
import { Guild } from 'src/database/guild.entity';
import { UserGuard } from 'src/guards/user.guard';
import { createQueryBuilder } from 'typeorm';
import { TIMEZONES } from 'src/utils/timezones.util';
import { Observable, Subscriber } from 'rxjs';
import { Role } from 'src/decorators/role.decorator';

@Controller('guild')
@UseGuards(UserGuard, GuildGuard)
export class GuildController {

  constructor(
    private readonly bot: BotService,
    private readonly cache: CacheService
  ) { }

  @Get(":id")
  @Role("member")
  public async getOne(@Param('id') id: string): Promise<GuildOutModel> {
    const guild = await createQueryBuilder(Guild, "guild")
      .where("guild.id = :id", { id })
      .leftJoinAndSelect("guild.messages", "msg")
      .leftJoinAndSelect("guild.webhooks", "webhooks")
      .leftJoinAndSelect("msg.creator", "creator")
      .leftJoinAndSelect("msg.files", "files")
      .leftJoinAndSelect("guild.quotas", "quotas", "quotas.date >= :date", { date: monthDate() }).getOne();
    if (!guild)
      throw new InternalServerErrorException("Impossible to get the guild infos!");
    for (const msg of guild.messages) {
      const creator = await this.bot.getUser(msg.creator.id);
      msg.creator.name = creator.username;
      msg.creator.profile = creator.avatar;
    }
    const webhookIds = guild.webhooks.map(el => el.id);
    const guildInfo = await this.bot.getGuild(id);
    const webhooks = (await guildInfo.fetchWebhooks()).filter((_, key) => webhookIds.includes(key)).array();
    return new GuildOutModel(guild, guildInfo, webhooks);
  }

  @Sse(":id/add")
  @Role("admin")
  public onAddOne(@Param("id") id: string, @CurrentProfile() profile: Profile): Observable<MessageEvent> {
    let observerEl: Subscriber<MessageEvent>;
    const listener = () => {
      observerEl.next({ id, data: id });
      this.bot.newGuildEmitter.removeListener(id, listener);
      this.cache.del(profile.id); //Delete user cache for this profile (as it is outdated)
      observerEl.complete();
    };
    return new Observable(observer => {
      observerEl = observer;
      this.bot.newGuildEmitter.addListener(id, listener);
    });
  }
  
  @Get(":id/members")
  @Role("admin")
  @UseInterceptors(CacheInterceptor)
  public async getSuggestions(@Query("q") query: string, @Param("id") id: string): Promise<MemberOutModel[]> {
    const guild = await this.bot.getGuild(id);
    if (query.startsWith("@")) {
      query = query.substr(1);
      const members = (await guild.members.fetch({ query, limit: 20 })).array();
      return members.map(el => new MemberOutModel(el.displayName, el.nickname, el.id));
    }
      
  }

  @Patch(":id/scope")
  @Role("admin")
  public async patchScope(@Query("scope") scope: 'true' | 'false', @Param("id") id: string) {
    await Guild.update(id, { scope: scope === 'true' });
  }

  @Patch(":id/onetime")
  @Role("admin")
  public async patchPonctualMessages(@Query("delete") deleteOneTime: 'true' | 'false', @Param("id") id: string) {
    await Guild.update(id, { removeOneTimeMessage: deleteOneTime === 'true' });
  }

  @Patch(":id/timezone")
  @Role("admin")
  public async patchTimezone(@Query("timezone") timezone: string, @Param("id") id: string) {
    if (!TIMEZONES.includes(timezone))
      throw new BadRequestException();
    await Guild.update(id, { timezone });
  }

}