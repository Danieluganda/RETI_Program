// lib/youthInWork.ts

import {
  Prisma,
  PrismaClient,
  type Participant,
} from "@prisma/client";

import {
  normalizeEso,
  normalizeName,
  normalizePhone,
  normalizeText,
  toParticipantSummary,
  type ParticipantSummary,
} from "./participants";

const globalForYouthInWork = globalThis as unknown as {
  youthInWorkPrisma?: PrismaClient;
};

function prisma() {
  if (!globalForYouthInWork.youthInWorkPrisma) {
    globalForYouthInWork.youthInWorkPrisma =
      new PrismaClient();
  }

  return globalForYouthInWork.youthInWorkPrisma;
}

/* =========================================================
   V3 CONTROLLED VALUES
========================================================= */

export const YIW_REGIONS = [
  "Central",
  "Eastern",
  "Northern",
  "Western",
] as const;

export type YouthInWorkRegion =
  | "Central"
  | "Eastern"
  | "Northern"
  | "Western";

export const YIW_CENTRAL_DISTRICTS = [
  "Bukomansimbi",
  "Butambala",
  "Gomba",
  "Kalangala",
  "Kalungu",
  "Kyotera",
  "Lwengo",
  "Lyantonde",
  "Masaka",
  "Mpigi",
  "Rakai",
  "Ssembabule",
  "Wakiso",
  "Buikwe",
  "Buvuma",
  "Kassanda",
  "Kayunga",
  "Kiboga",
  "Kyankwanzi",
  "Luwero",
  "Mityana",
  "Mubende",
  "Mukono",
  "Nakaseke",
  "Nakasongola",
  "Kampala",
] as const;
export const YIW_EASTERN_DISTRICTS = [
  "Bugiri",
  "Bugweri",
  "Buyende",
  "Iganga",
  "Jinja",
  "Kaliro",
  "Kamuli",
  "Luuka",
  "Mayuge",
  "Namayingo",
  "Namutumba",
  "Budaka",
  "Busia",
  "Butaleja",
  "Butebo",
  "Kibuku",
  "Pallisa",
  "Tororo",
  "Bududa",
  "Bukwo",
  "Bulambuli",
  "Kapchorwa",
  "Kween",
  "Manafwa",
  "Mbale",
  "Namisindwa",
  "Sironko",
  "Amuria",
  "Bukedea",
  "Kaberamaido",
  "Kalaki",
  "Kapelebyong",
  "Katakwi",
  "Kumi",
  "Ngora",
  "Serere",
  "Soroti",
] as const;
export const YIW_NORTHERN_DISTRICTS = [
  "Abim",
  "Amudat",
  "Kaabong",
  "Karenga",
  "Kotido",
  "Moroto",
  "Nabilatuk",
  "Nakapiripirit",
  "Napak",
  "Alebtong",
  "Amolatar",
  "Apac",
  "Dokolo",
  "Kole",
  "Kwania",
  "Lira",
  "Otuke",
  "Oyam",
  "Agago",
  "Amuru",
  "Gulu",
  "Kitgum",
  "Lamwo",
  "Nwoya",
  "Omoro",
  "Pader",
  "Adjumani",
  "Arua",
  "Koboko",
  "Madi Okollo",
  "Maracha",
  "Moyo",
  "Nebbi",
  "Obongi",
  "Pakwach",
  "Terego",
  "Yumbe",
  "Zombo",
] as const;
export const YIW_WESTERN_DISTRICTS = [
  "Buliisa",
  "Hoima",
  "Kagadi",
  "Kakumiro",
  "Kibaale",
  "Kikuube",
  "Kiryandongo",
  "Masindi",
  "Bundibugyo",
  "Bunyangabu",
  "Kabarole",
  "Kamwenge",
  "Kasese",
  "Kitagwenda",
  "Kyegegwa",
  "Kyenjojo",
  "Ntoroko",
  "Kabale",
  "Kanungu",
  "Kisoro",
  "Rubanda",
  "Rukiga",
  "Rukungiri",
  "Buhweju",
  "Bushenyi",
  "Ibanda",
  "Isingiro",
  "Kazo",
  "Kiruhura",
  "Mbarara",
  "Mitooma",
  "Ntungamo",
  "Rubirizi",
  "Rwampara",
  "Sheema",
] as const;

const YIW_DISTRICT_REGION_MAP =
  new Map<string, YouthInWorkRegion>([
    ...YIW_CENTRAL_DISTRICTS.map(
      (district) =>
        [district.toLowerCase(), "Central"] as const,
    ),
    ...YIW_EASTERN_DISTRICTS.map(
      (district) =>
        [district.toLowerCase(), "Eastern"] as const,
    ),
    ...YIW_NORTHERN_DISTRICTS.map(
      (district) =>
        [district.toLowerCase(), "Northern"] as const,
    ),
    ...YIW_WESTERN_DISTRICTS.map(
      (district) =>
        [district.toLowerCase(), "Western"] as const,
    ),
  ]);

export function getYouthInWorkRegionForDistrict(
  district?: string | null,
): YouthInWorkRegion | null {
  const key = normalizeText(
    district || "",
  ).toLowerCase();

  return key
    ? YIW_DISTRICT_REGION_MAP.get(key) ||
        null
    : null;
}

export const YIW_GENDERS = [
  "Male",
  "Female",
] as const;

export const YIW_BUSINESS_SIZES = [
  "Micro",
  "Small",
  "Medium",
] as const;

export const YIW_EDUCATION_LEVELS = [
  "Primary Education",
  "Secondary Education",
  "University",
  "Vocational/Technical Education",
] as const;

export const YIW_EMPLOYMENT_STATUSES = [
  "Self-Employment",
  "Wage employment",
] as const;

export const YIW_EMPLOYMENT_TYPES = [
  "Part-time",
  "Full-time",
] as const;

export const YIW_SECTORS = [
  "Agriculture",
  "Trade and Service",
  "Fashion",
  "Light Manufacturing",
  "MICE",
  "Health",
] as const;

