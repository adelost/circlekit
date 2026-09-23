# Studio-handoff: oberoende statisk granskning 2026-09-23

## Slutsats och avgränsning

**Påståendet att allt är klart är för starkt. Grundimplementationen finns, men denna granskning hittade sex konkreta avvikelser. Fem rättas i denna CircleKit-branch och en i [AMUX PR #418](https://github.com/adelost/agentmux/pull/418).**

Beställningen var att granska implementationen mot den överlämnade Studio-handoffens krav, rätta belagda kodfel och spara granskningen i PR, utan att köra tester. Denna rapport är inte ett nytt arkitekturförslag eller ett merge-godkännande.

**Utförd verifiering: läsning av källkod, deklarationer, manifest, tidigare PR-diffar och publicerade ändringar. Ingen testkörning, kompilering, dependency-installation, syntaxkontroll, smoke, webbläsarkörning eller produktkörning har utförts. Ingen CI har skapats eller anropats.** Tidigare agenters uppgifter om gröna tester är deras rapporterade resultat, inte denna granskares verifiering. Inga beroendeversioner, genererade produktfiler eller native-funktioner ändras här.

### Lästa revisioner

Länkar och filnamn nedan avser dessa ögonblicksbilder, inte ett löfte om framtida innehåll på main/master.

| Repository | Granskad bas | Deklarerad ProductSpec-version |
|---|---|---|
| CircleKit | `2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129` | Produktens egen installation väljs vid export/laws. |
| AMUX | `ead05d12efdd34cb18f64db5cba576d994838ae5` | Link: `0.3.64`, enligt `android/audio-inbox/product-spec/package.json`. |
| ai-dsl | `59fa1909911c2df22131a21a720ad2e1517256b6` | `0.3.67`, enligt `ui/package.json`. |
| SKYVW native | `b91e368dfb365dc933fd2928de208fc0e5b50f35` | `0.3.67`, enligt `appspec/package.json`. |
| SKYVW web | `fd00de0d7297ae0ad62e5192a0353ca9e163409a` | `0.3.67`, enligt `package.json`. |

Källbaser: [CircleKit][ck], [AMUX][amux], [ai-dsl][ai], [SKYVW native][native], [SKYVW web][web]. Faktiskt installerade paket på ägarens dator har inte inspekterats.

### Statusord i checklistan

- **Kod:** den lästa kodvägen implementerar kravet. Detta betyder inte att funktionen har körts eller att alla möjliga syntaxvarianter stöds.
- **Rättad:** ett konkret fel i den granskade basen har fått en källkodsrättning i denna leverans. Ingen red/green-testverifiering påstås.
- **Ändrat:** den aktuella implementationen skiljer sig från handoffens historiska filnamn, antal eller versionsnummer. Skillnaden redovisas, inte tillskrivs användaren som ett nytt beslut.
- **Öppet:** kräver verkliga artefakter, installerade beroenden, testkörning eller annan kontroll som inte utförts här.

## Sex fynd: symptom, orsak och rättning

| ID | Fynd i den granskade basen | Kodorsak | Rättning och motiv |
|---|---|---|---|
| F1 | JUnit kunde acceptera exempelvis `failures="1"` tillsammans med enbart passerade testcase-element. | `decodeJUnitXml` läste svitens räknare men stämde inte av failure/error/skipped mot fallen. Samlingsnodens räknare kontrollerades inte heller. | `bin/junit-evidence.mjs` validerar angivna `tests`, `failures`, `errors`, `skipped` för både `testsuite` och `testsuites`, inklusive underliggande fall. Motsägelser avvisas med `evidence.count`. Saknade räknare är fortfarande valfria. Nästning begränsas till 64 nivåer. |
| F2 | Saknad eller blank exekveringstid kunde bli en påhittad nolla. | `Number(null)` och `Number('')` blir 0; kontroll av enbart ändligt/icke-negativt tal upptäckte inte saknad information. | Samma importer kräver en icke-blank sträng för svittid och exekverade testfall. Explicit 0 accepteras. Skippat fall utan tid får fortsatt 0 eftersom det inte påstås ha exekverats. Ursprungliga tidsstämplar bevaras. |
| F3 | Två intilliggande JS/TS-kommentarer, `// @covers ...` följt av `// @proof host`, tappade `@covers`. | `leadingComment` i `lib/test-source.mjs` returnerade endast sista kommentaren. | Bevara den avslutande gruppen av radkommentarer. Ett separat föregående block ärvs inte automatiskt. Både befintlig association och proof-kind blir tillgängliga utan ny annotationsmodell. |
| F4 | Giltiga kvarvarande kommentarer kunde ge `Converged` trots fel vid modellinläsning eller ofullständig service-discovery. | `lib/convergence.mjs` räknade positiva belägg utan att ta hänsyn till dessa fel eller `scope.complete === false`. | Ofullständigt modell-/intentunderlag ger `Unknown` om ingen konkret motsägelse finns. En verklig motsägelse förblir `Diverged`. Saknad frivillig evidens blir inte ett nytt obligatoriskt krav. |
| F5 | AMUX Link hade en Kotlin-ID-parser men saknade kopplingen till sitt genererade ID-kataloginnehåll. | Link-manifestet saknade `documentation.idSources`. `workspaceConventions` härleder rapportvägar och kernel-root, inte denna inställning. | [AMUX #418](https://github.com/adelost/agentmux/pull/418) lägger tillbaka den existerande `GeneratedLinkNativeLegoCatalog.kt`-sökvägen. Ingen genererad Kotlin ändras. Tre manifest-rader återställer den faktiska inmatningen till associationen. |
| F6 | Rapportvyn visade inte om en koppling var en källreferens, författarens `@covers` eller en genererad deklarationskoppling. | Backend skickade `kind` respektive `association`, men `public/documentation.js` utelämnade dem och kallade kopplingarna generellt `exact ID references`. | Rapportdetaljer och entity-inspektör visar befintlig associationstyp samt att detta inte är coverage. Befintlig HTML-escaping används. Proof-kind och runtime-evidens förblir separata. |

Originalbelägg: [JUnit-importer][junit], [test-source][testsource], [convergence][convergence], [workspace-resolver][workspaces], [Link-manifest][linkmanifest], [Link-katalog][linkids], [backendens dokumentationsmodell][documentation], [ursprunglig UI][docui]. Rättade versioner finns i denna PR:s diff; F5 ligger i companion-PR:n.

F1 innehåller både svit- och samlingsräknare. F2 innehåller både svit- och testfallstid. De är två rotorsaker, inte fyra separat räknade fel. Inga av fynden kräver att ProductSpec eller produktarkitekturen designas om.

## 1. Arkitektur och ansvar, krav för krav

| Krav | Status | Kontrollerad kod och motivering |
|---|---|---|
| WHAT beskriver ansvar, WHY beskriver gräns/failure mode. | Kod | `service-contracts.mjs` extraherar fälten; produktdeklarationerna nedan har denna uppdelning. Språkgranskaren har inte exekverats. |
| Specialkravet gäller ProductSpec `service()`-typen, inte varje instans. | Kod | Scannern identifierar service-anrop och deras typägda kommentarer. Instanser använder ProductSpec-referenser. |
| En AMUX-authority för wording. | Kod | `documentation.mjs:loadContractEvaluator` laddar `core/contract-lint.mjs`; scannern använder `evaluateContract`. Ingen andra wording-linter införs. |
| Ingen parallell purpose/owns/description/tests-DSL. | Kod | Studio läser kommentarer och befintlig struktur. Denna leverans lägger endast till läs-/valideringslogik, UI-labels och en manifestkoppling. Ingen global frånvarobevisning av alla sådana ord i repos påstås. |
| Ports, effects, lifecycle, state ownership och bindings kommer från ProductSpec. | Kod | `documentation.mjs:intentForEntity` läser typ-/arkitekturdata och binding-kanter, inte duplicerad prosa. |
| WHAT/WHY ligger i Inspection, inte i ProductIr. | Kod | `exporter.mjs:prepareInspection` skickar separata `contracts` och `contractDiagnostics` till `createInspectionBundle`, med den kompilerade produkten kvar som separat indata. |
| Legacy reason får inte slås ihop med WHAT/WHY. | Kod | Separat `legacy`-insamling och vy. Native `sources/app-services.ts` har fortfarande `LIVE_SHARE.reason` och separat `runs`. |
| Testresultat är inte runtime proof. | Kod | Rapportmodell och UI märker resultaten som rapporterad evidens. Traces visas separat. |
| Källa/@covers är inte verifierad coverage. | Rättad F6 | Backend skiljer redan associationstyper; den skillnaden visas nu också. |
| Produktens compiler är authority. | Kod | `product-kernel.mjs` kontrollerar vald installation och lockfile-version. Export/laws använder denna loader; mismatch ersätts inte tyst med Studios compiler. |
| Frivillig evidens får inte blockera basfunktionen. | Kod | `documentation.mjs` hanterar utebliven rapport som information. F4 gör inte saknade rapporter obligatoriska. |
| Inga falska positiva helhetsbesked från trasigt underlag. | Rättad F4 | Fel vid modell-/intentläsning och ofullständig discovery hålls isär från positiva, men partiella, belägg. |

## 2. Living documentation och export

Huvudbelägg: [service-scanner][scanner], [dokumentationsmodell][documentation], [exporter][exporter], [authoring-export][buildexport], [graph-projektion][graph], [workspace-resolver][workspaces].

| Krav | Status | Kontrollerad kod och avgränsning |
|---|---|---|
| AST-discovery av ProductSpec-services. | Kod | TypeScript-AST och symbolupplösning i `service-contracts.mjs`, inte allmän textsökning efter `service`. |
| Imports och import-aliases. | Kod | Scannerns symbol-/importupplösning identifierar ProductSpec-originen. |
| Namespace-användning. | Kod | Egenskapsåtkomst löses genom samma symbolmodell. |
| Const-aliases. | Kod | Alias till deklarationsfunktioner följs statiskt. |
| Const-object som deklarationsargument. | Kod | Argumentets statiska deklaration och objekt läses utan produktkörning. |
| One-line WHAT/WHY. | Kod | Kommentarsinsamlingen och evaluator-anropet stödjer den gemensamma kontraktsformen; ingen separat grammatiktolkning tillkommer. |
| Computed-ID factories. | Kod | Factory-deklarationer upptäcks utan att exekveras. Ett konkret dynamiskt ID eller samband gissas inte fram. Link-fabriken lästes separat. |
| Missing/invalid diagnostics. | Kod | Scanner och dokumentationsmodell exponerar diagnoser; ofullständig discovery markeras uttryckligen. |
| Exact source/model correlation. | Kod | `documentationFor` kräver entity, fil, digest och vid behov span samt matchande aktuell källa. Samma ID räcker inte. |
| Exakt källsnapshot vid export. | Kod | `build-export.mjs` läser vald closure, kontrollerar oförändrade digests och skickar snapshot till `prepareInspection`. |
| Intent & behavior och declared facts. | Kod | `public/documentation.js` och `intentForEntity` visar ansvar, gräns, runtime-fält och ports separat. Browserinteraktion har inte körts. |
| Source navigation. | Kod | Vyn använder endast tillgängliga projektkällor för navigationsknappar och behåller fil/rad. Klick och faktisk editorintegration är inte körverifierade. |
| Problems/diagnoser. | Kod | Modell-/kontrakts-/associationsdiagnoser produceras och incomplete-discovery pekar vidare till Problems. Ingen visuell helhetskontroll av webbläsaren påstås. |
| Compiler-version awareness och inspect-only vid mismatch. | Kod | Workspace-/kernel-kedjan särskiljer producer/evaluator och tillåter inte att matchning antas. Faktiskt installerade paket är Öppet. |
| Bounded graph-export. | Kod | `graph-data.mjs` validerar typer, ägare, ports och bindings samt markerar resultatet `product-spec-graph`, inte full ProductIr. |
| Explicit graph/machine/decision-table-export. | Kod | `build-export.mjs` har tre explicita grenar och vald, begränsad source closure. Detta är betrodd authoring-exekvering på ägarens uttryckliga kommando, inte en sandbox eller viewer-startup. |
| Produktens compiler vid export. | Kod | `exportAuthoring` använder `loadProductKernel`, inte en godtycklig Studio-version. |
| Gemensam start-/kommandoväg. | Ändrat | Nyare implementation använder den gemensamma `v1d-studio`-CLI:n och manifestkonventioner. Äldre produktkopior av `studio.mjs`, export-/smoke-wrappers och handoff-filer ska inte återskapas enbart för att deras namn finns i den gamla chatten. |

## 3. Produktintegrationer, en punkt i taget

### SKYVW native

| Krav/deklaration | Status | Lästa filer och belägg |
|---|---|---|
| `recording.app-run-owner` har WHAT/WHY. | Kod | `appspec/products/skyvw/jumps/background-operation.ts`. |
| `recording.foreground-ingestion` har WHAT/WHY. | Kod | `appspec/products/skyvw/jumps/recording-data.ts`. |
| `navigation.service` har WHAT/WHY. | Kod | `appspec/products/skyvw/menus/navigation.ts`. |
| `navigation.developer-page-guard-source` har WHAT/WHY. | Kod | Samma navigation-fil. |
| `position.skyvw-service` har WHAT/WHY. | Kod | `appspec/products/skyvw/sources/location-data.ts`. |
| `ui.surface-interaction` har WHAT/WHY. | Kod | `appspec/products/skyvw/wiring/contracts/ui-interaction-data.ts`. |
| `records.period-state-owner` har WHAT/WHY. | Kod | `appspec/products/skyvw/wiring/contracts/ui-state-data.ts`. |
| `flight.detail-ui-state-owner` har WHAT/WHY. | Kod | Samma UI-state-fil. |
| `logbook.tags` har WHAT/WHY. | Kod | `appspec/products/skyvw/jumps/logbook-data.ts`. Detta är den nionde lokala deklarationen jämfört med äldre handoffs uppgift om åtta. |
| Shared services ägs av CircleKit-paketet. | Kod | `app.ts`, `sources/runtime-services-data.ts` och produktfiler importerar `@v1d/skydiving-legos`. Manifestet väljer även produktens installerade paketkälla, inte godtycklig annan checkout. |
| Riktig ProductSpec-produkt används. | Kod/Öppet | `app.ts` anropar `defineProduct`; manifestet väljer `appspec/generated/skyvw/skyvw.product.json`. Genererad fils aktualitet och framgångsrik inläsning har inte återproducerats. |
| Recording har position och pressure. | Kod | `recording-data.ts` behåller importerade inputs, lägger till `pressure`, och binder `position.service.flightFix` respektive `pressure.recording-platform.observation`. |
| `LIVE_SHARE.reason` finns kvar separat. | Kod | `sources/app-services.ts`: literal legacy-reason, med `runs.intervalMs = 5000` separat. Ingen relation till ProductSpec-typ gissas från namnet. |
| Kotlin-ID-katalog kopplas in. | Kod | Native-manifestets `idSources` pekar på `GeneratedSkyvwNativeLegoCatalogPortIds.kt`; filens verkliga objekt heter `GeneratedSkyvwNativeLegoPortIds` och innehåller `X_VALUE` + `val X = X_VALUE`. Parserns båda led lästes. |
| Lokalt native-smoke/JUnit fungerar. | Öppet | Ingen Gradle-, emulator-, hardware- eller JUnit-körning. Saknad runtime-verifiering ska inte ersättas av att räknare eller filer ser rimliga ut. |

### SKYVW web

| Krav/deklaration | Status | Lästa filer och belägg |
|---|---|---|
| `logbook.host` har WHAT/WHY. | Kod | `src/logbook/product.ts`. |
| `people.host` har WHAT/WHY. | Kod | `src/logbook/account-product.ts`. |
| `sharing.host` har WHAT/WHY. | Kod | Samma account-fil. |
| `devices.host` har WHAT/WHY. | Kod | Samma account-fil. |
| `settings.host` har WHAT/WHY. | Kod | Samma account-fil. |
| `details.host` har WHAT/WHY. | Kod | `src/logbook/details-product.ts`. |
| `manual-editor.host` har WHAT/WHY. | Kod | `src/logbook/manual-editor-product.ts`. Totalt sju granskade service-deklarationer. |
| Replay är presentation-only. | Kod | `src/logbook/replay-product.ts` använder `present`, `stateOwner: none`, call-lifetime och tom effects-lista. |
| Bounded graph, inte full ProductIr. | Kod | `logbookGraph = compileProductGraph(...)`; manifestets authoring-export och Studios `graphProduct` bevarar den avgränsningen. |
| Explicit produktägd export. | Kod/Ändrat | Manifestet väljer de fem faktiska source-filerna, entry och `logbookGraph`. Delad export-CLI ersätter historisk produkt-wrapper. |
| Behåll produktens compiler. | Kod/Ändrat | Aktuell pin är 0.3.67, inte handoffens 0.3.52. Den ändringen gjordes före denna granskning; ingen pin ändras här och ingen downgrade föreslås. |
| Exact-source export/smoke fungerar praktiskt. | Öppet | Korrelationens kod finns, men ingen bundle regenererades och ingen browser/smoke kördes. |

### AMUX

| Krav | Status | Lästa filer och belägg |
|---|---|---|
| Tio direkta Link-services har WHAT/WHY. | Kod | `android/audio-inbox/product-spec/src/node-types.ts`: navigation, capture, conversation, playback, target-directory, session, history, preferences, updates, recovery. Varje deklaration har en intilliggande WHAT/WHY-kommentar. |
| Elfte service via computed wake-word factory. | Kod | `src/wake-word.ts`: `defineWakeWordFeature`, `${product}.wake`, typägd kommentar. |
| Befintlig kontraktslinter återanvänds. | Kod | Studios evaluator-loader pekar på AMUX-authority, inte kopierad lokal grammatik. |
| AMUX declaration laws använder 0.3.64. | Kod/Öppet | Link-paketet deklarerar 0.3.64, kernel-loadern kräver matchande installation/lockfile. Ingen law-körning utförd. |
| Generated Kotlin IDs når associationen. | Rättad F5 | Den verkliga nested `GeneratedLinkNativeLegoCatalog.PortIds.*`-katalogen saknades i manifestets input. Återkopplas i #418. |
| Optional Vitest/JUnit/laws. | Kod/Öppet | Gemensamma report-konventioner och importer finns. En verklig Link-rapport och dess portassociationer måste kontrolleras lokalt. |

### ai-dsl

| Krav | Status | Lästa filer och belägg |
|---|---|---|
| Befintlig activity-modell återanvänds. | Kod | `ui/scripts/lib/studio-activity-product.mjs` exporterar `STUDIO_ACTIVITY_DECISION_TABLE`; manifestets projekt-ID är `ai-tools.studio-activity`. |
| Ingen ny scheduler för presentationen. | Kod | Den lästa integrationen är en decision-table/presentation-export, inte en ny schedulerimplementation. |
| Finite space är 36 punkter. | Kod | Deklarerade domäner ger 6 × 2 × 3 = 36 kombinationer. Detta är en uträkning från deklarationen, inte 36 exekverade tester. |
| Produktägd bounded export. | Kod | Manifestet väljer rätt fil/export och `decision-table`; delad exporter väljer produktens paketrot. |
| Produktens compiler från ui. | Kod/Ändrat | Aktuell pin är 0.3.67 i `ui/package.json`, inte äldre handoffs 0.3.65. Installerad matchning återstår att köra. |
| Optional Vitest/laws är anslutna. | Kod/Öppet | Manifestet anger `ui/test-results/bdd-run.json` och `test-results/ai-tools.studio-activity-laws.json`. Rapporternas verkliga existens/aktualitet har inte verifierats. |

## 4. Optional evidence och de särskilda riskpunkterna

Huvudbelägg: [report-output][reportoutput], [behavior-evidence][behavior], [test-source][testsource], [Vitest-reporter][vitest], [declaration-evidence][laws], [law-CLI][lawcli], [kernel-loader][kernel] och [JUnit][junit].

| Krav/riskpunkt | Status | Motivering |
|---|---|---|
| `bdd.run.v1` output helpers. | Kod | Summary härleds från insamlade fall; shape/status/tid valideras; output skrivs repository-relativt via temporär fil och rename. |
| Vitest-reporter. | Kod/Öppet | Insamling använder `children.allTests()`, `result()` och `diagnostic()` samt faktisk run-tid/status. Inga installerade Vitest-API:er har körts mot reportern i denna granskning. |
| JUnit XML-import. | Rättad F1/F2 | Parser och bounded input finns; motsägande counters och saknad tid får nu inte bli framgångsrik rapport. Verklig Gradle-XML är fortfarande Öppet. |
| Ursprungliga timestamps/timezones. | Kod/Öppet | Ingen ommärkning till importtid; zonlös timestamp kräver explicit UTC-uppgift när den ursprungliga köraren verkligen använde UTC. Andra dialekter/zontolkningar är inte verifierade. |
| JS/TS test-source association. | Kod | AST-index, identitet och källposition används; godtycklig referens kallas inte coverage. |
| Kotlin source parsing och radmatchning. | Kod/Öppet | Maskning, balansering och unik namn-/radmatchning lästes. Detta är en begränsad parser, inte en full Kotlin-kompilator. |
| Backtick-testnamn och expression-body-lambda. | Kod/Öppet | Explicit stöd finns i `kotlinIndex`; befintliga regressionskällor lästes men kördes inte. |
| Native `X_VALUE`-alias. | Kod | Verklig katalog och parserns data-object/alias-pass stämmer strukturellt överens. Ingen omotiverad parseromskrivning gjordes. |
| Nested AMUX generated IDs. | Rättad F5 | Parserns nested tokens fanns; den saknade inmatningen var rotorsaken som rättades. |
| Optional `@covers`. | Rättad F3 | Befintlig annotation kvarstår frivillig; intilliggande radkommentarer går inte längre förlorade i den rättade koden. |
| Ambiguous/unknown `@covers`. | Kod | Exakt nyckel eller entydigt ID krävs; annars associationsdiagnos, inte gissning. |
| Optional `@proof`. | Kod | Proof-kind är författardeklarerad scope, inte en runtime-observation. |
| Generated declaration laws. | Kod | Egen rapportproducer för deklarations-/compilerbelägg. Inte ett nytt `tests: []` i ProductSpec. |
| Exact-model law IDs. | Kod | `declarationLawId` beror på modellens digest och deklarationsidentitet; association till annan modell avvisas. |
| `--kernel-root` och exakt evaluator. | Kod/Öppet | Loader väljer faktiskt paket och jämför installation med lockfile/expected version. Miljön på ägarens dator återstår. |
| Unknown/mismatch ska skippas. | Kod | Law-genereringen skiljer känt matchande producer/evaluator från unknown/mismatch; ingen tyst compiler-substitution. |
| All-skipped får inte ge grön law-körning. | Kod | Law-CLI:n ger icke-noll när inga laws passerat; konvergens räknar inte skippade laws som positiva belägg. |
| Raw ProductIr med producer-version. | Kod/Öppet | Befintlig workspace-/kernel-kedja använder tillgänglig producentidentitet. Hårdvarans faktiska råartefakt och version har inte verifierats här. |
| Proof-kind och association-kind i UI. | Rättad F6 | Befintlig proof-kind behålls; associationstyp visas nu explicit i båda relevanta vyerna. |
| Optional report missing/invalid är inte startup/build failure. | Kod | Dokumentationsinläsning håller dessa som separata rapportstatus/diagnoser; F4 gäller trasigt modell-/intentunderlag. |
| Trace förblir observed evidence, inte en testetikett. | Kod/Öppet | Dokumentationsvyn hänvisar separat till Trace. Den senare explicita `record`-funktionen har inte körts; live-/devicebeteende är inte verifierat. |

En exakt modellkoppling autentiserar inte en handskriven eller ändrad rapport. Importerade testresultat förblir producer-rapporterade belägg; denna granskning påstår varken kryptografisk äkthet, verifierad coverage eller att ett passerat unit-test bevisar produktens runtimebeteende.

## 5. Historisk handoff jämfört med dagens kod

Äldre PR-listor beskriver en tidigare stack. Granskningen använde aktuell default-branch-kod efter senare integrationer, inte gamla påståenden om att ai-dsl #412 fortfarande måste lösas eller att varje produkt måste ha en egen launcher. Bland lästa senare PR:er finns CircleKit #299, AMUX #417, ai-dsl #417, native #1672 och web #39. Deras testuppgifter har inte övertagits som egna bevis.

Den gamla handoffens nio takeover-brancher, gamla head-SHA:n, åtta native-services samt web-/ai-versionerna 0.3.52/0.3.65 ska alltså inte användas som aktuella fakta. Den här rapporten beskriver vad som faktiskt lästes. Delad CLI och manifeststyrd export är den nuvarande vägen; att återinföra borttagna wrappers skulle skapa parallella vägar utan att rätta de funna felen.

**NO CI gäller denna leverans.** Inga workflow-filer, remote runners, merge gates eller remote hardware-jobb läggs till. AMUX hade redan en separat `repository_dispatch`-workflow för självrapporterad status; den lästes, ändrades inte och anropades inte. Detta är inte ett påstående att alla fem repos historiskt saknar CI.

## 6. Ägarens återstående verifiering

Två nya regressionsfiler innehåller sammanlagt 31 skrivna fall, inklusive loop-expanderade fall:

- `product-studio/test/static-audit-regressions.test.mjs`: 22 fall för counters, tidsfält, annotationskommentarer och konvergens.
- `product-studio/test/static-audit-boundaries.test.mjs`: 9 fall för aggregate counters, bounded nesting och UI-labels.

**Noll av dessa fall har körts av denna granskare.** De är föreslagna reproduktioner/acceptanskriterier, inte bevisade tester. Ett red/green-bevis kräver att rätt fall visar ursprungssymptomet på basen och sedan passerar rättningen. Hela regressionspaketet ska inte beskrivas som grönt innan det faktiskt har körts.

Kvar för lokal verifiering på ägarens hårdvara: CircleKit-suite och browserflöden; aktuell compiler/lockfile-matchning; produktmanifestens inläsning/export; verklig Vitest-rapport; genuin JUnit XML med rätt source roots och tidszon; faktisk Kotlin-ID-association; law-resultatens exact-model-korrelation; eventuella native/runtime-traces. Produktens befintliga lokala arbetsflöde ska användas, inte GitHub CI. Skriv inte om arkitekturen för att dölja ett konkret fel.

## Leveransstatus

**Klart:** statisk kravgranskning och källkodsrättningar i separata review-brancher; AMUX-kopplingen i companion-PR #418.

**Verifieringens räckvidd:** källkod och GitHub-leverans, inte programkörning. Rapportens Kod/Rättad-rader är inte exekveringsbevis.

**Öppet:** lokal körverifiering och efterföljande mergebeslut. Inget är mergat, releasat eller deployat av denna granskning.

[ck]: https://github.com/adelost/circlekit/tree/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio
[amux]: https://github.com/adelost/agentmux/tree/ead05d12efdd34cb18f64db5cba576d994838ae5
[ai]: https://github.com/adelost/ai-dsl/tree/59fa1909911c2df22131a21a720ad2e1517256b6
[native]: https://github.com/adelost/skydive-altimeter/tree/b91e368dfb365dc933fd2928de208fc0e5b50f35
[web]: https://github.com/adelost/skyvw-web/tree/fd00de0d7297ae0ad62e5192a0353ca9e163409a
[scanner]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/lib/service-contracts.mjs
[documentation]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/lib/documentation.mjs
[exporter]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/lib/exporter.mjs
[buildexport]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/lib/build-export.mjs
[graph]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/lib/graph-data.mjs
[workspaces]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/lib/workspaces.mjs
[junit]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/bin/junit-evidence.mjs
[testsource]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/lib/test-source.mjs
[convergence]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/lib/convergence.mjs
[linkmanifest]: https://github.com/adelost/agentmux/blob/ead05d12efdd34cb18f64db5cba576d994838ae5/studio.workspace.json
[linkids]: https://github.com/adelost/agentmux/blob/ead05d12efdd34cb18f64db5cba576d994838ae5/android/audio-inbox/link-ui/src/main/java/io/agentmux/linkui/product/generated/GeneratedLinkNativeLegoCatalog.kt
[docui]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/public/documentation.js
[reportoutput]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/lib/report-output.mjs
[behavior]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/lib/behavior-evidence.mjs
[vitest]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/reporters/vitest.mjs
[laws]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/lib/declaration-evidence.mjs
[lawcli]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/bin/law-evidence.mjs
[kernel]: https://github.com/adelost/circlekit/blob/2f9911c1d3a2128d1f2b1cc51f2e6d8ef0ef7129/product-studio/lib/product-kernel.mjs
