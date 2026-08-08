import { t, type Lang } from "../i18n/useLang";
import type { StateData } from "../data/states";
import type { ElectionScope } from "./electionOutcome";

// States with a Malay ruler appoint a Menteri Besar; the rest have a
// Yang di-Pertua Negeri who appoints a Ketua Menteri.
const RULER_STATE_IDS = new Set(["johor", "kedah", "kelantan", "terengganu", "pahang", "perlis", "selangor", "ns", "perak"]);

export function isRulerState(stateId: string): boolean {
  return RULER_STATE_IDS.has(stateId);
}

export function stateHeadTitle(stateId: string, lang: Lang): string {
  return isRulerState(stateId) ? t(lang, "utils_governmentTerms.menteriBesar") : t(lang, "utils_governmentTerms.chiefMinister");
}

export type GovernmentTerms = {
  isPrn: boolean;
  /** PERDANA MENTERI · MENTERI BESAR · KETUA MENTERI */
  headTitle: string;
  /** PM · MB · KM — badge-sized head-of-government label */
  headAbbr: string;
  /** AHLI PARLIMEN · ADUN */
  legislatorTitle: string;
  /** KABINET · EXCO */
  executiveBody: string;
  /** MENTERI · AHLI EXCO */
  executiveMember: string;
  /** KERAJAAN PERSEKUTUAN · KERAJAAN NEGERI SELANGOR */
  governmentName: string;
  /** DEWAN RAKYAT · DEWAN UNDANGAN NEGERI (DUN) */
  assemblyName: string;
  /** ISTANA NEGARA · ISTANA SELANGOR · YANG DIPERTUA NEGERI PULAU PINANG */
  appointingAuthority: string;
  /** PARLIMEN · DUN */
  seatLabel: string;
  /** PRU16 · PRN SELANGOR */
  scopeLabel: string;
  stateName: string;
};

export function getGovernmentTerms(lang: Lang, electionScope: ElectionScope, state?: StateData): GovernmentTerms {
  if (electionScope !== "prn" || !state) {
    return {
      isPrn: false,
      headTitle: t(lang, "utils_governmentTerms.primeMinister"),
      headAbbr: "PM",
      legislatorTitle: t(lang, "utils_governmentTerms.mp"),
      executiveBody: t(lang, "utils_governmentTerms.cabinet"),
      executiveMember: t(lang, "utils_governmentTerms.minister"),
      governmentName: t(lang, "utils_governmentTerms.federalGovernment"),
      assemblyName: t(lang, "utils_governmentTerms.dewanRakyat"),
      appointingAuthority: "ISTANA NEGARA",
      seatLabel: t(lang, "utils_governmentTerms.parliament"),
      scopeLabel: "PRU16",
      stateName: t(lang, "utils_governmentTerms.malaysia"),
    };
  }

  const upperName = state.name.toUpperCase();
  return {
    isPrn: true,
    headTitle: stateHeadTitle(state.id, lang),
    headAbbr: isRulerState(state.id) ? "MB" : "KM",
    legislatorTitle: "ADUN",
    executiveBody: "EXCO",
    executiveMember: t(lang, "utils_governmentTerms.excoMember"),
    governmentName: t(lang, "utils_governmentTerms.stateGovernment", { upperName: upperName }),
    assemblyName: t(lang, "utils_governmentTerms.stateAssemblyDun"),
    appointingAuthority: isRulerState(state.id)
      ? t(lang, "utils_governmentTerms.royalPalace", { upperName: upperName })
      : t(lang, "utils_governmentTerms.governorSOffice", { upperName: upperName }),
    seatLabel: "DUN",
    scopeLabel: `PRN ${upperName}`,
    stateName: state.name,
  };
}
