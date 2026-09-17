export interface FilterOption {
  readonly value: string;
  readonly label: string;
}

export interface FilterSearchConfig {
  readonly param?: string;
  readonly label: string;
  readonly placeholder: string;
  readonly value: string;
  readonly maxLength?: number;
}

export interface FilterSelectConfig {
  readonly param: string;
  readonly label: string;
  readonly options: readonly FilterOption[];
  readonly value: string | null;
  readonly allLabel?: string;
  readonly clears?: readonly string[];
}

export interface FilterDateRangeConfig {
  readonly fromParam?: string;
  readonly toParam?: string;
  readonly label: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly clears?: readonly string[];
}

export interface FilterPeriodConfig {
  readonly param?: string;
  readonly label: string;
  readonly options: readonly FilterOption[];
  readonly value: string;
  readonly defaultValue: string;
  readonly clears?: readonly string[];
}

export type FilterToggleConfig = FilterPeriodConfig;

export type FilterPatch = Readonly<Record<string, string | null>>;
