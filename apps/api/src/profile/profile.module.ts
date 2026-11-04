import { Global, Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { SettingsService } from './settings.service';

@Global()
@Module({ controllers: [ProfileController], providers: [SettingsService], exports: [SettingsService] })
export class ProfileModule {}
