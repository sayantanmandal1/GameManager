import { Controller, Get } from '@nestjs/common';
import { GAME_CATALOG, type GameCatalogEntry } from '../shared';

@Controller('games')
export class GameCatalogController {
  @Get('catalog')
  getCatalog(): readonly GameCatalogEntry[] {
    return GAME_CATALOG;
  }
}