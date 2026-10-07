// app/api/youth-in-work/assessments/route.ts

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { saveDataImage } from "@/lib/storage";

import {
  createYouthInWorkAssessment,
  ExistingYouthInWorkParticipantError,
  getYouthInWorkAssessments,
  getYouthInWorkRegionForDistrict,
  normalizeYouthInWorkBusinessSize,
  normalizeYouthInWorkEducationLevel,
  normalizeYouthInWorkEmploymentStatus,
  normalizeYouthInWorkEmploymentType,
  normalizeYouthInWorkGender,
  normalizeYouthInWorkRegion,
  normalizeYouthInWorkSector,
  parseYouthInWorkDateOfBirth,
  validateYouthInWorkFullName,
  validateYouthInWorkPhone,
} from "@/lib/youthInWork";

export const dynamic = "force-dynamic";

/* =========================================================
   HELPERS
========================================================= */

function text(value: unknown) {
  return String(value ?? "").trim();
}

function optionalText(value: unknown) {
  const valueAsText = text(value);
  return valueAsText || undefined;
}

function optionalNumber(value: unknown) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : undefined;
}

function optionalNonNegativeInteger(value: unknown) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  const raw = String(value).trim();

  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function optionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = text(value).toLowerCase();

  if (
    normalized === "yes" ||
    normalized === "true" ||
    normalized === "1"
  ) {
    return true;
  }

  if (
    normalized === "no" ||
    normalized === "false" ||
    normalized === "0"
  ) {
    return false;
  }

  return undefined;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => text(item))
          .filter(Boolean),
      ),
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(/[,;\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  return [];
}

function validEmail(value: string) {
  if (!value) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function badRequest(error: string) {
  return NextResponse.json(
    { error },
    { status: 400 },
  );
}

/* =========================================================
   GET
========================================================= */

export async function GET() {
  try {
    const assessments =
      await getYouthInWorkAssessments();

    return NextResponse.json({
      assessments,
    });
  } catch (error) {
    console.error(
      "Could not load YIW assessments:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Could not load Youth in Work assessments.",
      },
      {
        status: 500,
      },
    );
  }
}

/* =========================================================
   POST
========================================================= */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const participantId =
      optionalText(body.participantId);

    const participantName =
      text(body.participantName);

    const esoName =
      text(body.esoName);

    const phone =
      text(body.participantPhone);

    const email =
      text(body.participantEmail);

    /* -----------------------------------------------------
       BASIC IDENTITY VALIDATION
    ----------------------------------------------------- */

    if (!participantName) {
      return badRequest(
        "Participant full name is required.",
      );
    }

    if (!esoName) {
      return badRequest(
        "Entrepreneur Support Organization is required.",
      );
    }

    /*
     * New participants must meet the strict full-name rule.
     * Existing Outreach participants may contain legacy names,
     * so we do not reject them on this rule unless registering new.
     */
    if (!participantId) {
      const nameResult =
        validateYouthInWorkFullName(
          participantName,
        );

      if (!nameResult.valid) {
        return badRequest(
          nameResult.error ||
            "Enter the participant's complete full name.",
        );
      }
    }

    /*
     * If a phone is present at all, it must be a real phone value.
     * New participants must have one.
     */
    if (!participantId && !phone) {
      return badRequest(
        "Phone number is required for a new participant.",
      );
    }

    if (phone) {
      const phoneResult =
        validateYouthInWorkPhone(phone);

      if (!phoneResult.valid) {
        return badRequest(
          phoneResult.error ||
            "Enter a valid phone number.",
        );
      }
    }

    if (!participantId && !email) {
      return badRequest(
        "Primary email is required for a new participant.",
      );
    }

    if (email && !validEmail(email)) {
      return badRequest(
        "Enter a valid primary email address.",
      );
    }

    /* -----------------------------------------------------
       DOB + CONTROLLED PROFILE VALUES
    ----------------------------------------------------- */

    const dateOfBirthRaw =
      optionalText(body.dateOfBirth);

    let dateOfBirth:
      | string
      | undefined;

    if (dateOfBirthRaw) {
      const dobResult =
        parseYouthInWorkDateOfBirth(
          dateOfBirthRaw,
        );

      if (
        !dobResult.valid ||
        !dobResult.isoDate
      ) {
        return badRequest(
          dobResult.error ||
            "Enter a valid date of birth in DD/MM/YYYY format.",
        );
      }

      dateOfBirth =
        dobResult.isoDate;

      if (!participantId) {
        const dob = new Date(
          `${dobResult.isoDate}T00:00:00Z`
        );

        const now = new Date();

        const todayUtc = new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
          )
        );

        let age =
          todayUtc.getUTCFullYear() -
          dob.getUTCFullYear();

        const birthdayThisYear = new Date(
          Date.UTC(
            todayUtc.getUTCFullYear(),
            dob.getUTCMonth(),
            dob.getUTCDate()
          )
        );

        if (todayUtc < birthdayThisYear) {
          age -= 1;
        }

        if (age < 18 || age > 37) {
          return badRequest(
            "New participants must be aged 18 to 37 years."
          );
        }
      }
    } else if (!participantId) {
      return badRequest(
        "Date of birth is required for a new participant.",
      );
    }

    const genderRaw =
      optionalText(body.gender);

    const gender =
      genderRaw
        ? normalizeYouthInWorkGender(
            genderRaw,
          )
        : null;

    if (
      genderRaw &&
      !gender
    ) {
      return badRequest(
        "Gender must be Male or Female.",
      );
    }

    if (
      !participantId &&
      !gender
    ) {
      return badRequest(
        "Gender is required for a new participant.",
      );
    }

    const district =
      optionalText(body.district);

    const regionRaw =
      optionalText(body.region);

    const suppliedRegion =
      regionRaw
        ? normalizeYouthInWorkRegion(
            regionRaw,
          )
        : null;

    if (
      regionRaw &&
      !suppliedRegion
    ) {
      return badRequest(
        "Region must be Central, Eastern, Northern or Western.",
      );
    }

    const districtRegion =
      district
        ? getYouthInWorkRegionForDistrict(
            district,
          )
        : null;

    if (
      !participantId &&
      district &&
      !districtRegion
    ) {
      return badRequest(
        "Select a valid Ugandan district.",
      );
    }

    if (
      districtRegion &&
      suppliedRegion &&
      districtRegion !== suppliedRegion
    ) {
      return badRequest(
        `Region ${suppliedRegion} does not match district ${district}. Expected ${districtRegion}.`,
      );
    }

    const region =
      districtRegion ||
      suppliedRegion;

    if (
      !participantId &&
      !region
    ) {
      return badRequest(
        "Region could not be determined from the selected district.",
      );
    }

    const sectorRaw =
      optionalText(body.businessSector);

    const businessSector =
      sectorRaw
        ? normalizeYouthInWorkSector(
            sectorRaw,
          )
        : null;

    if (
      sectorRaw &&
      !businessSector
    ) {
      return badRequest(
        "Select a valid enterprise sector.",
      );
    }

    if (participantId && !businessSector) {
      return badRequest(
        "Enterprise sector is required.",
      );
    }

    const businessSizeRaw =
      optionalText(body.businessSize);

    const businessSize =
      businessSizeRaw
        ? normalizeYouthInWorkBusinessSize(
            businessSizeRaw,
          )
        : null;

    if (
      businessSizeRaw &&
      !businessSize
    ) {
      return badRequest(
        "Business size must be Micro, Small or Medium.",
      );
    }


    const employmentStatusRaw =
      optionalText(
        body.employmentStatus,
      );

    const employmentStatus =
      employmentStatusRaw
        ? normalizeYouthInWorkEmploymentStatus(
            employmentStatusRaw,
          )
        : null;

    if (
      employmentStatusRaw &&
      !employmentStatus
    ) {
      return badRequest(
        "Employment status must be Self-Employment or Wage employment.",
      );
    }

    const employmentTypeRaw =
      optionalText(
        body.employmentType,
      );

    const employmentType =
      employmentTypeRaw
        ? normalizeYouthInWorkEmploymentType(
            employmentTypeRaw,
          )
        : null;

    if (
      employmentTypeRaw &&
      !employmentType
    ) {
      return badRequest(
        "Employment type must be Part-time or Full-time.",
      );
    }

    if (
      !participantId &&
      !employmentType
    ) {
      return badRequest(
        "Employment type is required for a new worker.",
      );
    }

    const educationRaw =
      optionalText(body.educationLevel);

    const educationLevel =
      educationRaw
        ? normalizeYouthInWorkEducationLevel(
            educationRaw,
          )
        : null;

    if (
      educationRaw &&
      !educationLevel
    ) {
      return badRequest(
        "Select a valid education level.",
      );
    }

    if (
      !participantId &&
      !educationLevel
    ) {
      return badRequest(
        "Highest level of education is required for a new participant.",
      );
    }

    /* -----------------------------------------------------
       NEW PARTICIPANT LOCATION / BUSINESS PROFILE
    ----------------------------------------------------- */

    if (!participantId) {
      if (!district) {
        return badRequest(
          "District is required for a new participant.",
        );
      }

      if (!text(body.subcounty)) {
        return badRequest(
          "Subcounty / Town Council is required for a new participant.",
        );
      }

      if (!text(body.parish)) {
        return badRequest(
          "Parish / Ward is required for a new participant.",
        );
      }

      if (!text(body.village)) {
        return badRequest(
          "Village / Cell is required for a new participant.",
        );
      }


    }

    /* -----------------------------------------------------
       INCLUSION PROFILE
    ----------------------------------------------------- */

    const hasDisability =
      optionalBoolean(
        body.hasDisability,
      );

    if (
      !participantId &&
      hasDisability === undefined
    ) {
      return badRequest(
        "Disability status is required for a new participant.",
      );
    }

    if (
      hasDisability === true &&
      !text(body.disabilityType)
    ) {
      return badRequest(
        "Select the participant's disability type.",
      );
    }

    const isRefugee =
      optionalBoolean(
        body.isRefugee,
      );

    if (
      !participantId &&
      isRefugee === undefined
    ) {
      return badRequest(
        "Refugee status is required for a new participant.",
      );
    }

    if (
      isRefugee === true &&
      !text(body.countryOfOrigin)
    ) {
      return badRequest(
        "Country of origin is required for a refugee participant.",
      );
    }

    /* -----------------------------------------------------
       FOUNDATION COURSE
    ----------------------------------------------------- */

    const foundationCourseStatus =
      text(
        body.foundationCourseStatus,
      );

    if (!foundationCourseStatus) {
      return badRequest(
        "Foundation Course status is required.",
      );
    }

    const foundationStatus =
      foundationCourseStatus.toLowerCase();

    if (
      [
        "yes",
        "currently_enrolled",
        "started_but_not_completed",
      ].includes(foundationStatus) &&
      !text(body.foundationLearning)
    ) {
      return badRequest(
        "Complete the Foundation Course learning question.",
      );
    }

    /* -----------------------------------------------------
       INCOME
    ----------------------------------------------------- */

    const incomeFromProgram =
      text(
        body.incomeFromProgram,
      ).toLowerCase();

    if (
      !["yes", "no"].includes(
        incomeFromProgram,
      )
    ) {
      return badRequest(
        "Answer whether income was earned as a result of the 10X Program.",
      );
    }

    let incomeAmount:
      | number
      | undefined;

    if (
      incomeFromProgram === "yes"
    ) {
      const parsedIncome =
        optionalNonNegativeInteger(
          body.incomeAmount,
        );

      if (
        parsedIncome === undefined ||
        parsedIncome === null
      ) {
        return badRequest(
          "Income amount must contain numbers only.",
        );
      }

      incomeAmount =
        parsedIncome;
    }

    /* -----------------------------------------------------
       WORKING CONDITIONS - INDEPENDENT FROM INCOME
    ----------------------------------------------------- */

    const workImproved =
      text(
        body.workImproved,
      ).toLowerCase();

    if (
      !["yes", "no"].includes(
        workImproved,
      )
    ) {
      return badRequest(
        "Answer whether working conditions have improved.",
      );
    }

    const improvementOutcomes =
      stringArray(
        body.improvementOutcomes,
      );

    if (
      workImproved === "yes" &&
      !text(
        body.workImprovementDescription,
      )
    ) {
      return badRequest(
        "Describe how the participant's work improved.",
      );
    }

    if (
      workImproved === "yes" &&
      !improvementOutcomes.length
    ) {
      return badRequest(
        "Select at least one improvement outcome.",
      );
    }

    /* -----------------------------------------------------
       DIGITAL ADOPTION
    ----------------------------------------------------- */

    const digitalMarketsAccess =
      optionalBoolean(
        body.digitalMarketsAccess,
      ) ?? false;

    const digitalFinanceAccess =
      optionalBoolean(
        body.digitalFinanceAccess,
      ) ?? false;

    const businessEfficiencyAccess =
      optionalBoolean(
        body.businessEfficiencyAccess,
      ) ?? false;

    const digitalMarketPlatforms =
      stringArray(
        body.digitalMarketPlatforms,
      );

    const digitalFinanceProviders =
      stringArray(
        body.digitalFinanceProviders,
      );

    const businessEfficiencyPlatforms =
      stringArray(
        body.businessEfficiencyPlatforms,
      );

    if (
      digitalMarketsAccess &&
      !digitalMarketPlatforms.length
    ) {
      return badRequest(
        "Select or enter the digital market platform used.",
      );
    }

    if (
      digitalFinanceAccess &&
      !digitalFinanceProviders.length
    ) {
      return badRequest(
        "Select or enter the digital finance provider used.",
      );
    }

    if (
      businessEfficiencyAccess &&
      !businessEfficiencyPlatforms.length
    ) {
      return badRequest(
        "Select or enter the digital platform or tool used to improve business efficiency.",
      );
    }

    /* -----------------------------------------------------
       EVIDENCE PHOTO

       The browser sends the selected JPEG/PNG as a data URL.
       Save it before creating the database record so the
       assessment never points at a file that failed to save.
    ----------------------------------------------------- */

    const evidencePhotoData =
      optionalText(
        body.evidencePhotoData,
      );

    if (
      evidencePhotoData &&
      !/^data:image\/(?:jpeg|png);base64,/i.test(
        evidencePhotoData,
      )
    ) {
      return badRequest(
        "Evidence photo must be a JPEG or PNG image.",
      );
    }

    /*
     * Around 8 MB of base64 data. The UI will enforce a
     * smaller source-file limit as well.
     */
    if (
      evidencePhotoData &&
      evidencePhotoData.length > 8_000_000
    ) {
      return badRequest(
        "Evidence photo is too large. Upload an image smaller than 5 MB.",
      );
    }

    let evidenceFileKey:
      | string
      | undefined;

    if (evidencePhotoData) {
      const savedEvidenceFileKey =
        await saveDataImage(
          `yiw-${randomUUID()}`,
          "evidence-photo",
          evidencePhotoData,
        );

      evidenceFileKey =
        savedEvidenceFileKey ||
        undefined;
    }
    /* -----------------------------------------------------
       CREATE ASSESSMENT
    ----------------------------------------------------- */

    const result =
      await createYouthInWorkAssessment({
        participantId,

        participantName,

        participantPhone:
          optionalText(
            body.participantPhone,
          ),

        participantEmail:
          optionalText(
            body.participantEmail,
          ),

        participantExternalId:
          optionalText(
            body.participantExternalId,
          ),

        esoName,

        // Demographics
        dateOfBirth,

        /*
         * Legacy compatibility only.
         * v3 derives year from dateOfBirth in lib/youthInWork.ts.
         */
        yearOfBirth:
          optionalNumber(
            body.yearOfBirth,
          ),

        gender:
          gender || undefined,

        // Location
        region:
          region || undefined,

        district,

        subcounty:
          optionalText(
            body.subcounty,
          ),

        parish:
          optionalText(
            body.parish,
          ),

        village:
          optionalText(
            body.village,
          ),

        // Enterprise / employment
        businessName:
          optionalText(
            body.businessName,
          ),

        businessSector:
          businessSector ||
          undefined,

        businessSize:
          businessSize ||
          undefined,

        employmentStatus:
          employmentStatus ||
          undefined,

        employerParticipantId:
          optionalText(
            body.employerParticipantId,
          ),

        educationLevel:
          educationLevel ||
          undefined,

        // Inclusion
        hasDisability,

        disabilityType:
          optionalText(
            body.disabilityType,
          ),

        isRefugee,

        countryOfOrigin:
          optionalText(
            body.countryOfOrigin,
          ),

        // Foundation
        foundationCourseStatus,

        foundationLearning:
          optionalText(
            body.foundationLearning,
          ),

        // Income
        incomeFromProgram,
        incomeAmount,

        // Working conditions
        workImproved,

        workImprovementDescription:
          optionalText(
            body.workImprovementDescription,
          ),

        improvementOutcomes,

        // Digital adoption
        digitalMarketsAccess,
        digitalMarketPlatforms,

        digitalFinanceAccess,
        digitalFinanceProviders,

        businessEfficiencyAccess,
        businessEfficiencyPlatforms,

        // Compatibility field
        youthInWorkStatus:
          text(
            body.youthInWorkStatus,
          ) || "captured",

        trainingInterest:
          optionalText(
            body.trainingInterest,
          ),

        supportNeeded:
          stringArray(
            body.supportNeeded,
          ),

        notes:
          optionalText(
            body.notes,
          ),

        evidenceFileKey,

        assessorName:
          optionalText(
            body.assessorName,
          ),

        // Silent GPS
        gpsCaptureStatus:
          optionalText(
            body.gpsCaptureStatus,
          ),

        gpsLatitude:
          optionalNumber(
            body.gpsLatitude,
          ),

        gpsLongitude:
          optionalNumber(
            body.gpsLongitude,
          ),

        gpsAccuracy:
          optionalNumber(
            body.gpsAccuracy,
          ),

        gpsCapturedAt:
          optionalText(
            body.gpsCapturedAt,
          ),

        gpsCaptureError:
          optionalText(
            body.gpsCaptureError,
          ),
      });

    return NextResponse.json(
      {
        participant:
          result.participant,

        assessment:
          result.assessment,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    /*
     * Proposed-new participant already exists.
     * Return the actual participant so the UI can offer
     * "Use existing participant" rather than creating a duplicate.
     */
    if (
      error instanceof
      ExistingYouthInWorkParticipantError
    ) {
      return NextResponse.json(
        {
          error:
            error.message,

          code:
            error.code,

          matchReason:
            error.match.matchReason,

          participant:
            error.match.participant,
        },
        {
          status: 409,
        },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Could not save the Youth in Work assessment.";

    if (
      message.includes(
        "already has a Youth in Work assessment",
      )
    ) {
      return NextResponse.json(
        {
          error: message,
          code:
            "ASSESSMENT_ALREADY_EXISTS",
        },
        {
          status: 409,
        },
      );
    }

    console.error(
      "YIW assessment submission failed:",
      error,
    );

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      },
    );
  }
}