const PLACEHOLDER_NAMES = new Set([
  "test",
  "test user",
  "unknown",
  "n/a",
  "na",
  "none",
  "xxx",
  "sample",
  "sample user",
  "demo",
  "demo user",
  "dummy",
  "dummy user",
  "asdf",
  "qwerty",
]);

/* =========================================================
   TYPES
========================================================= */

export type YouthInWorkAssessmentInput = {
  participantId?: string;

  participantName: string;
  participantPhone?: string;
  participantEmail?: string;
  participantExternalId?: string;

  esoName?: string;

  // Demographics
  dateOfBirth?: string | Date;
  yearOfBirth?: number; // legacy transition support only
  gender?: string;

  // Location
  region?: string;
  district?: string;
  subcounty?: string;
  parish?: string;
  village?: string;

  // Enterprise / employment
  businessName?: string;
  businessSector?: string;
  businessSize?: string;
  employmentStatus?: string;
  employmentType?: string;
  employerParticipantId?: string;
  educationLevel?: string;

  // Inclusion
  hasDisability?: boolean;
  disabilityType?: string;

  isRefugee?: boolean;
  countryOfOrigin?: string;

  // Foundation Course
  foundationCourseStatus?: string;
  foundationLearning?: string;

  // Income
  incomeFromProgram?: string;
  incomeAmount?: number;

  // Working conditions
  workImproved?: string;
  workImprovementDescription?: string;
  improvementOutcomes?: string[];

  // Digital adoption
  digitalMarketsAccess?: boolean;
  digitalMarketPlatforms?: string[];

  digitalFinanceAccess?: boolean;
  digitalFinanceProviders?: string[];

  businessEfficiencyAccess?: boolean;
  businessEfficiencyPlatforms?: string[];

  // Existing compatibility fields
  youthInWorkStatus: string;
  trainingInterest?: string;
  supportNeeded?: string[];

  notes?: string;
  assessorName?: string;
  evidenceFileKey?: string;

  // Background GPS
  gpsCaptureStatus?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAccuracy?: number;
  gpsCapturedAt?: string | Date;
  gpsCaptureError?: string;
};

export type YouthInWorkParticipantSummary =
  ParticipantSummary & {
    hasAssessment: boolean;

    dateOfBirth?: string | null;
    yearOfBirth?: number | null;
    gender?: string | null;

    subcounty?: string | null;
    parish?: string | null;
    village?: string | null;

    businessName?: string | null;
    businessSize?: string | null;
    employmentStatus?: string | null;
    employmentType?: string | null;
    educationLevel?: string | null;

    hasDisability?: boolean | null;
    disabilityType?: string | null;

    isRefugee?: boolean | null;
    countryOfOrigin?: string | null;
  };

export type DuplicateParticipantMatch = {
  participant: YouthInWorkParticipantSummary;
  matchReason:
    | "external_id"
    | "phone"
    | "email"
    | "name_dob_district"
    | "name_dob_eso"
    | "name_district_eso";
};

export type NameValidationResult = {
  valid: boolean;
  normalized: string;
  error?: string;
};

export type PhoneValidationResult = {
  valid: boolean;
  normalized: string;
  error?: string;
};

export type DateOfBirthValidationResult = {
  valid: boolean;
  date: Date | null;
  isoDate: string | null;
  year: number | null;
  error?: string;
};

/* =========================================================
   ERRORS
========================================================= */

function duplicateAssessmentError() {
  return new Error(
    "This participant already has a Youth in Work assessment.",
  );
}

export class ExistingYouthInWorkParticipantError extends Error {
  code = "PARTICIPANT_ALREADY_EXISTS";
  match: DuplicateParticipantMatch;

  constructor(match: DuplicateParticipantMatch) {
    super(
      "This participant appears to already exist in the system.",
    );

    this.name = "ExistingYouthInWorkParticipantError";
    this.match = match;
  }
}

/* =========================================================
   BASIC CLEANING
========================================================= */

function clean(value?: string | null) {
  return normalizeText(value || "") || null;
}

function cleanEmail(value?: string | null) {
  const email = normalizeText(
    value || "",
  ).toLowerCase();

  return email || null;
}

function cleanArray(values?: string[]) {
  const cleaned = (values || [])
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return Array.from(new Set(cleaned));
}

function isoDateOnly(value: Date | null | undefined) {
  if (!value) return null;

  const year = value.getUTCFullYear();
  const month = String(
    value.getUTCMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    value.getUTCDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function canonicalControlledValue(
  value: string | undefined | null,
  allowed: readonly string[],
  aliases: Record<string, string> = {},
) {
  const cleaned = normalizeText(
    value || "",
  );

  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();

  const alias = aliases[lower];
  if (alias) return alias;

  const canonical = allowed.find(
    (item) =>
      item.toLowerCase() === lower,
  );

  return canonical || null;
}

/* =========================================================
   FULL-NAME DATA QUALITY
========================================================= */

export function validateYouthInWorkFullName(
  value: string,
): NameValidationResult {
  const normalized = normalizeName(
    value || "",
  )
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return {
      valid: false,
      normalized: "",
      error:
        "Participant full name is required.",
    };
  }

  const lower =
    normalized.toLowerCase();

  if (PLACEHOLDER_NAMES.has(lower)) {
    return {
      valid: false,
      normalized,
      error:
        "Enter the participant's real full name, not a placeholder.",
    };
  }

  if (/\d/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        "Full name cannot contain numbers.",
    };
  }

  /**
   * Allow letters from all alphabets plus apostrophes,
   * hyphens and periods. Require at least two name parts.
   */
  const validShape =
    /^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*)+$/u.test(
      normalized,
    );

  if (!validShape) {
    return {
      valid: false,
      normalized,
      error:
        "Enter at least two valid names using letters only.",
    };
  }

  const parts =
    normalized.split(/\s+/);

  if (parts.length < 2) {
    return {
      valid: false,
      normalized,
      error:
        "Enter the participant's full name with at least two names.",
    };
  }

  const totalLetters = (
    normalized.match(/\p{L}/gu) || []
  ).length;

  if (totalLetters < 4) {
    return {
      valid: false,
      normalized,
      error:
        "Enter the participant's complete full name.",
    };
  }

  const suspiciousTokens = new Set([
    "test",
    "unknown",
    "sample",
    "demo",
    "dummy",
    "asdf",
    "qwerty",
    "xxx",
  ]);

  if (
    parts.some((part) =>
      suspiciousTokens.has(
        part.toLowerCase(),
      ),
    )
  ) {
    return {
      valid: false,
      normalized,
      error:
        "Enter the participant's real full name, not test or placeholder data.",
    };
  }

  return {
    valid: true,
    normalized,
  };
}

