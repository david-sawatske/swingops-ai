export type AdminOpsNormalizationField =
  | "shaftFlex"
  | "category"
  | "conditionGrade"
  | "tradeInValue";

export type AdminOpsNormalizationAction =
  | "NORMALIZE"
  | "BLOCK_REPAIR"
  | "ROUTE_TO_REVIEW";

export type AdminOpsNormalizationMatrixEntry = {
  id: string;
  field: AdminOpsNormalizationField;
  aliases: string[];
  canonicalValue: string | number | null;
  action: AdminOpsNormalizationAction;
  requiresContext: boolean;
  notes: string;
};

export type GetAdminOpsNormalizationMatrixResponse = {
  entries: AdminOpsNormalizationMatrixEntry[];
};
