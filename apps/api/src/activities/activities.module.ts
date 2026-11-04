import { Global, Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller';
import { TimerService } from './timer.service';

@Global()
@Module({ controllers: [ActivitiesController], providers: [TimerService], exports: [TimerService] })
export class ActivitiesModule {}
