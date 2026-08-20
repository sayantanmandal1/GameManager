import type {
  BridgeContract,
  BridgeDoubling,
  BridgeStrain,
} from '../../../shared';

export interface BridgeScoreBreakdown {
  made: boolean;
  requiredTricks: number;
  contractPoints: number;
  overtrickPoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  declarerScore: number;
  defenderScore: number;
}

type ScoreContract = Pick<BridgeContract, 'level' | 'strain' | 'doubling'>;

export function scoreDuplicateDeal(
  contract: ScoreContract,
  tricksTaken: number,
  vulnerable: boolean,
): BridgeScoreBreakdown {
  const requiredTricks = contract.level + 6;
  if (tricksTaken < requiredTricks) {
    const penaltyPoints = undertrickPenalty(
      requiredTricks - tricksTaken,
      vulnerable,
      contract.doubling,
    );
    return {
      made: false,
      requiredTricks,
      contractPoints: 0,
      overtrickPoints: 0,
      bonusPoints: 0,
      penaltyPoints,
      declarerScore: -penaltyPoints,
      defenderScore: penaltyPoints,
    };
  }

  const contractPoints = bridgeContractPoints(contract);
  const overtrickPoints = bridgeOvertrickPoints(
    tricksTaken - requiredTricks,
    contract.strain,
    contract.doubling,
    vulnerable,
  );
  const gameOrPartScore = contractPoints >= 100 ? (vulnerable ? 500 : 300) : 50;
  const slamBonus = contract.level === 6
    ? (vulnerable ? 750 : 500)
    : contract.level === 7
      ? (vulnerable ? 1500 : 1000)
      : 0;
  const insultBonus = contract.doubling === 'doubled'
    ? 50
    : contract.doubling === 'redoubled'
      ? 100
      : 0;
  const bonusPoints = gameOrPartScore + slamBonus + insultBonus;
  const declarerScore = contractPoints + overtrickPoints + bonusPoints;
  return {
    made: true,
    requiredTricks,
    contractPoints,
    overtrickPoints,
    bonusPoints,
    penaltyPoints: 0,
    declarerScore,
    defenderScore: -declarerScore,
  };
}

export function scoreRubberDeal(
  contract: ScoreContract,
  tricksTaken: number,
  vulnerable: boolean,
): BridgeScoreBreakdown {
  const duplicate = scoreDuplicateDeal(contract, tricksTaken, vulnerable);
  if (!duplicate.made) {
    return {
      ...duplicate,
      declarerScore: 0,
      defenderScore: duplicate.penaltyPoints,
    };
  }
  const gameOrPartScore = duplicate.contractPoints >= 100 ? (vulnerable ? 500 : 300) : 50;
  const bonusPoints = duplicate.bonusPoints - gameOrPartScore;
  return {
    ...duplicate,
    bonusPoints,
    declarerScore: duplicate.contractPoints + duplicate.overtrickPoints + bonusPoints,
    defenderScore: 0,
  };
}

export function scoreHomeDeal(
  contract: ScoreContract,
  tricksTaken: number,
): BridgeScoreBreakdown {
  const requiredTricks = contract.level + 6;
  if (tricksTaken < requiredTricks) {
    const penaltyRate = contract.doubling === 'redoubled'
      ? 200
      : contract.doubling === 'doubled'
        ? 100
        : 50;
    const penaltyPoints = (requiredTricks - tricksTaken) * penaltyRate;
    return {
      made: false,
      requiredTricks,
      contractPoints: 0,
      overtrickPoints: 0,
      bonusPoints: 0,
      penaltyPoints,
      declarerScore: -penaltyPoints,
      defenderScore: 0,
    };
  }

  let contractPoints = 50;
  if (tricksTaken >= 10) contractPoints = contract.level >= 4 ? 250 : 100;
  const bonusPoints = (tricksTaken >= 12 ? 50 : 0) + (tricksTaken === 13 ? 100 : 0);
  return {
    made: true,
    requiredTricks,
    contractPoints,
    overtrickPoints: 0,
    bonusPoints,
    penaltyPoints: 0,
    declarerScore: contractPoints + bonusPoints,
    defenderScore: 0,
  };
}

export function bridgeContractPoints(contract: ScoreContract): number {
  const undoubled = contract.strain === 'notrump'
    ? 40 + Math.max(0, contract.level - 1) * 30
    : contract.level * trickValue(contract.strain);
  return undoubled * doublingMultiplier(contract.doubling);
}

function bridgeOvertrickPoints(
  overtricks: number,
  strain: BridgeStrain,
  doubling: BridgeDoubling,
  vulnerable: boolean,
): number {
  if (overtricks <= 0) return 0;
  if (doubling === 'doubled') return overtricks * (vulnerable ? 200 : 100);
  if (doubling === 'redoubled') return overtricks * (vulnerable ? 400 : 200);
  return overtricks * (strain === 'notrump' ? 30 : trickValue(strain));
}

function undertrickPenalty(
  undertricks: number,
  vulnerable: boolean,
  doubling: BridgeDoubling,
): number {
  if (doubling === 'undoubled') return undertricks * (vulnerable ? 100 : 50);
  let doubledPenalty: number;
  if (vulnerable) {
    doubledPenalty = 200 + Math.max(0, undertricks - 1) * 300;
  } else if (undertricks === 1) {
    doubledPenalty = 100;
  } else if (undertricks <= 3) {
    doubledPenalty = 100 + (undertricks - 1) * 200;
  } else {
    doubledPenalty = 500 + (undertricks - 3) * 300;
  }
  return doubledPenalty * (doubling === 'redoubled' ? 2 : 1);
}

function trickValue(strain: BridgeStrain): number {
  return strain === 'clubs' || strain === 'diamonds' ? 20 : 30;
}

function doublingMultiplier(doubling: BridgeDoubling): number {
  if (doubling === 'doubled') return 2;
  if (doubling === 'redoubled') return 4;
  return 1;
}