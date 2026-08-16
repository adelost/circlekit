/** Compile-bound Kotlin symbols supplied by the consuming skydiving product. */
export interface HomeActionsNativeSymbols {
  readonly homeActionId: string;
}

export interface InteractionNativeSymbols {
  readonly continuousInteractionContract: string;
  readonly discreteInteractionContract: string;
  readonly host: string;
  readonly interactionCatalog: string;
  readonly interactionControlId: string;
  readonly interactionMount: string;
  readonly interactionMountId: string;
  readonly interactionPolicyHandle: string;
  readonly interactionSource: string;
  readonly settingId: string;
}

export interface IsoOptionsNativeSymbols {
  readonly menuAccentToken: string;
  readonly menuIconToken: string;
}

export interface SettingsDescriptorNativeSymbols {
  readonly booleanSettingDescriptor: string;
  readonly choice: string;
  readonly choiceAccessibility: string;
  readonly changedEffectRef: string;
  readonly controlId: string;
  readonly enumSettingDescriptor: string;
  readonly host: string;
  readonly intentId: string;
  readonly selectorId: string;
  readonly semanticIconId: string;
  readonly settingDescriptor: string;
  readonly settingId: string;
  readonly settingStore: string;
  readonly source: string;
  readonly toggleAccessibility: string;
  readonly valueId: string;
}

export interface ProductIconsNativeSymbols {
  readonly menuAccentToken: string;
}

export interface ProductMenusNativeSymbols {
  readonly menuAccentToken: string;
  readonly menuActionKey: string;
  readonly menuIconToken: string;
  readonly settingId: string;
  readonly valueId: string;
  readonly clockFaceCue: string;
  readonly alarmStage: string;
}

export interface SettingsComponentsNativeSymbols {
  readonly booleanSettingDescriptor: string;
  readonly settingDescriptor: string;
  readonly settingsSection: string;
  readonly settingId: string;
  readonly settingRow: string;
  readonly settingsState: string;
  readonly settingWrite: string;
  readonly isoToggleOption: string;
  readonly isoChoiceOption: string;
}

export interface StatusIndicatorsNativeSymbols {
  readonly statusIndicatorId: string;
}

export interface SurfaceComponentsNativeSymbols {
  readonly ringSurface: string;
  readonly spatialMode: string;
}

/** One product-owned table can feed every skydiving emitter without defaults. */
export interface SkydivingNativeSymbols {
  readonly homeActions: HomeActionsNativeSymbols;
  readonly interactions: InteractionNativeSymbols;
  readonly isoOptions: IsoOptionsNativeSymbols;
  readonly settings: SettingsDescriptorNativeSymbols;
  readonly productIcons: ProductIconsNativeSymbols;
  readonly productMenus: ProductMenusNativeSymbols;
  readonly settingsComponents: SettingsComponentsNativeSymbols;
  readonly statusIndicators: StatusIndicatorsNativeSymbols;
  readonly surfaceComponents: SurfaceComponentsNativeSymbols;
}