/* =========================================================
   PHONE DATA QUALITY
========================================================= */

export function validateYouthInWorkPhone(
  value: string,
): PhoneValidationResult {
  const raw = String(value || "").trim();

  if (!raw) {
    return {
      valid: false,
      normalized: "",
      error:
        "Participant phone number is required.",
    };
  }

  if (/[A-Za-z]/.test(raw)) {
    return {
      valid: false,
      normalized: "",
      error:
        "Phone number cannot contain letters.",
    };
  }

  /**
   * Accept user-friendly spaces / brackets / hyphens while
   * rejecting every other non-phone character.
   */
  if (
    !/^\+?[\d\s()-]+$/.test(raw)
  ) {
    return {
      valid: false,
      normalized: "",
      error:
        "Phone number contains invalid characters.",
    };
  }

  const compact = raw.replace(
    /[\s()-]/g,
    "",
  );

  if (!/^\+?\d+$/.test(compact)) {
    return {
      valid: false,
      normalized: "",
      error:
        "Enter a valid phone number.",
    };
  }

  const digits = compact.replace(
    /\D/g,
    "",
  );

  /**
   * E.164 allows up to 15 digits. Nine digits is a practical
   * minimum that still permits normalized Ugandan mobile numbers
   * and international numbers without accepting obvious junk.
   */
  if (
    digits.length < 9 ||
    digits.length > 15
  ) {
    return {
      valid: false,
      normalized: "",
      error:
        "Phone number must contain between 9 and 15 digits.",
    };
  }

  const normalized =
    normalizePhone(compact);

  if (!normalized) {
    return {
      valid: false,
      normalized: "",
      error:
        "Enter a valid phone number.",
    };
  }

  return {
    valid: true,
    normalized,
  };
}

/* =========================================================
   DATE OF BIRTH DATA QUALITY
========================================================= */

function validCalendarDate(
  year: number,
  month: number,
  day: number,
) {
  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function parseYouthInWorkDateOfBirth(
  value?: string | Date,
): DateOfBirthValidationResult {
  if (!value) {
    return {
      valid: false,
      date: null,
      isoDate: null,
      year: null,
      error:
        "Date of birth is required.",
    };
  }

  let date: Date | null = null;

  if (value instanceof Date) {
    if (
      !Number.isNaN(value.getTime())
    ) {
      date = new Date(
        Date.UTC(
          value.getUTCFullYear(),
          value.getUTCMonth(),
          value.getUTCDate(),
        ),
      );
    }
  } else {
    const raw = value.trim();

    /**
     * Preferred field format: DD/MM/YYYY
     */
    const dmy = raw.match(
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
    );

    if (dmy) {
      date = validCalendarDate(
        Number(dmy[3]),
        Number(dmy[2]),
        Number(dmy[1]),
      );
    }

    /**
     * Also accept ISO YYYY-MM-DD from HTML date inputs/API clients.
     */
    if (!date) {
      const iso = raw.match(
        /^(\d{4})-(\d{2})-(\d{2})$/,
      );

      if (iso) {
        date = validCalendarDate(
          Number(iso[1]),
          Number(iso[2]),
          Number(iso[3]),
        );
      }
    }
  }

  if (!date) {
    return {
      valid: false,
      date: null,
      isoDate: null,
      year: null,
      error:
        "Enter a valid date of birth in DD/MM/YYYY format.",
    };
  }

  const today = new Date();

  const todayUtc = new Date(
    Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ),
  );

  if (date > todayUtc) {
    return {
      valid: false,
      date: null,
      isoDate: null,
      year: null,
      error:
        "Date of birth cannot be in the future.",
    };
  }

  const year = date.getUTCFullYear();

  if (year < 1900) {
    return {
      valid: false,
      date: null,
      isoDate: null,
      year: null,
      error:
        "Enter a valid date of birth.",
    };
  }

  return {
    valid: true,
    date,
    isoDate: isoDateOnly(date),
    year,
  };
}

/* =========================================================
   CONTROLLED-VALUE NORMALIZERS
========================================================= */

export function normalizeYouthInWorkRegion(
  value?: string | null,
) {
  return canonicalControlledValue(
    value,
    YIW_REGIONS,
    {
      "central region": "Central",
      "eastern region": "Eastern",
      "northern region": "Northern",
      "western region": "Western",
      east: "Eastern",
      north: "Northern",
      west: "Western",
    },
  );
}

export function normalizeYouthInWorkGender(
  value?: string | null,
) {
  return canonicalControlledValue(
    value,
    YIW_GENDERS,
  );
}

export function normalizeYouthInWorkBusinessSize(
  value?: string | null,
) {
  return canonicalControlledValue(
    value,
    YIW_BUSINESS_SIZES,
  );
}

export function normalizeYouthInWorkEducationLevel(
  value?: string | null,
) {
  return canonicalControlledValue(
    value,
    YIW_EDUCATION_LEVELS,
    {
      primary: "Primary Education",
      secondary: "Secondary Education",
      tertiary: "University",
      "vocational education":
        "Vocational/Technical Education",
      vocational:
        "Vocational/Technical Education",
      technical:
        "Vocational/Technical Education",
    },
  );
}

