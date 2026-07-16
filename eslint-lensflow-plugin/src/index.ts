import consistentConstructorStrategy from "./rules/consistent-constructor-strategy.js";
import noAbstractClassOverkillUc14 from "./rules/no-abstract-class-overkill-uc14.js";
import noAbstractClassWithoutConcreteMethods from "./rules/no-abstract-class-without-concrete-methods.js";
import noAnyArrayForChildren from "./rules/no-any-array-for-children.js";
import noAnyArrayParameter from "./rules/no-any-array-parameter.js";
import noAnyArrayReturn from "./rules/no-any-array-return.js";
import noAnyBoundary from "./rules/no-any-boundary.js";
import noAnyCallbackType from "./rules/no-any-callback-type.js";
import noAnyCastChain from "./rules/no-any-cast-chain.js";
import noAnyDomainParameterUc02 from "./rules/no-any-domain-parameter-uc02.js";
import noAnyInCallable from "./rules/no-any-in-callable.js";
import noAnyInDiscriminantCheckUc03 from "./rules/no-any-in-discriminant-check-uc03.js";
import noAnyInInterface from "./rules/no-any-in-interface.js";
import noAnyInRecursiveUnionVariant from "./rules/no-any-in-recursive-union-variant.js";
import noAnyInUtilityFunction from "./rules/no-any-in-utility-function.js";
import noAnyIndexSignature from "./rules/no-any-index-signature.js";
import noAnyJsonParseReturn from "./rules/no-any-json-parse-return.js";
import noAnyNullableReturn from "./rules/no-any-nullable-return.js";
import noAnyParameter from "./rules/no-any-parameter.js";
import noAnyParameterTypeGuard from "./rules/no-any-parameter-type-guard.js";
import noAnyParameterWithTypeguard from "./rules/no-any-parameter-with-typeguard.js";
import noAnyTerminatingRecursion from "./rules/no-any-terminating-recursion.js";
import noAnyTypeGuardParameter from "./rules/no-any-type-guard-parameter.js";
import noAsAnyBypass from "./rules/no-as-any-bypass.js";
import noAsAnyBypassExhaustiveness from "./rules/no-as-any-bypass-exhaustiveness.js";
import noAsAnyCapabilityCheckT59 from "./rules/no-as-any-capability-check-t59.js";
import noAsAnyInNarrowedBranch from "./rules/no-as-any-in-narrowed-branch.js";
import noAsAnyUnionHandlingUc14 from "./rules/no-as-any-union-handling-uc14.js";
import noAsConstOnDynamicValues from "./rules/no-as-const-on-dynamic-values.js";
import noAsConstOnLet from "./rules/no-as-const-on-let.js";
import noAsInsteadOfNarrowing from "./rules/no-as-instead-of-narrowing.js";
import noAssertionBypass from "./rules/no-assertion-bypass.js";
import noAssertneverCastUnknown from "./rules/no-assertnever-cast-unknown.js";
import noBivariantMethodSyntax from "./rules/no-bivariant-method-syntax.js";
import noBlindAsAnyCast from "./rules/no-blind-as-any-cast.js";
import noBlindAsCast from "./rules/no-blind-as-cast.js";
import noBooleanParseReturn from "./rules/no-boolean-parse-return.js";
import noBrandedNumberArithmeticLeak from "./rules/no-branded-number-arithmetic-leak.js";
import noBroadIndexSignatures from "./rules/no-broad-index-signatures.js";
import noBroadOverloadBeforeNarrow from "./rules/no-broad-overload-before-narrow.js";
import noCallSignatureLeakedInternals from "./rules/no-call-signature-leaked-internals.js";
import noCallbackPyramid from "./rules/no-callback-pyramid.js";
import noCapturedGenericCallbackT59 from "./rules/no-captured-generic-callback-t59.js";
import noCastToConcreteImplT59 from "./rules/no-cast-to-concrete-impl-t59.js";
import noCastToShapeThenAccess from "./rules/no-cast-to-shape-then-access.js";
import noChainForIndependentComputations from "./rules/no-chain-for-independent-computations.js";
import noChainedNonNullAssertion from "./rules/no-chained-non-null-assertion.js";
import noCollectThenSyncIterate from "./rules/no-collect-then-sync-iterate.js";
import noCollectThenTransform from "./rules/no-collect-then-transform.js";
import noComposedUnionAliases from "./rules/no-composed-union-aliases.js";
import noConcreteTypeBound from "./rules/no-concrete-type-bound.js";
import noConflictingIntersectionProperties from "./rules/no-conflicting-intersection-properties.js";
import noCovariantContainerMutationUc17 from "./rules/no-covariant-container-mutation-uc17.js";
import noDecoratorModifiesInferredType from "./rules/no-decorator-modifies-inferred-type.js";
import noDeepInheritanceChain from "./rules/no-deep-inheritance-chain.js";
import noDeepOptionalChainFallback from "./rules/no-deep-optional-chain-fallback.js";
import noDeeplyNestedAsConst from "./rules/no-deeply-nested-as-const.js";
import noDeeplyNestedConditionalTypes from "./rules/no-deeply-nested-conditional-types.js";
import noDeeplyNestedUnionMembers from "./rules/no-deeply-nested-union-members.js";
import noDirectBrandCast from "./rules/no-direct-brand-cast.js";
import noDirectCircularAlias from "./rules/no-direct-circular-alias.js";
import noDoubleAssertion from "./rules/no-double-assertion.js";
import noDuplicateDiscriminantValues from "./rules/no-duplicate-discriminant-values.js";
import noDuplicateInlineStructuralTypes from "./rules/no-duplicate-inline-structural-types.js";
import noDuplicatedConstraintLiteral from "./rules/no-duplicated-constraint-literal.js";
import noDuplicatedUnionProperties from "./rules/no-duplicated-union-properties.js";
import noEatenCallbackError from "./rules/no-eaten-callback-error.js";
import noEffectBoundaryAssertion from "./rules/no-effect-boundary-assertion.js";
import noEmptyArrayNeverInference from "./rules/no-empty-array-never-inference.js";
import noEmptyObjectPhantomType from "./rules/no-empty-object-phantom-type.js";
import noExcessiveIntersectionChain from "./rules/no-excessive-intersection-chain.js";
import noExcessiveTypestateMarkers from "./rules/no-excessive-typestate-markers.js";
import noExcessiveUnionMembers from "./rules/no-excessive-union-members.js";
import noExcessivelyNestedConditionalTypes from "./rules/no-excessively-nested-conditional-types.js";
import noExhaustivenessOnOpenUnion from "./rules/no-exhaustiveness-on-open-union.js";
import noExportedBrandSymbol from "./rules/no-exported-brand-symbol.js";
import noExposedGlobalRegistry from "./rules/no-exposed-global-registry.js";
import noFunctionType from "./rules/no-function-type.js";
import noGetterReturnsMutableInternal from "./rules/no-getter-returns-mutable-internal.js";
import noGetterReturnsPrivateField from "./rules/no-getter-returns-private-field.js";
import noGiantOptionalInterfaceT59 from "./rules/no-giant-optional-interface-t59.js";
import noGlobalModuleMergingUc14 from "./rules/no-global-module-merging-uc14.js";
import noGodInterface from "./rules/no-god-interface.js";
import noHardcodedNewCastThis from "./rules/no-hardcoded-new-cast-this.js";
import noIfElseStateCascade from "./rules/no-if-else-state-cascade.js";
import noIgnoredParseErrors from "./rules/no-ignored-parse-errors.js";
import noImplicitAnyAsyncChain from "./rules/no-implicit-any-async-chain.js";
import noIncompatibleGenericIntersection from "./rules/no-incompatible-generic-intersection.js";
import noInfallibleSyncResult from "./rules/no-infallible-sync-result.js";
import noInferFromUnconstrainedType from "./rules/no-infer-from-unconstrained-type.js";
import noInstanceofOnInterfaceT59 from "./rules/no-instanceof-on-interface-t59.js";
import noInterfaceImplementationLeak from "./rules/no-interface-implementation-leak.js";
import noIntersectedFunctionTypes from "./rules/no-intersected-function-types.js";
import noIntrinsicTransformOnWideString from "./rules/no-intrinsic-transform-on-wide-string.js";
import noJsdocConstraintSpec from "./rules/no-jsdoc-constraint-spec.js";
import noKeyofAny from "./rules/no-keyof-any.js";
import noKitchenSinkVariant from "./rules/no-kitchen-sink-variant.js";
import noLargeLiteralUnion from "./rules/no-large-literal-union.js";
import noLazyAny from "./rules/no-lazy-any.js";
import noLeakyFactoryReturnT59 from "./rules/no-leaky-factory-return-t59.js";
import noLiteralWideningOnConstruct from "./rules/no-literal-widening-on-construct.js";
import noMagicStringStateComparison from "./rules/no-magic-string-state-comparison.js";
import noMagicStringStateUc02 from "./rules/no-magic-string-state-uc02.js";
import noMagicStringSwitch from "./rules/no-magic-string-switch.js";
import noManualTypeGuards from "./rules/no-manual-type-guards.js";
import noManyFunctionParameters from "./rules/no-many-function-parameters.js";
import noMismatchedVarianceMarker from "./rules/no-mismatched-variance-marker.js";
import noMissingAsConst from "./rules/no-missing-as-const.js";
import noMixedDecoratorApis from "./rules/no-mixed-decorator-apis.js";
import noMixedInstanceofDiscriminant from "./rules/no-mixed-instanceof-discriminant.js";
import noMixedNullUndefined from "./rules/no-mixed-null-undefined.js";
import noModuleLevelMutableExport from "./rules/no-module-level-mutable-export.js";
import noMonolithicInterfaceT59 from "./rules/no-monolithic-interface-t59.js";
import noMutableArrayInReadonlyContext from "./rules/no-mutable-array-in-readonly-context.js";
import noMutableArrayParameter from "./rules/no-mutable-array-parameter.js";
import noMutableArrayParameterUc17 from "./rules/no-mutable-array-parameter-uc17.js";
import noMutableGetterReturn from "./rules/no-mutable-getter-return.js";
import noMutableItemsInReadonlyCollection from "./rules/no-mutable-items-in-readonly-collection.js";
import noMutableStateRuntimeGuards from "./rules/no-mutable-state-runtime-guards.js";
import noMutateIterationCallbackArgument from "./rules/no-mutate-iteration-callback-argument.js";
import noMutateNullableWithoutCheck from "./rules/no-mutate-nullable-without-check.js";
import noNarrowImplementationSignature from "./rules/no-narrow-implementation-signature.js";
import noNarrowingLostInCallback from "./rules/no-narrowing-lost-in-callback.js";
import noNestedAssertNeverUc03 from "./rules/no-nested-assert-never-uc03.js";
import noNestedDiscriminatedUnions from "./rules/no-nested-discriminated-unions.js";
import noNestedEffectTypes from "./rules/no-nested-effect-types.js";
import noNestedGenericsWithoutExtractionUc14 from "./rules/no-nested-generics-without-extraction-uc14.js";
import noNestedInfer from "./rules/no-nested-infer.js";
import noNeverAsCatchall from "./rules/no-never-as-catchall.js";
import noNeverReachableEndpoint from "./rules/no-never-reachable-endpoint.js";
import noNonDiscriminativeTypeGuard from "./rules/no-non-discriminative-type-guard.js";
import noNonLiteralDiscriminant from "./rules/no-non-literal-discriminant.js";
import noNoopBrandConstructor from "./rules/no-noop-brand-constructor.js";
import noObjectFreezeWithoutReadonlyAnnotation from "./rules/no-object-freeze-without-readonly-annotation.js";
import noOptionalChainWithoutHandling from "./rules/no-optional-chain-without-handling.js";
import noOrOrForDefaultValues from "./rules/no-or-or-for-default-values.js";
import noOrphanedAbortController from "./rules/no-orphaned-abort-controller.js";
import noOverBrandingUc02 from "./rules/no-over-branding-uc02.js";
import noOverGenericInterface from "./rules/no-over-generic-interface.js";
import noOverIntersection from "./rules/no-over-intersection.js";
import noOverengineeredIntersectionConstraint from "./rules/no-overengineered-intersection-constraint.js";
import noOverloadExplosion from "./rules/no-overload-explosion.js";
import noOverlyBroadGenericConstraints from "./rules/no-overly-broad-generic-constraints.js";
import noOverlyComplexBound from "./rules/no-overly-complex-bound.js";
import noOverlyComplexInferChainT63 from "./rules/no-overly-complex-infer-chain-t63.js";
import noOverrideThisWithBaseType from "./rules/no-override-this-with-base-type.js";
import noParallelBooleanStateFlags from "./rules/no-parallel-boolean-state-flags.js";
import noParallelCaseTransformedEnums from "./rules/no-parallel-case-transformed-enums.js";
import noParallelOptionalFieldsUc01 from "./rules/no-parallel-optional-fields-uc01.js";
import noPartialConstructionPattern from "./rules/no-partial-construction-pattern.js";
import noPartialRecord from "./rules/no-partial-record.js";
import noPartialValidation from "./rules/no-partial-validation.js";
import noPhantomTypesForSimpleState from "./rules/no-phantom-types-for-simple-state.js";
import noPlainStringIds from "./rules/no-plain-string-ids.js";
import noPrematureMonadExtraction from "./rules/no-premature-monad-extraction.js";
import noPrimitiveTypeAlias from "./rules/no-primitive-type-alias.js";
import noPrivateConstructorUnvalidatedFactory from "./rules/no-private-constructor-unvalidated-factory.js";
import noProtectedMutablePrimitiveState from "./rules/no-protected-mutable-primitive-state.js";
import noPublicAlgorithmInternal from "./rules/no-public-algorithm-internal.js";
import noPublicMutableStateObject from "./rules/no-public-mutable-state-object.js";
import noReadonlyOnMutatedClassField from "./rules/no-readonly-on-mutated-class-field.js";
import noReadonlyOnPrimitives from "./rules/no-readonly-on-primitives.js";
import noRecordStringAny from "./rules/no-record-string-any.js";
import noRecursiveTypeWithoutBaseCase from "./rules/no-recursive-type-without-base-case.js";
import noRedundantInferConditional from "./rules/no-redundant-infer-conditional.js";
import noRedundantNarrowing from "./rules/no-redundant-narrowing.js";
import noRedundantNullReturnType from "./rules/no-redundant-null-return-type.js";
import noRedundantNullableInputGuard from "./rules/no-redundant-nullable-input-guard.js";
import noRedundantOverloadSignature from "./rules/no-redundant-overload-signature.js";
import noRepeatedRuntimeGuards from "./rules/no-repeated-runtime-guards.js";
import noRestAnyImplementation from "./rules/no-rest-any-implementation.js";
import noReuseGenerator from "./rules/no-reuse-generator.js";
import noRevalidateBrandedParam from "./rules/no-revalidate-branded-param.js";
import noRuntimeFilterAsT from "./rules/no-runtime-filter-as-t.js";
import noRuntimeGenericAssumption from "./rules/no-runtime-generic-assumption.js";
import noRuntimeInitGuard from "./rules/no-runtime-init-guard.js";
import noRuntimeStateTransitionGuard from "./rules/no-runtime-state-transition-guard.js";
import noRuntimeStringConcatForTypedKeys from "./rules/no-runtime-string-concat-for-typed-keys.js";
import noScatteredBrandCast from "./rules/no-scattered-brand-cast.js";
import noSealedInterfaceWithoutEvolutionPath from "./rules/no-sealed-interface-without-evolution-path.js";
import noSelfReferentialConditionalType from "./rules/no-self-referential-conditional-type.js";
import noSelfReferentialGenericBound from "./rules/no-self-referential-generic-bound.js";
import noSequentialDepthTypes from "./rules/no-sequential-depth-types.js";
import noShadowedTypeParameter from "./rules/no-shadowed-type-parameter.js";
import noShallowReadonlyArray from "./rules/no-shallow-readonly-array.js";
import noShallowReadonlyMutableCollection from "./rules/no-shallow-readonly-mutable-collection.js";
import noSilentEffectAbsorption from "./rules/no-silent-effect-absorption.js";
import noSilentErrorCatch from "./rules/no-silent-error-catch.js";
import noSilentDefault from "./rules/no-silent-default.js";
import noSilentNeverInferFallback from "./rules/no-silent-never-infer-fallback.js";
import noSpreadReadonlyWorkaround from "./rules/no-spread-readonly-workaround.js";
import noStaticAsyncGenerator from "./rules/no-static-async-generator.js";
import noStaticOnlyUtilityClass from "./rules/no-static-only-utility-class.js";
import noStringDiscriminantInsteadOfUnion from "./rules/no-string-discriminant-instead-of-union.js";
import noStringMatchErrorHandling from "./rules/no-string-match-error-handling.js";
import noStringParamWithLiteralComparison from "./rules/no-string-param-with-literal-comparison.js";
import noStringStatusProperty from "./rules/no-string-status-property.js";
import noStructuralTypeAsRuntimeGuard from "./rules/no-structural-type-as-runtime-guard.js";
import noSubsumedOverload from "./rules/no-subsumed-overload.js";
import noSwallowedErrorResult from "./rules/no-swallowed-error-result.js";
import noTemplateLiteralNumberCatchall from "./rules/no-template-literal-number-catchall.js";
import noTemplateLiteralTypeExplosion from "./rules/no-template-literal-type-explosion.js";
import noThisInStaticMember from "./rules/no-this-in-static-member.js";
import noThisMethodReferenceAssignment from "./rules/no-this-method-reference-assignment.js";
import noThrowInResultFunction from "./rules/no-throw-in-result-function.js";
import noTruthinessNullNarrowing from "./rules/no-truthiness-null-narrowing.js";
import noTsIgnore from "./rules/no-ts-ignore.js";
import noTypeAssertionAfterParse from "./rules/no-type-assertion-after-parse.js";
import noTypeofInTypeAlias from "./rules/no-typeof-in-type-alias.js";
import noTypeofLooseEquality from "./rules/no-typeof-loose-equality.js";
import noTypeofMutable from "./rules/no-typeof-mutable.js";
import noTypestateAnyBypass from "./rules/no-typestate-any-bypass.js";
import noUnboundedPluginRegistration from "./rules/no-unbounded-plugin-registration.js";
import noUndiscriminatedErrorType from "./rules/no-undiscriminated-error-type.js";
import noUnionWithoutCommonShape from "./rules/no-union-without-common-shape.js";
import noUnknownTypePredicate from "./rules/no-unknown-type-predicate.js";
import noUnnecessaryInvariance from "./rules/no-unnecessary-invariance.js";
import noUnnecessaryTemplateLiteralType from "./rules/no-unnecessary-template-literal-type.js";
import noUnnecessaryVariadicGeneric from "./rules/no-unnecessary-variadic-generic.js";
import noUnsafeJsonParseBrandCast from "./rules/no-unsafe-json-parse-brand-cast.js";
import noUnsafeJsonStringify from "./rules/no-unsafe-json-stringify.js";
import noUnsafeNonNullAssertion from "./rules/no-unsafe-non-null-assertion.js";
import noUnsafeTaskEitherErrorMap from "./rules/no-unsafe-task-either-error-map.js";
import noUnsafeUnknownAssertion from "./rules/no-unsafe-unknown-assertion.js";
import noUnusedConstraintMembers from "./rules/no-unused-constraint-members.js";
import noValidationInBusinessLogicUc02 from "./rules/no-validation-in-business-logic-uc02.js";
import noValueWrapperNominal from "./rules/no-value-wrapper-nominal.js";
import preferAsConst from "./rules/prefer-as-const.js";
import preferBrandedOverRepeatedGuard from "./rules/prefer-branded-over-repeated-guard.js";
import preferConstForLiteralBinding from "./rules/prefer-const-for-literal-binding.js";
import preferConstraintOverRuntimeGuard from "./rules/prefer-constraint-over-runtime-guard.js";
import preferContravarianceOverUnionUc17 from "./rules/prefer-contravariance-over-union-uc17.js";
import preferDiscriminatedUnionUc02 from "./rules/prefer-discriminated-union-uc02.js";
import preferExplicitInterfaceAnnotationT59 from "./rules/prefer-explicit-interface-annotation-t59.js";
import preferFunctionPropertyOverMethod from "./rules/prefer-function-property-over-method.js";
import preferInstanceofOverConstructorName from "./rules/prefer-instanceof-over-constructor-name.js";
import preferInterfaceOverInlineGeneric from "./rules/prefer-interface-over-inline-generic.js";
import preferInterfaceOverPureAbstractClass from "./rules/prefer-interface-over-pure-abstract-class.js";
import preferParseOverBooleanValidate from "./rules/prefer-parse-over-boolean-validate.js";
import preferPrimitiveMethodParams from "./rules/prefer-primitive-method-params.js";
import preferPropertyFunctionSignature from "./rules/prefer-property-function-signature.js";
import preferRecordOverIndexSignature from "./rules/prefer-record-over-index-signature.js";
import preferRecordOverLiteralObjectUnion from "./rules/prefer-record-over-literal-object-union.js";
import preferSatisfiesConfigValidation from "./rules/prefer-satisfies-config-validation.js";
import preferSatisfiesOverAnnotation from "./rules/prefer-satisfies-over-annotation.js";
import preferSwitchExhaustiveOverFallbackUc03 from "./rules/prefer-switch-exhaustive-over-fallback-uc03.js";
import preferThisInterfaceReturn from "./rules/prefer-this-interface-return.js";
import preferThisOverSelfBoundedGeneric from "./rules/prefer-this-over-self-bounded-generic.js";
import preferThisReturnFluentMethod from "./rules/prefer-this-return-fluent-method.js";
import preferUniqueSymbolBrand from "./rules/prefer-unique-symbol-brand.js";
import preferUnknownOverAny from "./rules/prefer-unknown-over-any.js";
import preferYieldStarForIterables from "./rules/prefer-yield-star-for-iterables.js";
import preferZInfer from "./rules/prefer-z-infer.js";
import requireAssertNeverDefaultUc03 from "./rules/require-assert-never-default-uc03.js";
import requireAssertionThrow from "./rules/require-assertion-throw.js";
import requireAssertneverNeverParameter from "./rules/require-assertnever-never-parameter.js";
import requireAssertneverNeverReturn from "./rules/require-assertnever-never-return.js";
import requireAwaitTryCatchInGenerator from "./rules/require-await-try-catch-in-generator.js";
import requireDeclareBrandSymbol from "./rules/require-declare-brand-symbol.js";
import requireDecoratorAccessorKeyword from "./rules/require-decorator-accessor-keyword.js";
import requireExhaustiveIfChainUc03 from "./rules/require-exhaustive-if-chain-uc03.js";
import requireExhaustiveNeverCheck from "./rules/require-exhaustive-never-check.js";
import requireExhaustiveSwitch from "./rules/require-exhaustive-switch.js";
import requireExplicitGenericInPromiseChain from "./rules/require-explicit-generic-in-promise-chain.js";
import requireExplicitVariance from "./rules/require-explicit-variance.js";
import requireGenericCouplingForSharedUnion from "./rules/require-generic-coupling-for-shared-union.js";
import requireLiteralStateType from "./rules/require-literal-state-type.js";
import requireLiteralSwitchDefault from "./rules/require-literal-switch-default.js";
import requireReadonlyDomainPropsUc02 from "./rules/require-readonly-domain-props-uc02.js";
import requireReadonlyOnArrayType from "./rules/require-readonly-on-array-type.js";
import requireSmartConstructorValidation from "./rules/require-smart-constructor-validation.js";
import requireTypePredicateSubtype from "./rules/require-type-predicate-subtype.js";
import requireTypestateRebinding from "./rules/require-typestate-rebinding.js";
import requireUndefinedHandlingAfterOptionalChain from "./rules/require-undefined-handling-after-optional-chain.js";
import requireUnionDiscriminant from "./rules/require-union-discriminant.js";
import requireUnknownAfterJsonParse from "./rules/require-unknown-after-json-parse.js";
import requireValidationAfterJsonParse from "./rules/require-validation-after-json-parse.js";
import type { TSESLint } from "@typescript-eslint/utils";
const plugin: {
  rules: Record<string, TSESLint.RuleModule<string, readonly unknown[]>>;
  configs: Record<string, unknown>;
} = {
  rules: {
    "consistent-constructor-strategy": consistentConstructorStrategy,
    "no-abstract-class-overkill-uc14": noAbstractClassOverkillUc14,
    "no-abstract-class-without-concrete-methods": noAbstractClassWithoutConcreteMethods,
    "no-any-array-for-children": noAnyArrayForChildren,
    "no-any-array-parameter": noAnyArrayParameter,
    "no-any-array-return": noAnyArrayReturn,
    "no-any-boundary": noAnyBoundary,
     "no-any-callback-type": noAnyCallbackType,
    "no-any-cast-chain": noAnyCastChain,
    "no-any-domain-parameter-uc02": noAnyDomainParameterUc02,
     "no-any-in-callable": noAnyInCallable,
    "no-any-in-discriminant-check-uc03": noAnyInDiscriminantCheckUc03,
    "no-any-in-interface": noAnyInInterface,
     "no-any-in-recursive-union-variant": noAnyInRecursiveUnionVariant,
    "no-any-in-utility-function": noAnyInUtilityFunction,
    "no-any-index-signature": noAnyIndexSignature,
    "no-any-json-parse-return": noAnyJsonParseReturn,
    "no-any-nullable-return": noAnyNullableReturn,
    "no-any-parameter": noAnyParameter,
    "no-any-parameter-type-guard": noAnyParameterTypeGuard,
    "no-any-parameter-with-typeguard": noAnyParameterWithTypeguard,
    "no-any-terminating-recursion": noAnyTerminatingRecursion,
    "no-any-type-guard-parameter": noAnyTypeGuardParameter,
    "no-as-any-bypass": noAsAnyBypass,
    "no-as-any-bypass-exhaustiveness": noAsAnyBypassExhaustiveness,
    "no-as-any-capability-check-t59": noAsAnyCapabilityCheckT59,
    "no-as-any-in-narrowed-branch": noAsAnyInNarrowedBranch,
    "no-as-any-union-handling-uc14": noAsAnyUnionHandlingUc14,
    "no-as-const-on-dynamic-values": noAsConstOnDynamicValues,
    "no-as-const-on-let": noAsConstOnLet,
    "no-as-instead-of-narrowing": noAsInsteadOfNarrowing,
    "no-assertion-bypass": noAssertionBypass,
    "no-assertnever-cast-unknown": noAssertneverCastUnknown,
    "no-bivariant-method-syntax": noBivariantMethodSyntax,
    "no-blind-as-any-cast": noBlindAsAnyCast,
    "no-blind-as-cast": noBlindAsCast,
    "no-boolean-parse-return": noBooleanParseReturn,
    "no-branded-number-arithmetic-leak": noBrandedNumberArithmeticLeak,
    "no-broad-index-signatures": noBroadIndexSignatures,
    "no-broad-overload-before-narrow": noBroadOverloadBeforeNarrow,
    "no-call-signature-leaked-internals": noCallSignatureLeakedInternals,
    "no-callback-pyramid": noCallbackPyramid,
    "no-captured-generic-callback-t59": noCapturedGenericCallbackT59,
    "no-cast-to-concrete-impl-t59": noCastToConcreteImplT59,
    "no-cast-to-shape-then-access": noCastToShapeThenAccess,
    "no-chain-for-independent-computations": noChainForIndependentComputations,
    "no-chained-non-null-assertion": noChainedNonNullAssertion,
    "no-collect-then-sync-iterate": noCollectThenSyncIterate,
    "no-collect-then-transform": noCollectThenTransform,
    "no-composed-union-aliases": noComposedUnionAliases,
    "no-concrete-type-bound": noConcreteTypeBound,
    "no-conflicting-intersection-properties": noConflictingIntersectionProperties,
    "no-covariant-container-mutation-uc17": noCovariantContainerMutationUc17,
    "no-decorator-modifies-inferred-type": noDecoratorModifiesInferredType,
    "no-deep-inheritance-chain": noDeepInheritanceChain,
    "no-deep-optional-chain-fallback": noDeepOptionalChainFallback,
    "no-deeply-nested-as-const": noDeeplyNestedAsConst,
    "no-deeply-nested-conditional-types": noDeeplyNestedConditionalTypes,
    "no-deeply-nested-union-members": noDeeplyNestedUnionMembers,
    "no-direct-brand-cast": noDirectBrandCast,
    "no-direct-circular-alias": noDirectCircularAlias,
    "no-double-assertion": noDoubleAssertion,
    "no-duplicate-discriminant-values": noDuplicateDiscriminantValues,
    "no-duplicate-inline-structural-types": noDuplicateInlineStructuralTypes,
    "no-duplicated-constraint-literal": noDuplicatedConstraintLiteral,
    "no-duplicated-union-properties": noDuplicatedUnionProperties,
    "no-eaten-callback-error": noEatenCallbackError,
    "no-effect-boundary-assertion": noEffectBoundaryAssertion,
    "no-empty-array-never-inference": noEmptyArrayNeverInference,
    "no-empty-object-phantom-type": noEmptyObjectPhantomType,
    "no-excessive-intersection-chain": noExcessiveIntersectionChain,
    "no-excessive-typestate-markers": noExcessiveTypestateMarkers,
    "no-excessive-union-members": noExcessiveUnionMembers,
    "no-excessively-nested-conditional-types": noExcessivelyNestedConditionalTypes,
    "no-exhaustiveness-on-open-union": noExhaustivenessOnOpenUnion,
    "no-exported-brand-symbol": noExportedBrandSymbol,
    "no-exposed-global-registry": noExposedGlobalRegistry,
    "no-function-type": noFunctionType,
    "no-getter-returns-mutable-internal": noGetterReturnsMutableInternal,
    "no-getter-returns-private-field": noGetterReturnsPrivateField,
    "no-giant-optional-interface-t59": noGiantOptionalInterfaceT59,
    "no-global-module-merging-uc14": noGlobalModuleMergingUc14,
    "no-god-interface": noGodInterface,
    "no-hardcoded-new-cast-this": noHardcodedNewCastThis,
    "no-if-else-state-cascade": noIfElseStateCascade,
    "no-ignored-parse-errors": noIgnoredParseErrors,
    "no-implicit-any-async-chain": noImplicitAnyAsyncChain,
    "no-incompatible-generic-intersection": noIncompatibleGenericIntersection,
    "no-infallible-sync-result": noInfallibleSyncResult,
    "no-infer-from-unconstrained-type": noInferFromUnconstrainedType,
    "no-instanceof-on-interface-t59": noInstanceofOnInterfaceT59,
    "no-interface-implementation-leak": noInterfaceImplementationLeak,
    "no-intersected-function-types": noIntersectedFunctionTypes,
    "no-intrinsic-transform-on-wide-string": noIntrinsicTransformOnWideString,
    "no-jsdoc-constraint-spec": noJsdocConstraintSpec,
    "no-keyof-any": noKeyofAny,
    "no-kitchen-sink-variant": noKitchenSinkVariant,
    "no-large-literal-union": noLargeLiteralUnion,
    "no-lazy-any": noLazyAny,
    "no-leaky-factory-return-t59": noLeakyFactoryReturnT59,
    "no-literal-widening-on-construct": noLiteralWideningOnConstruct,
    "no-magic-string-state-comparison": noMagicStringStateComparison,
    "no-magic-string-state-uc02": noMagicStringStateUc02,
    "no-magic-string-switch": noMagicStringSwitch,
    "no-manual-type-guards": noManualTypeGuards,
    "no-many-function-parameters": noManyFunctionParameters,
    "no-mismatched-variance-marker": noMismatchedVarianceMarker,
    "no-missing-as-const": noMissingAsConst,
    "no-mixed-decorator-apis": noMixedDecoratorApis,
    "no-mixed-instanceof-discriminant": noMixedInstanceofDiscriminant,
    "no-mixed-null-undefined": noMixedNullUndefined,
    "no-module-level-mutable-export": noModuleLevelMutableExport,
    "no-monolithic-interface-t59": noMonolithicInterfaceT59,
    "no-mutable-array-in-readonly-context": noMutableArrayInReadonlyContext,
    "no-mutable-array-parameter": noMutableArrayParameter,
    "no-mutable-array-parameter-uc17": noMutableArrayParameterUc17,
    "no-mutable-getter-return": noMutableGetterReturn,
    "no-mutable-items-in-readonly-collection": noMutableItemsInReadonlyCollection,
    "no-mutable-state-runtime-guards": noMutableStateRuntimeGuards,
    "no-mutate-iteration-callback-argument": noMutateIterationCallbackArgument,
    "no-mutate-nullable-without-check": noMutateNullableWithoutCheck,
    "no-narrow-implementation-signature": noNarrowImplementationSignature,
    "no-narrowing-lost-in-callback": noNarrowingLostInCallback,
    "no-nested-assert-never-uc03": noNestedAssertNeverUc03,
    "no-nested-discriminated-unions": noNestedDiscriminatedUnions,
    "no-nested-effect-types": noNestedEffectTypes,
    "no-nested-generics-without-extraction-uc14": noNestedGenericsWithoutExtractionUc14,
    "no-nested-infer": noNestedInfer,
     "no-never-as-catchall": noNeverAsCatchall,
    "no-never-reachable-endpoint": noNeverReachableEndpoint,
    "no-non-discriminative-type-guard": noNonDiscriminativeTypeGuard,
    "no-non-literal-discriminant": noNonLiteralDiscriminant,
    "no-noop-brand-constructor": noNoopBrandConstructor,
    "no-object-freeze-without-readonly-annotation": noObjectFreezeWithoutReadonlyAnnotation,
    "no-optional-chain-without-handling": noOptionalChainWithoutHandling,
    "no-or-or-for-default-values": noOrOrForDefaultValues,
    "no-orphaned-abort-controller": noOrphanedAbortController,
    "no-over-branding-uc02": noOverBrandingUc02,
    "no-over-generic-interface": noOverGenericInterface,
    "no-over-intersection": noOverIntersection,
    "no-overengineered-intersection-constraint": noOverengineeredIntersectionConstraint,
    "no-overload-explosion": noOverloadExplosion,
    "no-overly-broad-generic-constraints": noOverlyBroadGenericConstraints,
    "no-overly-complex-bound": noOverlyComplexBound,
    "no-overly-complex-infer-chain-t63": noOverlyComplexInferChainT63,
    "no-override-this-with-base-type": noOverrideThisWithBaseType,
    "no-parallel-boolean-state-flags": noParallelBooleanStateFlags,
    "no-parallel-case-transformed-enums": noParallelCaseTransformedEnums,
    "no-parallel-optional-fields-uc01": noParallelOptionalFieldsUc01,
    "no-partial-construction-pattern": noPartialConstructionPattern,
    "no-partial-record": noPartialRecord,
    "no-partial-validation": noPartialValidation,
    "no-phantom-types-for-simple-state": noPhantomTypesForSimpleState,
    "no-plain-string-ids": noPlainStringIds,
    "no-premature-monad-extraction": noPrematureMonadExtraction,
    "no-primitive-type-alias": noPrimitiveTypeAlias,
    "no-private-constructor-unvalidated-factory": noPrivateConstructorUnvalidatedFactory,
    "no-protected-mutable-primitive-state": noProtectedMutablePrimitiveState,
    "no-public-algorithm-internal": noPublicAlgorithmInternal,
    "no-public-mutable-state-object": noPublicMutableStateObject,
    "no-readonly-on-mutated-class-field": noReadonlyOnMutatedClassField,
    "no-readonly-on-primitives": noReadonlyOnPrimitives,
    "no-record-string-any": noRecordStringAny,
    "no-recursive-type-without-base-case": noRecursiveTypeWithoutBaseCase,
    "no-redundant-infer-conditional": noRedundantInferConditional,
    "no-redundant-narrowing": noRedundantNarrowing,
    "no-redundant-null-return-type": noRedundantNullReturnType,
    "no-redundant-nullable-input-guard": noRedundantNullableInputGuard,
    "no-redundant-overload-signature": noRedundantOverloadSignature,
    "no-repeated-runtime-guards": noRepeatedRuntimeGuards,
    "no-rest-any-implementation": noRestAnyImplementation,
    "no-reuse-generator": noReuseGenerator,
    "no-revalidate-branded-param": noRevalidateBrandedParam,
    "no-runtime-filter-as-t": noRuntimeFilterAsT,
    "no-runtime-generic-assumption": noRuntimeGenericAssumption,
    "no-runtime-init-guard": noRuntimeInitGuard,
    "no-runtime-state-transition-guard": noRuntimeStateTransitionGuard,
    "no-runtime-string-concat-for-typed-keys": noRuntimeStringConcatForTypedKeys,
    "no-scattered-brand-cast": noScatteredBrandCast,
    "no-sealed-interface-without-evolution-path": noSealedInterfaceWithoutEvolutionPath,
    "no-self-referential-conditional-type": noSelfReferentialConditionalType,
    "no-self-referential-generic-bound": noSelfReferentialGenericBound,
    "no-sequential-depth-types": noSequentialDepthTypes,
    "no-shadowed-type-parameter": noShadowedTypeParameter,
    "no-shallow-readonly-array": noShallowReadonlyArray,
    "no-shallow-readonly-mutable-collection": noShallowReadonlyMutableCollection,
    "no-silent-effect-absorption": noSilentEffectAbsorption,
    "no-silent-error-catch": noSilentErrorCatch,
    "no-silent-default": noSilentDefault,
    "no-silent-never-infer-fallback": noSilentNeverInferFallback,
    "no-spread-readonly-workaround": noSpreadReadonlyWorkaround,
    "no-static-async-generator": noStaticAsyncGenerator,
    "no-static-only-utility-class": noStaticOnlyUtilityClass,
    "no-string-discriminant-instead-of-union": noStringDiscriminantInsteadOfUnion,
    "no-string-match-error-handling": noStringMatchErrorHandling,
    "no-string-param-with-literal-comparison": noStringParamWithLiteralComparison,
    "no-string-status-property": noStringStatusProperty,
    "no-structural-type-as-runtime-guard": noStructuralTypeAsRuntimeGuard,
    "no-subsumed-overload": noSubsumedOverload,
    "no-swallowed-error-result": noSwallowedErrorResult,
    "no-template-literal-number-catchall": noTemplateLiteralNumberCatchall,
    "no-template-literal-type-explosion": noTemplateLiteralTypeExplosion,
    "no-this-in-static-member": noThisInStaticMember,
    "no-this-method-reference-assignment": noThisMethodReferenceAssignment,
    "no-throw-in-result-function": noThrowInResultFunction,
    "no-truthiness-null-narrowing": noTruthinessNullNarrowing,
    "no-ts-ignore": noTsIgnore,
    "no-type-assertion-after-parse": noTypeAssertionAfterParse,
    "no-typeof-in-type-alias": noTypeofInTypeAlias,
    "no-typeof-loose-equality": noTypeofLooseEquality,
    "no-typeof-mutable": noTypeofMutable,
    "no-typestate-any-bypass": noTypestateAnyBypass,
    "no-unbounded-plugin-registration": noUnboundedPluginRegistration,
    "no-undiscriminated-error-type": noUndiscriminatedErrorType,
    "no-union-without-common-shape": noUnionWithoutCommonShape,
    "no-unknown-type-predicate": noUnknownTypePredicate,
    "no-unnecessary-invariance": noUnnecessaryInvariance,
    "no-unnecessary-template-literal-type": noUnnecessaryTemplateLiteralType,
    "no-unnecessary-variadic-generic": noUnnecessaryVariadicGeneric,
    "no-unsafe-json-parse-brand-cast": noUnsafeJsonParseBrandCast,
    "no-unsafe-json-stringify": noUnsafeJsonStringify,
    "no-unsafe-non-null-assertion": noUnsafeNonNullAssertion,
    "no-unsafe-task-either-error-map": noUnsafeTaskEitherErrorMap,
    "no-unsafe-unknown-assertion": noUnsafeUnknownAssertion,
    "no-unused-constraint-members": noUnusedConstraintMembers,
    "no-validation-in-business-logic-uc02": noValidationInBusinessLogicUc02,
    "no-value-wrapper-nominal": noValueWrapperNominal,
    "prefer-as-const": preferAsConst,
    "prefer-branded-over-repeated-guard": preferBrandedOverRepeatedGuard,
    "prefer-const-for-literal-binding": preferConstForLiteralBinding,
    "prefer-constraint-over-runtime-guard": preferConstraintOverRuntimeGuard,
    "prefer-contravariance-over-union-uc17": preferContravarianceOverUnionUc17,
    "prefer-discriminated-union-uc02": preferDiscriminatedUnionUc02,
    "prefer-explicit-interface-annotation-t59": preferExplicitInterfaceAnnotationT59,
    "prefer-function-property-over-method": preferFunctionPropertyOverMethod,
    "prefer-instanceof-over-constructor-name": preferInstanceofOverConstructorName,
    "prefer-interface-over-inline-generic": preferInterfaceOverInlineGeneric,
    "prefer-interface-over-pure-abstract-class": preferInterfaceOverPureAbstractClass,
     "prefer-parse-over-boolean-validate": preferParseOverBooleanValidate,
    "prefer-primitive-method-params": preferPrimitiveMethodParams,
    "prefer-property-function-signature": preferPropertyFunctionSignature,
    "prefer-record-over-index-signature": preferRecordOverIndexSignature,
    "prefer-record-over-literal-object-union": preferRecordOverLiteralObjectUnion,
    "prefer-satisfies-config-validation": preferSatisfiesConfigValidation,
    "prefer-satisfies-over-annotation": preferSatisfiesOverAnnotation,
    "prefer-switch-exhaustive-over-fallback-uc03": preferSwitchExhaustiveOverFallbackUc03,
    "prefer-this-interface-return": preferThisInterfaceReturn,
    "prefer-this-over-self-bounded-generic": preferThisOverSelfBoundedGeneric,
    "prefer-this-return-fluent-method": preferThisReturnFluentMethod,
    "prefer-unique-symbol-brand": preferUniqueSymbolBrand,
    "prefer-unknown-over-any": preferUnknownOverAny,
    "prefer-yield-star-for-iterables": preferYieldStarForIterables,
    "prefer-z-infer": preferZInfer,
    "require-assert-never-default-uc03": requireAssertNeverDefaultUc03,
    "require-assertion-throw": requireAssertionThrow,
    "require-assertnever-never-parameter": requireAssertneverNeverParameter,
    "require-assertnever-never-return": requireAssertneverNeverReturn,
    "require-await-try-catch-in-generator": requireAwaitTryCatchInGenerator,
    "require-declare-brand-symbol": requireDeclareBrandSymbol,
    "require-decorator-accessor-keyword": requireDecoratorAccessorKeyword,
    "require-exhaustive-if-chain-uc03": requireExhaustiveIfChainUc03,
    "require-exhaustive-never-check": requireExhaustiveNeverCheck,
    "require-exhaustive-switch": requireExhaustiveSwitch,
    "require-explicit-generic-in-promise-chain": requireExplicitGenericInPromiseChain,
    "require-explicit-variance": requireExplicitVariance,
    "require-generic-coupling-for-shared-union": requireGenericCouplingForSharedUnion,
    "require-literal-state-type": requireLiteralStateType,
    "require-literal-switch-default": requireLiteralSwitchDefault,
    "require-readonly-domain-props-uc02": requireReadonlyDomainPropsUc02,
    "require-readonly-on-array-type": requireReadonlyOnArrayType,
    "require-smart-constructor-validation": requireSmartConstructorValidation,
    "require-type-predicate-subtype": requireTypePredicateSubtype,
    "require-typestate-rebinding": requireTypestateRebinding,
    "require-undefined-handling-after-optional-chain": requireUndefinedHandlingAfterOptionalChain,
    "require-union-discriminant": requireUnionDiscriminant,
    "require-unknown-after-json-parse": requireUnknownAfterJsonParse,
    "require-validation-after-json-parse": requireValidationAfterJsonParse,
  },
  configs: {},
};

export default plugin;
