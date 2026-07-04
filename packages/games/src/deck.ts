// Ported from .claude/skills/game-logic-engineer/references/deck.ts
// verbatim — 52-card deck (4 suits x 13 ranks), rank-value + id<->card
// helpers shared by HiLo and Blackjack (both draw independently, with
// replacement, from this deck: Math.floor(float * 52) -> deck[index]).

export enum CardSuit {
  Diamonds = '♦',
  Heart = '♥',
  Spades = '♠',
  Clubs = '♣',
}

export const cardSuits = [
  CardSuit.Diamonds,
  CardSuit.Heart,
  CardSuit.Spades,
  CardSuit.Clubs,
] as const;

export const cardRanks = ['A', 2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K'] as const;
export type CardRank = (typeof cardRanks)[number];
export type CardRankValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export const deck = cardSuits
  .map((suit) => cardRanks.map((rank) => `${suit}${rank}` as const))
  .flat();
export type Card = (typeof deck)[number];

export const getCardSuit = (card: Card): CardSuit => {
  for (const suit of cardSuits) {
    if (card.startsWith(suit.toString())) return suit as CardSuit;
  }
  throw new Error(`Couldn't get CardSuit of the Card(${card})!`);
};

export const getCardRank = (card: Card): CardRank => {
  for (const rank of cardRanks) {
    if (card.endsWith(rank.toString())) return rank;
  }
  throw new Error(`Couldn't get CardRank of the Card(${card})!`);
};

export const getCardRankValue = (card: Card): CardRankValue => {
  const rank = getCardRank(card);
  const value = (cardRanks.indexOf(rank) + 1) as CardRankValue;

  if (value < 1 || value > 13 || !Number.isInteger(value)) {
    throw new Error(`Couldn't get Card(${card}) rank value!`);
  }

  return value;
};

export const cardToCardId = (card: Card): number => {
  const index = deck.indexOf(card);

  if (index < 0 || index >= 52) {
    throw new Error(`Card(${card}) seems to be invalid!`);
  }

  return index as number;
};

export const cardIdToCard = (cardId: number): Card => {
  const card = deck[cardId];

  if (!card) throw new Error(`CardId(${cardId}) seems to be invalid!`);

  return card;
};

export const isCard = (cardString: string): cardString is Card =>
  deck.indexOf(cardString as Card) !== -1;
