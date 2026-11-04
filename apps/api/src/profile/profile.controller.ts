import { Body, Controller, Get, NotFoundException, Put } from '@nestjs/common';
import { Profile, profileSchema, ProfileInput, Settings, settingsSchema, SettingsInput } from '@study/shared';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from './settings.service';

@Controller()
export class ProfileController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  @Get('profile')
  async getProfile(): Promise<Profile> {
    const p = await this.prisma.profile.findUnique({ where: { id: 1 } });
    if (!p) throw new NotFoundException('No profile yet');
    const agg = await this.prisma.activity.aggregate({ _sum: { totalSeconds: true } });
    return { name: p.name, createdAt: p.createdAt.toISOString(), totalSeconds: agg._sum.totalSeconds ?? 0 };
  }

  @Put('profile')
  async putProfile(@Body(new ZodPipe(profileSchema)) body: ProfileInput): Promise<Profile> {
    await this.prisma.profile.upsert({ where: { id: 1 }, update: { name: body.name }, create: { id: 1, name: body.name } });
    await this.settings.get();
    return this.getProfile();
  }

  @Get('settings')
  getSettings(): Promise<Settings> {
    return this.settings.get();
  }

  @Put('settings')
  putSettings(@Body(new ZodPipe(settingsSchema)) body: SettingsInput): Promise<Settings> {
    return this.settings.update(body);
  }
}