export function normalizeYouthInWorkEmploymentStatus(
  value?: string | null,
) {
  return canonicalControlledValue(
    value,
    YIW_EMPLOYMENT_STATUSES,
    {
      "self employment": "Self-Employment",
      "self employed": "Self-Employment",
      "self-employed": "Self-Employment",
      selfemployed: "Self-Employment",
      "wage employment": "Wage employment",
      "wage employed": "Wage employment",
    },
  );
}

export function normalizeYouthInWorkEmploymentType(
  value?: string | null,
) {
  return canonicalControlledValue(
    value,
    YIW_EMPLOYMENT_TYPES,
    {
      "part time": "Part-time",
      parttime: "Part-time",
      "full time": "Full-time",
      fulltime: "Full-time",
    },
  );
}
export function normalizeYouthInWorkSector(
  value?: string | null,
) {
  return canonicalControlledValue(
    value,
    YIW_SECTORS,
    {
      "trade and services":
        "Trade and Service",
      "trade & services":
        "Trade and Service",
      "trade and service":
        "Trade and Service",
      "meetings, incentives and conferences":
        "MICE",
      "meetings, incentives and conferences (mice)":
        "MICE",
      "meetings incentives and conferences":
        "MICE",
      "light manufacturing":
        "Light Manufacturing",
      "fashion and design":
        "Fashion",
    },
  );
}

/* =========================================================
   PARTICIPANT SUMMARY
========================================================= */

function participantSummary(
  participant: Participant,
  hasAssessment = false,
): YouthInWorkParticipantSummary {
  return {
    ...toParticipantSummary(participant),

    /**
     * ParticipantSummary expects sector as a string.
     * Prisma allows Participant.sector to be null.
     */
    sector:
      participant.sector || "",

    region:
      getYouthInWorkRegionForDistrict(
        participant.district,
      ) ||
      participant.region ||
      "",

    hasAssessment,

    dateOfBirth:
      isoDateOnly(
        participant.dateOfBirth,
      ),

    yearOfBirth:
      participant.yearOfBirth,

    gender:
      participant.gender,

    subcounty:
      participant.subcounty,

    parish:
      participant.parish,

    village:
      participant.village,

    businessName:
      participant.businessName,

    businessSize:
      participant.businessSize,

    employmentStatus:
      participant.employmentStatus,

    employmentType:
      participant.employmentType,

    educationLevel:
      participant.educationLevel,

    hasDisability:
      participant.hasDisability,

    disabilityType:
      participant.disabilityType,

    isRefugee:
      participant.isRefugee,

    countryOfOrigin:
      participant.countryOfOrigin,
  };
}

async function participantHasAssessment(
  participantId: string,
) {
  const assessment =
    await prisma().youthInWorkAssessment.findUnique({
      where: {
        participantId,
      },
      select: {
        id: true,
      },
    });

  return Boolean(assessment);
}

/* =========================================================
   PARTICIPANT SEARCH
========================================================= */

