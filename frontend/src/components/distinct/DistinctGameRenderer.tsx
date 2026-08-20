import type {
  CheckersPlayerView,
  BridgePlayerView,
  BluffPlayerView,
  BourrePlayerView,
  CrazyEightsPlayerView,
  DistinctGameAction,
  DistinctGameKey,
  DistinctGamePlayerView,
  DotsAndBoxesPlayerView,
  EuchrePlayerView,
  DrawDominoesPlayerView,
  FarklePlayerView,
  CardWarPlayerView,
  CeeLoPlayerView,
  GinRummyPlayerView,
  GoFishPlayerView,
  GridSalvoPlayerView,
  HangmanPlayerView,
  HeartsPlayerView,
  HexPlayerView,
  LiarsDicePlayerView,
  MancalaPlayerView,
  MemoryMatchPlayerView,
  MorrisPlayerView,
  NinetyNinePlayerView,
  OldMaidPlayerView,
  OhHellPlayerView,
  PegCodePlayerView,
  PigPlayerView,
  PresidentPlayerView,
  ReversiPlayerView,
  ShutTheBoxPlayerView,
  SevensPlayerView,
  SpadesPlayerView,
  SlapjackPlayerView,
  SpoonsPlayerView,
  TriviaPlayerView,
  WhistPlayerView,
  YachtPlayerView,
} from '@/shared';
import { CardWarRenderer } from './renderers/CardWarRenderer';
import { BridgeRenderer } from './renderers/BridgeRenderer';
import { BluffRenderer } from './renderers/BluffRenderer';
import { BourreRenderer } from './renderers/BourreRenderer';
import { CeeLoRenderer } from './renderers/CeeLoRenderer';
import { CheckersRenderer } from './renderers/CheckersRenderer';
import { CrazyEightsRenderer } from './renderers/CrazyEightsRenderer';
import { DotsAndBoxesRenderer } from './renderers/DotsAndBoxesRenderer';
import { EuchreRenderer } from './renderers/EuchreRenderer';
import { DrawDominoesRenderer } from './renderers/DrawDominoesRenderer';
import { FarkleRenderer } from './renderers/FarkleRenderer';
import { GinRummyRenderer } from './renderers/GinRummyRenderer';
import { GoFishRenderer } from './renderers/GoFishRenderer';
import { GridSalvoRenderer } from './renderers/GridSalvoRenderer';
import { HangmanRenderer } from './renderers/HangmanRenderer';
import { HeartsRenderer } from './renderers/HeartsRenderer';
import { HexRenderer } from './renderers/HexRenderer';
import { LiarsDiceRenderer } from './renderers/LiarsDiceRenderer';
import { MancalaRenderer } from './renderers/MancalaRenderer';
import { MemoryMatchRenderer } from './renderers/MemoryMatchRenderer';
import { MorrisRenderer } from './renderers/MorrisRenderer';
import { NinetyNineRenderer } from './renderers/NinetyNineRenderer';
import { OldMaidRenderer } from './renderers/OldMaidRenderer';
import { OhHellRenderer } from './renderers/OhHellRenderer';
import { PegCodebreakerRenderer } from './renderers/PegCodebreakerRenderer';
import { PigRenderer } from './renderers/PigRenderer';
import { PresidentRenderer } from './renderers/PresidentRenderer';
import { ReversiRenderer } from './renderers/ReversiRenderer';
import { ShutTheBoxRenderer } from './renderers/ShutTheBoxRenderer';
import { SevensRenderer } from './renderers/SevensRenderer';
import { SpadesRenderer } from './renderers/SpadesRenderer';
import { SlapjackRenderer } from './renderers/SlapjackRenderer';
import { SpoonsRenderer } from './renderers/SpoonsRenderer';
import { TriviaRenderer } from './renderers/TriviaRenderer';
import { WhistRenderer } from './renderers/WhistRenderer';
import { YachtRenderer } from './renderers/YachtRenderer';

interface DistinctGameRendererProps {
  gameKey: DistinctGameKey;
  view: DistinctGamePlayerView;
  disabled: boolean;
  onAction: (action: DistinctGameAction) => void;
}

