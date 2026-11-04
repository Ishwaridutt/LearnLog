import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // DATABASE_URL lets you point the API at another SQLite file (e.g. for testing);
    // otherwise the schema default, data/study.db, is used.
    super(process.env.DATABASE_URL ? { datasourceUrl: process.env.DATABASE_URL } : undefined);
  }

  async onModuleInit() {
    await this.$connect();
  }
}