export async function searchYouthInWorkParticipants(
  query: string,
  esoName: string,
  limit = 20,
) {
  const search = normalizeText(query);
  const eso = normalizeEso(esoName);

  if (
    search.length < 2 ||
    !eso
  ) {
    return [];
  }

  const participants =
    await prisma().participant.findMany({
      where: {
        status: "active",
        esoName: eso,

        OR: [
          {
            fullName: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            phone: {
              contains: search,
            },
          },
          {
            externalId: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      },

      orderBy: {
        fullName: "asc",
      },

      take: Math.min(
        Math.max(limit, 1),
        30,
      ),
    });

  if (!participants.length) {
    return [];
  }

  const assessed = new Set(
    (
      await prisma().youthInWorkAssessment.findMany({
        where: {
          participantId: {
            in: participants.map(
              (participant) =>
                participant.id,
            ),
          },
        },

        select: {
          participantId: true,
        },
      })
    ).map(
      (assessment) =>
        assessment.participantId,
    ),
  );

  return participants.map(
    (participant) =>
      participantSummary(
        participant,
        assessed.has(
          participant.id,
        ),
      ),
  );
}

/* =========================================================
   DUPLICATE DETECTION
========================================================= */

export async function findPotentialYouthInWorkDuplicate(
  input: YouthInWorkAssessmentInput,
): Promise<DuplicateParticipantMatch | null> {
  const externalId =
    normalizeText(
      input.participantExternalId || "",
    ) || null;

  const phoneResult =
    input.participantPhone
      ? validateYouthInWorkPhone(
          input.participantPhone,
        )
      : null;

  const phone =
    phoneResult?.valid
      ? phoneResult.normalized
      : null;

  const email =
    cleanEmail(
      input.participantEmail,
    );

  const nameResult =
    validateYouthInWorkFullName(
      input.participantName || "",
    );

  const normalizedName =
    nameResult.normalized
      .toLowerCase();

  const district =
    clean(input.district);

  const selectedEso =
    normalizeEso(
      input.esoName || "",
    ) || null;

  const dob =
    input.dateOfBirth
      ? parseYouthInWorkDateOfBirth(
          input.dateOfBirth,
        )
      : null;

  /* Strong match 1: external ID */
  if (externalId) {
    const participant =
      await prisma().participant.findFirst({
        where: {
          status: "active",
          externalId: {
            equals: externalId,
            mode: "insensitive",
          },
        },
      });

    if (participant) {
      return {
        participant:
          participantSummary(
            participant,
            await participantHasAssessment(
              participant.id,
            ),
          ),
        matchReason:
          "external_id",
      };
    }
  }

  /* Strong match 2: normalized phone */
  if (phone) {
    const participant =
      await prisma().participant.findFirst({
        where: {
          status: "active",
          phone,
        },
      });

    if (participant) {
      return {
        participant:
          participantSummary(
            participant,
            await participantHasAssessment(
              participant.id,
            ),
          ),
        matchReason:
          "phone",
      };
    }
  }

  /* Strong match 3: email */
  if (email) {
    const participant =
      await prisma().participant.findFirst({
        where: {
          status: "active",
          email: {
            equals: email,
            mode: "insensitive",
          },
        },
      });

    if (participant) {
      return {
        participant:
          participantSummary(
            participant,
            await participantHasAssessment(
              participant.id,
            ),
          ),
        matchReason:
          "email",
      };
    }
  }

  /**
   * Strong identity combination:
   * full normalized name + DOB + district.
   */
  if (
    normalizedName &&
    dob?.valid &&
    dob.date &&
    district
  ) {
    const participant =
      await prisma().participant.findFirst({
        where: {
          status: "active",
          normalizedName,
          dateOfBirth: dob.date,
          district: {
            equals: district,
            mode: "insensitive",
          },
        },
      });

    if (participant) {
      return {
        participant:
          participantSummary(
            participant,
            await participantHasAssessment(
              participant.id,
            ),
          ),
        matchReason:
          "name_dob_district",
      };
    }
  }

  /**
   * Strong identity combination when district is missing:
   * name + DOB + same ESO.
   */
  if (
    normalizedName &&
    dob?.valid &&
    dob.date &&
    selectedEso
  ) {
    const participant =
      await prisma().participant.findFirst({
        where: {
          status: "active",
          normalizedName,
          dateOfBirth: dob.date,
          esoName: selectedEso,
        },
      });

    if (participant) {
      return {
        participant:
          participantSummary(
            participant,
            await participantHasAssessment(
              participant.id,
            ),
          ),
        matchReason:
          "name_dob_eso",
      };
    }
  }

  /**
   * Softer fallback for legacy participant records that do not
   * yet have DOB: name + district + ESO.
   *
   * Name alone is never considered enough to block registration.
   */
  if (
    normalizedName &&
    district &&
    selectedEso
  ) {
    const participant =
      await prisma().participant.findFirst({
        where: {
          status: "active",
          normalizedName,
          district: {
            equals: district,
            mode: "insensitive",
          },
          esoName: selectedEso,
        },
      });

    if (participant) {
      return {
        participant:
          participantSummary(
            participant,
            await participantHasAssessment(
              participant.id,
            ),
          ),
        matchReason:
          "name_district_eso",
      };
    }
  }

  return null;
}

/* =========================================================
   PROFILE NORMALIZATION / VALIDATION
========================================================= */

function validateControlledInput(
  label: string,
  originalValue:
    | string
    | undefined,
  normalizedValue:
    | string
    | null,
) {
  if (
    originalValue &&
    !normalizedValue
  ) {
    throw new Error(
      `${label} contains an invalid value.`,
    );
  }
}

function normalizedProfile(
  input: YouthInWorkAssessmentInput,
) {
  const nameResult =
    validateYouthInWorkFullName(
      input.participantName,
    );

  const phoneResult =
    input.participantPhone
      ? validateYouthInWorkPhone(
          input.participantPhone,
        )
      : null;

  const dobResult =
    input.dateOfBirth
      ? parseYouthInWorkDateOfBirth(
          input.dateOfBirth,
        )
      : null;

  const gender =
    normalizeYouthInWorkGender(
      input.gender,
    );

  const suppliedRegion =
    normalizeYouthInWorkRegion(
      input.region,
    );

  const districtRegion =
    getYouthInWorkRegionForDistrict(
      input.district,
    );

  if (
    districtRegion &&
    suppliedRegion &&
    districtRegion !== suppliedRegion
  ) {
    throw new Error(
      `Region ${suppliedRegion} does not match district ${clean(input.district)}. Expected ${districtRegion}.`,
    );
  }

  const region =
    districtRegion ||
    suppliedRegion;

  const sector =
    normalizeYouthInWorkSector(
      input.businessSector,
    );

  const businessSize =
    normalizeYouthInWorkBusinessSize(
      input.businessSize,
    );

  const employmentStatus =
    normalizeYouthInWorkEmploymentStatus(
      input.employmentStatus,
    );

  const employmentType =
    normalizeYouthInWorkEmploymentType(
      input.employmentType,
    );

  const educationLevel =
    normalizeYouthInWorkEducationLevel(
      input.educationLevel,
    );

  validateControlledInput(
    "Gender",
    input.gender,
    gender,
  );

  validateControlledInput(
    "Region",
    input.region,
    suppliedRegion,
  );

  validateControlledInput(
    "Enterprise sector",
    input.businessSector,
    sector,
  );

  validateControlledInput(
    "Business size",
    input.businessSize,
    businessSize,
  );

  validateControlledInput(
    "Employment status",
    input.employmentStatus,
    employmentStatus,
  );

  validateControlledInput(
    "Employment type",
    input.employmentType,
    employmentType,
  );

  validateControlledInput(
    "Education level",
    input.educationLevel,
    educationLevel,
  );

  if (
    input.dateOfBirth &&
    !dobResult?.valid
  ) {
    throw new Error(
      dobResult?.error ||
        "Enter a valid date of birth.",
    );
  }

  if (
    input.participantPhone &&
    !phoneResult?.valid
  ) {
    throw new Error(
      phoneResult?.error ||
        "Enter a valid phone number.",
    );
  }

  return {
    nameResult,
    phoneResult,
    dobResult,
    gender,
    region,
    sector,
    businessSize,
    employmentStatus,
    employmentType,
    educationLevel,
  };
}

/* =========================================================
   UPDATE EXISTING PARTICIPANT PROFILE
========================================================= */

async function updateParticipantProfile(
  participantId: string,
  input: YouthInWorkAssessmentInput,
) {
  const profile =
    normalizedProfile(input);

  const data: Prisma.ParticipantUpdateInput =
    {};

  if (
    profile.phoneResult?.valid
  ) {
    data.phone =
      profile.phoneResult.normalized;
  }

  const email =
    cleanEmail(
      input.participantEmail,
    );

  if (email) {
    data.email = email;
  }

  if (profile.dobResult?.valid) {
    data.dateOfBirth =
      profile.dobResult.date;

    data.yearOfBirth =
      profile.dobResult.year;
  }

  if (profile.gender) {
    data.gender =
      profile.gender;
  }

  if (profile.region) {
    data.region =
      profile.region;
  }

  if (clean(input.district)) {
    data.district =
      clean(input.district);
  }

  if (clean(input.subcounty)) {
    data.subcounty =
      clean(input.subcounty);
  }

  if (clean(input.parish)) {
    data.parish =
      clean(input.parish);
  }

  if (clean(input.village)) {
    data.village =
      clean(input.village);
  }

  if (clean(input.businessName)) {
    data.businessName =
      clean(input.businessName);
  }

  if (profile.sector) {
    data.sector =
      profile.sector;
  }

  if (profile.businessSize) {
    data.businessSize =
      profile.businessSize;
  }

  if (profile.employmentStatus) {
    data.employmentStatus =
      profile.employmentStatus;
  }

  if (profile.employmentType) {
    data.employmentType =
      profile.employmentType;
  }

  if (profile.educationLevel) {
    data.educationLevel =
      profile.educationLevel;
  }

  if (
    typeof input.hasDisability ===
    "boolean"
  ) {
    data.hasDisability =
      input.hasDisability;

    data.disabilityType =
      input.hasDisability
        ? clean(
            input.disabilityType,
          )
        : null;
  }

  if (
    typeof input.isRefugee ===
    "boolean"
  ) {
    data.isRefugee =
      input.isRefugee;

    data.countryOfOrigin =
      input.isRefugee
        ? clean(
            input.countryOfOrigin,
          )
        : null;
  }

  return prisma().participant.update({
    where: {
      id: participantId,
    },
    data,
  });
}

/* =========================================================
   CREATE OR USE PARTICIPANT
========================================================= */

export async function searchYouthInWorkEmployers(
  query: string,
  esoName: string,
  limit = 30,
) {
  const search =
    normalizeText(query);

  const requestedEso =
    normalizeEso(esoName);

  if (
    search.length < 2 ||
    !requestedEso
  ) {
    return [];
  }

  const esoRecord =
    await prisma().eso.findFirst({
      where: {
        status: "active",
        OR: [
          {
            name: {
              equals: requestedEso,
              mode: "insensitive",
            },
          },
          {
            code: {
              equals: requestedEso,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
      },
    });

  const candidates =
    await prisma().participant.findMany({
      where: {
        status: "active",
        OR: [
          {
            fullName: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            phone: {
              contains: search,
            },
          },
          {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            externalId: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      },

      orderBy: {
        fullName: "asc",
      },

      take: 200,

      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        externalId: true,
        esoId: true,
        esoName: true,
        district: true,
        region: true,
        businessName: true,
        sector: true,
        businessSize: true,
        employmentStatus: true,
        employmentType: true,
      },
    });

  return candidates
    .filter((participant) => {
      const isSelfEmployed =
        normalizeYouthInWorkEmploymentStatus(
          participant.employmentStatus,
        ) === "Self-Employment";

      const sameEso =
        esoRecord?.id &&
        participant.esoId
          ? participant.esoId === esoRecord.id
          : normalizeEso(
              participant.esoName,
            ) === requestedEso;

      return (
        isSelfEmployed &&
        sameEso
      );
    })
    .slice(
      0,
      Math.min(
        Math.max(limit, 1),
        50,
      ),
    )
    .map((participant) => ({
      ...participant,
      hasAssessment: false,
    }));
}

export async function createOrUseYouthInWorkParticipant(
  input: YouthInWorkAssessmentInput,
) {
  const requestedEso =
    normalizeEso(
      input.esoName || "",
    ) || null;

  /*
   * EXISTING PARTICIPANT
   */
  if (input.participantId) {
    const participant =
      await prisma().participant.findFirst({
        where: {
          id: input.participantId,
          status: "active",
        },
      });

    if (!participant) {
      throw new Error(
        "The selected participant could not be found.",
      );
    }

    if (
      requestedEso &&
      normalizeEso(
        participant.esoName,
      ) !== requestedEso
    ) {
      throw new Error(
        `This participant belongs to ${participant.esoName}, not ${requestedEso}.`,
      );
    }

    return updateParticipantProfile(
      participant.id,
      input,
    );
  }

  /*
   * NEW PARTICIPANT DATA QUALITY
   */
  const profile =
    normalizedProfile(input);

  if (!profile.nameResult.valid) {
    throw new Error(
      profile.nameResult.error ||
        "Enter a valid participant full name.",
    );
  }

  if (
    !profile.phoneResult?.valid
  ) {
    throw new Error(
      profile.phoneResult?.error ||
        "Enter a valid participant phone number.",
    );
  }

  if (
    !profile.dobResult?.valid ||
    !profile.dobResult.date
  ) {
    throw new Error(
      profile.dobResult?.error ||
        "Date of birth is required for a new participant.",
    );
  }

  if (!profile.gender) {
    throw new Error(
      "Select the participant's gender.",
    );
  }

  if (!profile.region) {
    throw new Error(
      "Select the participant's region.",
    );
  }

  if (!clean(input.district)) {
    throw new Error(
      "Select the participant's district.",
    );
  }

  if (!clean(input.subcounty)) {
    throw new Error(
      "Enter the participant's Subcounty / Town Council.",
    );
  }

  if (!clean(input.parish)) {
    throw new Error(
      "Enter the participant's Parish / Ward.",
    );
  }

  if (!clean(input.village)) {
    throw new Error(
      "Enter the participant's Village / Cell.",
    );
  }




  if (
    profile.employmentType !== "Part-time" &&
    profile.employmentType !== "Full-time"
  ) {
    throw new Error(
      "New workers must have an employment type of Part-time or Full-time.",
    );
  }

  if (
    !profile.educationLevel
  ) {
    throw new Error(
      "Select the participant's education level.",
    );
  }

  if (
    typeof input.hasDisability !==
    "boolean"
  ) {
    throw new Error(
      "Select the participant's disability status.",
    );
  }

  if (
    input.hasDisability === true &&
    !clean(input.disabilityType)
  ) {
    throw new Error(
      "Select the participant's disability type.",
    );
  }

  if (
    typeof input.isRefugee !==
    "boolean"
  ) {
    throw new Error(
      "Select the participant's refugee status.",
    );
  }

  if (
    input.isRefugee === true &&
    !clean(input.countryOfOrigin)
  ) {
    throw new Error(
      "Select the participant's country of origin.",
    );
  }

  /*
   * NEW PARTICIPANT DUPLICATE CHECK
   */
  const duplicate =
    await findPotentialYouthInWorkDuplicate(
      input,
    );

  if (duplicate) {
    throw new ExistingYouthInWorkParticipantError(
      duplicate,
    );
  }

  const esoName =
    requestedEso ||
    normalizeText(
      input.esoName || "",
    ) ||
    "Outreach";

  const esoRecord =
    await prisma().eso.findFirst({
      where: {
        status: "active",
        OR: [
          {
            name: {
              equals: esoName,
              mode: "insensitive",
            },
          },
          {
            code: {
              equals: esoName,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

  if (!esoRecord) {
    throw new Error(
      `The selected ESO (${esoName}) could not be matched to an active ESO record.`,
    );
  }

  let employerParticipantId: string | null = null;

  {
    const requestedEmployerId =
      clean(input.employerParticipantId);

    if (!requestedEmployerId) {
      throw new Error(
        "Select the supported entrepreneur who created this job.",
      );
    }

    const employer =
      await prisma().participant.findFirst({
        where: {
          id: requestedEmployerId,
          status: "active",
        },
        select: {
          id: true,
          fullName: true,
          esoId: true,
          esoName: true,
          employmentStatus: true,
        },
      });

    if (!employer) {
      throw new Error(
        "The selected employer could not be found.",
      );
    }

    const employerEmploymentStatus =
      normalizeYouthInWorkEmploymentStatus(
        employer.employmentStatus,
      );

    if (
      employerEmploymentStatus !== "Self-Employment"
    ) {
      throw new Error(
        "The selected employer must be an existing Self-employed entrepreneur.",
      );
    }

    const employerMatchesEso =
      employer.esoId
        ? employer.esoId === esoRecord.id
        : normalizeEso(employer.esoName) ===
          normalizeEso(esoRecord.name);

    if (!employerMatchesEso) {
      throw new Error(
        "The selected supported entrepreneur must belong to the selected ESO.",
      );
    }

    employerParticipantId =
      employer.id;
  }

  try {
    return await prisma().participant.create({
      data: {
        fullName:
          profile.nameResult.normalized,

        normalizedName:
          profile.nameResult.normalized.toLowerCase(),

        phone:
          profile.phoneResult.normalized,

        email:
          cleanEmail(
            input.participantEmail,
          ),

        externalId:
          normalizeText(
            input.participantExternalId || "",
          ) || null,

        esoName:
          esoRecord.name,

        esoCode:
          esoRecord.code,

        esoId:
          esoRecord.id,

        employerParticipantId,

        dateOfBirth:
          profile.dobResult.date,

        yearOfBirth:
          profile.dobResult.year,

        gender:
          profile.gender,

        region:
          profile.region,

        district:
          clean(input.district),

        subcounty:
          clean(input.subcounty),

        parish:
          clean(input.parish),

        village:
          clean(input.village),

        /*
         * This participant is a worker created by a supported
         * entrepreneur. Business ownership remains on employer.
         */
        businessName: null,

        sector: null,

        businessSize: null,

        employmentStatus:
          "Wage employment",

        employmentType:
          profile.employmentType,

        educationLevel:
          profile.educationLevel,

        hasDisability:
          input.hasDisability,

        disabilityType:
          input.hasDisability
            ? clean(
                input.disabilityType,
              )
            : null,

        isRefugee:
          input.isRefugee,

        countryOfOrigin:
          input.isRefugee
            ? clean(
                input.countryOfOrigin,
              )
            : null,

        source:
          "youth_in_work_tool",

        status:
          "active",
      },
    });
  } catch (error) {
    /**
     * If a unique external ID raced with another request,
     * re-run duplicate detection and return the participant
     * rather than exposing a raw Prisma error.
     */
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const match =
        await findPotentialYouthInWorkDuplicate(
          input,
        );

      if (match) {
        throw new ExistingYouthInWorkParticipantError(
          match,
        );
      }
    }

    throw error;
  }
}

/* =========================================================
   CREATE ASSESSMENT
========================================================= */

export async function createYouthInWorkAssessment(
  input: YouthInWorkAssessmentInput,
) {
  const participant =
    await createOrUseYouthInWorkParticipant(
      input,
    );

  const existing =
    await prisma().youthInWorkAssessment.findUnique({
      where: {
        participantId:
          participant.id,
      },

      select: {
        id: true,
      },
    });

  if (existing) {
    throw duplicateAssessmentError();
  }

  const profile =
    normalizedProfile({
      ...input,
      participantName:
        participant.fullName,
    });

  const latitude =
    Number.isFinite(
      input.gpsLatitude,
    )
      ? input.gpsLatitude
      : null;

  const longitude =
    Number.isFinite(
      input.gpsLongitude,
    )
      ? input.gpsLongitude
      : null;

  const accuracy =
    Number.isFinite(
      input.gpsAccuracy,
    )
      ? input.gpsAccuracy
      : null;

  const hasGps =
    latitude !== null &&
    longitude !== null;

  let gpsCapturedAt:
    | Date
    | null = null;

  if (input.gpsCapturedAt) {
    const parsed = new Date(
      input.gpsCapturedAt,
    );

    if (
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      gpsCapturedAt = parsed;
    }
  } else if (hasGps) {
    gpsCapturedAt =
      new Date();
  }

  const incomeAmount =
    Number.isInteger(
      input.incomeAmount,
    ) &&
    Number(
      input.incomeAmount,
    ) >= 0
      ? Number(
          input.incomeAmount,
        )
      : null;

  try {
    const assessment =
      await prisma().youthInWorkAssessment.create({
        data: {
          participantId:
            participant.id,

          participantName:
            participant.fullName,

          participantPhone:
            participant.phone,

          participantEmail:
            participant.email,

          participantExternalId:
            participant.externalId,

          esoName:
            participant.esoName ||
            input.esoName ||
            "Outreach",

          // Participant snapshot
          dateOfBirth:
            participant.dateOfBirth ||
            profile.dobResult?.date ||
            null,

          yearOfBirth:
            participant.yearOfBirth ??
            profile.dobResult?.year ??
            input.yearOfBirth ??
            null,

          gender:
            participant.gender ||
            profile.gender ||
            clean(input.gender),

          region:
            getYouthInWorkRegionForDistrict(
              participant.district,
            ) ||
            participant.region ||
            profile.region ||
            clean(input.region),

          district:
            participant.district ||
            clean(input.district),

          subcounty:
            participant.subcounty ||
            clean(input.subcounty),

          parish:
            participant.parish ||
            clean(input.parish),

          village:
            participant.village ||
            clean(input.village),

          businessName:
            participant.businessName ||
            clean(
              input.businessName,
            ),

          businessSector:
            participant.sector ||
            profile.sector ||
            clean(
              input.businessSector,
            ),

          businessSize:
            participant.businessSize ||
            profile.businessSize ||
            clean(
              input.businessSize,
            ),

          employmentStatus:
            participant.employmentStatus ||
            profile.employmentStatus ||
            clean(
              input.employmentStatus,
            ),

          employmentType:
            participant.employmentType ||
            profile.employmentType ||
            clean(
              input.employmentType,
            ),

          educationLevel:
            participant.educationLevel ||
            profile.educationLevel ||
            clean(
              input.educationLevel,
            ),

          hasDisability:
            participant.hasDisability ??
            input.hasDisability ??
            null,

          disabilityType:
            participant.hasDisability ===
            true
              ? participant.disabilityType ||
                clean(
                  input.disabilityType,
                )
              : input.hasDisability ===
                  true
                ? clean(
                    input.disabilityType,
                  )
                : null,

          isRefugee:
            participant.isRefugee ??
            input.isRefugee ??
            null,

          countryOfOrigin:
            participant.isRefugee ===
            true
              ? participant.countryOfOrigin ||
                clean(
                  input.countryOfOrigin,
                )
              : input.isRefugee ===
                  true
                ? clean(
                    input.countryOfOrigin,
                  )
                : null,

          // Foundation Course
          foundationCourseStatus:
            clean(
              input.foundationCourseStatus,
            ),

          foundationLearning:
            clean(
              input.foundationLearning,
            ),

          // Income
          incomeFromProgram:
            clean(
              input.incomeFromProgram,
            ),

          incomeAmount,

          // Working conditions
          workImproved:
            clean(
              input.workImproved,
            ),

          workImprovementDescription:
            input.workImproved ===
            "yes"
              ? clean(
                  input.workImprovementDescription,
                )
              : null,

          improvementOutcomes:
            input.workImproved ===
            "yes"
              ? cleanArray(
                  input.improvementOutcomes,
                )
              : [],

          // Digital adoption
          digitalMarketsAccess:
            input.digitalMarketsAccess ===
            true,

          digitalMarketPlatforms:
            input.digitalMarketsAccess ===
            true
              ? cleanArray(
                  input.digitalMarketPlatforms,
                )
              : [],

          digitalFinanceAccess:
            input.digitalFinanceAccess ===
            true,

          digitalFinanceProviders:
            input.digitalFinanceAccess ===
            true
              ? cleanArray(
                  input.digitalFinanceProviders,
                )
              : [],

          businessEfficiencyAccess:
            input.businessEfficiencyAccess ===
            true,

          businessEfficiencyPlatforms:
            input.businessEfficiencyAccess ===
            true
              ? cleanArray(
                  input.businessEfficiencyPlatforms,
                )
              : [],

          // Existing compatibility fields
          youthInWorkStatus:
            normalizeText(
              input.youthInWorkStatus ||
              "captured",
            ),

          trainingInterest:
            clean(
              input.trainingInterest,
            ),

          supportNeeded:
            cleanArray(
              input.supportNeeded,
            ),

          notes:
            clean(
              input.notes,
            ),

          evidenceFileKey:
            clean(
              input.evidenceFileKey,
            ),

          assessorName:
            clean(
              input.assessorName,
            ),

          // Silent GPS
          gpsCaptureStatus:
            clean(
              input.gpsCaptureStatus,
            ) ||
            (hasGps
              ? "captured"
              : "not_available"),

          gpsLatitude:
            latitude,

          gpsLongitude:
            longitude,

          gpsAccuracy:
            accuracy,

          gpsCapturedAt,

          gpsCaptureError:
            clean(
              input.gpsCaptureError,
            ),

          assessmentDate:
            new Date(),

          source:
            "youth_in_work_tool",

          status:
            "submitted",
        },
      });

    return {
      participant,
      assessment,
    };
  } catch (error) {
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw duplicateAssessmentError();
    }

    throw error;
  }
}

/* =========================================================
   REPORTING
========================================================= */

export async function getYouthInWorkAssessments() {
  return prisma().youthInWorkAssessment.findMany({
    include: {
      participant: {
        select: {
          employerParticipantId: true,

          employer: {
            select: {
              id: true,
              externalId: true,
              fullName: true,
              phone: true,
              businessName: true,
              sector: true,
              employmentStatus: true,
              employmentType: true,
              esoName: true,
            },
          },
        },
      },
    },

    orderBy: {
      assessmentDate: "desc",
    },
  });
}
