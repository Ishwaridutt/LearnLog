import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { ActivitiesModule } from './activities/activities.module';
import { FieldsModule } from './fields/fields.module';
import { TopicsModule } from './topics/topics.module';
import { StatsModule } from './stats/stats.module';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [PrismaModule, ProfileModule, ActivitiesModule, FieldsModule, TopicsModule, StatsModule, BackupModule],
})
export class AppModule {}
