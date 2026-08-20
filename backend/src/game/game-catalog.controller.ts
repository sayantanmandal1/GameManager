import { Controller, Get } from '@nestjs/common';
import type { GameCatalogEntry } from '../shared';
import { getGameCatalog } from './game-catalog';
import { GameRegistry } from './game-registry';

@Controller('games')
export class GameCatalogController {
  constructor(private readonly registry: GameRegistry) {}

  @Get('catalog')
  getCatalog(): { games: GameCatalogEntry[]; total: number } {
    const games = getGameCatalog(this.registry);
    return { games, total: games.length };
  }
}