export function DistinctGameRenderer({ gameKey, view, disabled, onAction }: Readonly<DistinctGameRendererProps>) {
  if (EXPANDED_CARD_GAME_KEYS.includes(gameKey as ExpandedCardGameKey)) {
    return <ExpandedCardGameRenderer gameKey={gameKey as ExpandedCardGameKey} view={view} disabled={disabled} onAction={onAction} />;
  }
  switch (gameKey) {
    case 'reversi':
      return <ReversiRenderer view={view as ReversiPlayerView} disabled={disabled} onMove={(cell) => onAction({ cell })} />;
    case 'checkers':
      return <CheckersRenderer view={view as CheckersPlayerView} disabled={disabled} onMove={onAction} />;
    case 'mancala':
      return <MancalaRenderer view={view as MancalaPlayerView} disabled={disabled} onSow={(pit) => onAction({ pit })} />;
    case 'dotsandboxes':
      return <DotsAndBoxesRenderer view={view as DotsAndBoxesPlayerView} disabled={disabled} onDraw={onAction} />;
    case 'pig':
      return <PigRenderer view={view as PigPlayerView} disabled={disabled} onAction={onAction} />;
    case 'grid-salvo':
      return <GridSalvoRenderer view={view as GridSalvoPlayerView} disabled={disabled} onAction={onAction} />;
    case 'peg-codebreaker':
      return <PegCodebreakerRenderer view={view as PegCodePlayerView} disabled={disabled} onAction={onAction} />;
    case 'hangman':
      return <HangmanRenderer view={view as HangmanPlayerView} disabled={disabled} onAction={onAction} />;
    case 'go-fish':
      return <GoFishRenderer view={view as GoFishPlayerView} disabled={disabled} onAction={onAction} />;
    case 'crazy-eights':
      return <CrazyEightsRenderer view={view as CrazyEightsPlayerView} disabled={disabled} onAction={onAction} />;
    case 'five-dice-yacht':
      return <YachtRenderer view={view as YachtPlayerView} disabled={disabled} onAction={onAction} />;
    case 'liars-dice':
      return <LiarsDiceRenderer view={view as LiarsDicePlayerView} disabled={disabled} onAction={onAction} />;
    case 'farkle':
      return <FarkleRenderer view={view as FarklePlayerView} disabled={disabled} onAction={onAction} />;
    case 'shut-the-box':
      return <ShutTheBoxRenderer view={view as ShutTheBoxPlayerView} disabled={disabled} onAction={onAction} />;
    case 'draw-dominoes':
      return <DrawDominoesRenderer view={view as DrawDominoesPlayerView} disabled={disabled} onAction={onAction} />;
    case 'hearts':
      return <HeartsRenderer view={view as HeartsPlayerView} disabled={disabled} onAction={onAction} />;
    case 'spades':
      return <SpadesRenderer view={view as SpadesPlayerView} disabled={disabled} onAction={onAction} />;
    case 'gin-rummy':
      return <GinRummyRenderer view={view as GinRummyPlayerView} disabled={disabled} onAction={onAction} />;
    case 'card-war':
      return <CardWarRenderer view={view as CardWarPlayerView} disabled={disabled} onAction={onAction} />;
    case 'old-maid':
      return <OldMaidRenderer view={view as OldMaidPlayerView} disabled={disabled} onAction={onAction} />;
    case 'hex':
      return <HexRenderer view={view as HexPlayerView} disabled={disabled} onAction={onAction} />;
    case 'nine-mens-morris':
      return <MorrisRenderer view={view as MorrisPlayerView} disabled={disabled} onAction={onAction} />;
    case 'cee-lo':
      return <CeeLoRenderer view={view as CeeLoPlayerView} disabled={disabled} onAction={onAction} />;
    case 'trivia-quiz-bowl':
      return <TriviaRenderer view={view as TriviaPlayerView} disabled={disabled} onAction={onAction} />;
    case 'memory-match':
      return <MemoryMatchRenderer view={view as MemoryMatchPlayerView} disabled={disabled} onAction={onAction} />;
  }
}

const EXPANDED_CARD_GAME_KEYS = [
  'contract-bridge', 'bourre', 'bluff', 'sevens', 'ninety-nine', 'euchre', 'whist', 'oh-hell',
  'president', 'slapjack', 'spoons',
] as const;
type ExpandedCardGameKey = (typeof EXPANDED_CARD_GAME_KEYS)[number];

function ExpandedCardGameRenderer({ gameKey, view, disabled, onAction }: Readonly<{
  gameKey: ExpandedCardGameKey;
  view: DistinctGamePlayerView;
  disabled: boolean;
  onAction: (action: DistinctGameAction) => void;
}>) {
  switch (gameKey) {
    case 'contract-bridge':
      return <BridgeRenderer view={view as BridgePlayerView} disabled={disabled} onAction={onAction} />;
    case 'bourre':
      return <BourreRenderer view={view as BourrePlayerView} disabled={disabled} onAction={onAction} />;
    case 'bluff':
      return <BluffRenderer view={view as BluffPlayerView} disabled={disabled} onAction={onAction} />;
    case 'sevens':
      return <SevensRenderer view={view as SevensPlayerView} disabled={disabled} onAction={onAction} />;
    case 'ninety-nine':
      return <NinetyNineRenderer view={view as NinetyNinePlayerView} disabled={disabled} onAction={onAction} />;
    case 'euchre':
      return <EuchreRenderer view={view as EuchrePlayerView} disabled={disabled} onAction={onAction} />;
    case 'whist':
      return <WhistRenderer view={view as WhistPlayerView} disabled={disabled} onAction={onAction} />;
    case 'oh-hell':
      return <OhHellRenderer view={view as OhHellPlayerView} disabled={disabled} onAction={onAction} />;
    case 'president':
      return <PresidentRenderer view={view as PresidentPlayerView} disabled={disabled} onAction={onAction} />;
    case 'slapjack':
      return <SlapjackRenderer view={view as SlapjackPlayerView} disabled={disabled} onAction={onAction} />;
    case 'spoons':
      return <SpoonsRenderer view={view as SpoonsPlayerView} disabled={disabled} onAction={onAction} />;
  }
}