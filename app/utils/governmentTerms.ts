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
  return isRulerState(stateId) ? t(lang, "MENTERI BESAR", "MENTERI BESAR") : t(lang, "KETUA MENTERI", "CHIEF MINISTER");
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
      headTitle: t(lang, "PERDANA MENTERI", "PRIME MINISTER"),
      headAbbr: "PM",
      legislatorTitle: t(lang, "AHLI PARLIMEN", "MP"),
      executiveBody: t(lang, "KABINET", "CABINET"),
      executiveMember: t(lang, "MENTERI", "MINISTER"),
      governmentName: t(lang, "KERAJAAN PERSEKUTUAN", "FEDERAL GOVERNMENT"),
      assemblyName: t(lang, "DEWAN RAKYAT", "DEWAN RAKYAT"),
      appointingAuthority: "ISTANA NEGARA",
      seatLabel: t(lang, "PARLIMEN", "PARLIAMENT"),
      scopeLabel: "PRU16",
      stateName: t(lang, "Malaysia", "Malaysia"),
    };
  }

  const upperName = state.name.toUpperCase();
  return {
    isPrn: true,
    headTitle: stateHeadTitle(state.id, lang),
    headAbbr: isRulerState(state.id) ? "MB" : "KM",
    legislatorTitle: "ADUN",
    executiveBody: "EXCO",
    executiveMember: t(lang, "AHLI EXCO", "EXCO MEMBER"),
    governmentName: t(lang, `KERAJAAN NEGERI ${upperName}`, `${upperName} STATE GOVERNMENT`),
    assemblyName: t(lang, "DEWAN UNDANGAN NEGERI (DUN)", "STATE ASSEMBLY (DUN)"),
    appointingAuthority: isRulerState(state.id)
      ? t(lang, `ISTANA ${upperName}`, `${upperName} ROYAL PALACE`)
      : t(lang, `YANG DIPERTUA NEGERI ${upperName}`, `${upperName} GOVERNOR'S OFFICE`),
    seatLabel: "DUN",
    scopeLabel: `PRN ${upperName}`,
    stateName: state.name,
  };
}
