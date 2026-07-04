export type ParserFieldEvidence = {
  value: string | number;
  sourceText: string;
};

export type ParserEvidence = {
  brand?: ParserFieldEvidence;
  productLine?: ParserFieldEvidence;
  category?: ParserFieldEvidence;
  shaftFlex?: ParserFieldEvidence;
  conditionGrade?: ParserFieldEvidence;
  tradeInValue?: ParserFieldEvidence;
};
