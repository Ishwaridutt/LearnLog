import { Body, Controller, Delete, Get, HttpCode, Module, NotFoundException, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, readdirSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import {
  FocusEditInput,
  focusEditSchema,
  FocusHistoryQuery,
  focusHistoryQuerySchema,
  FocusSound,
  FocusStartInput,
  focusStartSchema,
} from '@study/shared';
import { ZodPipe } from '../common/zod.pipe';
import { FocusService } from './focus.service';

/** <repo>/sounds by default (this file runs from apps/api/dist/focus or apps/api/src/focus). */
export const SOUNDS_DIR = resolve(process.env.SOUNDS_DIR ?? resolve(__dirname, '../../../../sounds'));
const AUDIO_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.webm': 'audio/webm',
  '.flac': 'audio/flac',
};

function listSounds(): FocusSound[] {
  if (!existsSync(SOUNDS_DIR)) return [];
  return readdirSync(SOUNDS_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith('.') && extname(d.name).toLowerCase() in AUDIO_TYPES)
    .map((d) => ({
      file: d.name,
      // "soft-bell_02.mp3" -> "soft bell 02"
      name: basename(d.name, extname(d.name)).replace(/[-_]+/g, ' ').trim(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

@Controller('focus')
export class FocusController {
  constructor(private readonly focus: FocusService) {}

  @Get('current')
  current() {
    return this.focus.current();
  }

  @Get('history')
  history(@Query(new ZodPipe(focusHistoryQuerySchema)) q: FocusHistoryQuery) {
    return this.focus.history(q);
  }

  @Get('topics')
  topics() {
    return this.focus.topicOptions();
  }

  /** Audio files the user dropped into the sounds/ folder. */
  @Get('sounds')
  sounds() {
    return { folder: SOUNDS_DIR, sounds: listSounds() };
  }

  @Get('sounds/:file')
  sound(@Param('file') file: string, @Res() res: Response) {
    // Only names that the listing returned: no paths, no traversal.
    const match = listSounds().find((s) => s.file === file);
    if (!match) throw new NotFoundException('Sound not found');
    res.type(AUDIO_TYPES[extname(match.file).toLowerCase()]);
    res.sendFile(match.file, { root: SOUNDS_DIR, maxAge: 0 });
  }

  @Post('start')
  @HttpCode(200)
  start(@Body(new ZodPipe(focusStartSchema)) body: FocusStartInput) {
    return this.focus.start(body);
  }

  @Post(':id/pause')
  @HttpCode(200)
  pause(@Param('id') id: string) {
    return this.focus.pause(id);
  }

  @Post(':id/resume')
  @HttpCode(200)
  resume(@Param('id') id: string) {
    return this.focus.resume(id);
  }

  @Post(':id/stop')
  @HttpCode(200)
  stop(@Param('id') id: string) {
    return this.focus.stop(id);
  }

  @Patch(':id')
  edit(@Param('id') id: string, @Body(new ZodPipe(focusEditSchema)) body: FocusEditInput) {
    return this.focus.edit(id, body.plannedSeconds);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.focus.remove(id);
  }
}

@Module({ controllers: [FocusController], providers: [FocusService] })
export class FocusModule {}
