import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const CARD_SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const CODE_COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];
const YACHT_CATEGORIES = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
  'three_kind', 'four_kind', 'full_house', 'small_straight',
  'large_straight', 'yacht', 'chance',
];

export class GridSalvoShipDto {
  @IsInt()
  @Min(0)
  @Max(99)
  start!: number;

  @IsInt()
  @Min(0)
  @Max(99)
  end!: number;
}

export class BridgeCallDto {
  @IsIn(['pass', 'bid', 'double', 'redouble'])
  type!: 'pass' | 'bid' | 'double' | 'redouble';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  level?: number;

  @IsOptional()
  @IsIn(['clubs', 'diamonds', 'hearts', 'spades', 'notrump'])
  strain?: 'clubs' | 'diamonds' | 'hearts' | 'spades' | 'notrump';
}

export class EuchreCallDto {
  @IsIn(['pass', 'order_up', 'name_trump'])
  type!: 'pass' | 'order_up' | 'name_trump';

  @IsOptional()
  @IsBoolean()
  alone?: boolean;

  @IsOptional()
  @IsIn(CARD_SUITS)
  suit?: 'clubs' | 'diamonds' | 'hearts' | 'spades';
}

export class DistinctActionPayloadDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  cell?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(63)
  from?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(63)
  to?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  pit?: number;

  @IsOptional()
  @IsIn(['horizontal', 'vertical'])
  orientation?: 'horizontal' | 'vertical';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  row?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  column?: number;

  @IsOptional()
  @IsIn([
    'roll', 'hold', 'place_fleet', 'shoot', 'set_code', 'guess_code',
    'set_phrase', 'guess_letter', 'guess_phrase', 'ask', 'play_card',
    'draw_card', 'roll_dice', 'score_category', 'bid', 'challenge',
    'roll_farkle', 'select_dice', 'bank_farkle', 'roll_box',
    'close_tiles', 'play_domino', 'draw_domino',
    'pass_cards', 'bid_spades', 'gin_draw', 'gin_discard', 'battle',
    'draw_from_player', 'place_hex', 'place_stone', 'move_stone',
    'remove_stone', 'roll_ceelo', 'answer_trivia', 'next_question',
    'reveal_tile', 'acknowledge_mismatch',
    'select_bridge_mode', 'bridge_call', 'play_bridge_card',
    'bridge_surrender_vote', 'next_bridge_deal',
    'bourre_decide', 'play_bourre_card', 'next_bourre_hand',
    'bluff_play', 'bluff_accept', 'bluff_challenge',
    'play_sevens_card', 'pass_sevens', 'next_sevens_round',
    'play_ninety_nine', 'concede_ninety_nine',
    'euchre_call', 'euchre_discard', 'play_euchre_card', 'next_euchre_hand',
    'play_whist_card', 'next_whist_hand',
    'bid_oh_hell', 'play_oh_hell_card', 'next_oh_hell_deal',
    'play_president_cards', 'pass_president', 'return_president_card', 'next_president_round',
    'flip_slapjack', 'slap_jack', 'continue_slapjack',
    'pass_spoon_card', 'grab_spoon', 'next_spoons_round',
  ])
  type?: string;

  @IsOptional()
  @IsBoolean()
  play?: boolean;

  @IsOptional()
  @IsInt()
  @Min(-10)
  @Max(99)
  chosenValue?: number;

  @IsOptional()
  @IsIn(['rubber', 'duplicate', 'home'])
  mode?: 'rubber' | 'duplicate' | 'home';

  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BridgeCallDto)
  call?: BridgeCallDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EuchreCallDto)
  euchreCall?: EuchreCallDto;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => GridSalvoShipDto)
  ships?: GridSalvoShipDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsIn(CODE_COLORS, { each: true })
  colors?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Za-z ]+$/)
  phrase?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1)
  @Matches(/^[A-Za-z]$/)
  letter?: string;

  @IsOptional()
  @IsUUID()
  targetPlayerId?: string;

  @IsOptional()
  @IsIn(CARD_RANKS)
  rank?: string;

  @IsOptional()
  @IsString()
  @Length(1, 24)
  @Matches(/^[A-Za-z0-9:-]+$/)
  cardId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @Length(1, 24, { each: true })
  @Matches(/^[A-Za-z0-9:-]+$/, { each: true })
  cardIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @Length(1, 24, { each: true })
  @Matches(/^[A-Za-z0-9:-]+$/, { each: true })
  discardIds?: string[];

  @IsOptional()
  @IsIn(CARD_SUITS)
  chosenSuit?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(4, { each: true })
  heldIndices?: number[];

  @IsOptional()
  @IsIn(YACHT_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  face?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(13)
  bid?: number;

  @IsOptional()
  @IsIn(['stock', 'discard'])
  source?: 'stock' | 'discard';

  @IsOptional()
  @IsBoolean()
  knock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  handIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  node?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  answerIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  tileIndex?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(5, { each: true })
  indices?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(9, { each: true })
  tiles?: number[];

  @IsOptional()
  @IsString()
  @Length(1, 12)
  @Matches(/^d-[0-6]-[0-6]$/)
  dominoId?: string;

  @IsOptional()
  @IsIn(['left', 'right'])
  end?: 'left' | 'right';

  @IsOptional()
  @IsBoolean()
  flip?: boolean;
}

export class DistinctGameActionDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DistinctActionPayloadDto)
  action!: DistinctActionPayloadDto;
}