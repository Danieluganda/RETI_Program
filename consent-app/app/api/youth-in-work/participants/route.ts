// app/api/youth-in-work/participants/route.ts

import { NextResponse } from "next/server";

import {
  findPotentialYouthInWorkDuplicate,
  parseYouthInWorkDateOfBirth,
  searchYouthInWorkParticipants,
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
   Normal participant search within selected ESO
========================================================= */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const query =
      url.searchParams.get("q") || "";

    const eso =
      url.searchParams.get("eso") || "";

    if (
      !eso ||
      query.trim().length < 2
    ) {
      return NextResponse.json({
        participants: [],
      });
    }

    const participants =
      await searchYouthInWorkParticipants(
        query,
        eso,
      );

    return NextResponse.json({
      participants,
    });
  } catch (error) {
    console.error(
      "YIW participant search failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Participant search is currently unavailable.",
        participants: [],
      },
      {
        status: 500,
      },
    );
  }
}

/* =========================================================
   POST
   V3 duplicate pre-check for proposed new participants.

   The check is global across the participant database.
   It can use:
   - external ID
   - phone
   - email
   - full name + DOB + district
   - full name + DOB + ESO
   - legacy fallback: full name + district + ESO

   Name alone is never enough to declare a duplicate.
========================================================= */

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json();

    const participantName =
      text(body.participantName);

    const participantPhone =
      text(body.participantPhone);

    const participantEmail =
      text(body.participantEmail);

    const participantExternalId =
      text(
        body.participantExternalId,
      );

    const esoName =
      text(body.esoName);

    const district =
      text(body.district);

    const dateOfBirthRaw =
      text(body.dateOfBirth);

    /*
     * We need at least one meaningful identity value
     * before attempting duplicate detection.
     */
    if (
      !participantName &&
      !participantPhone &&
      !participantEmail &&
      !participantExternalId
    ) {
      return badRequest(
        "Enter participant details before checking for an existing record.",
      );
    }

    /* -----------------------------------------------------
       FULL NAME QUALITY
       Validate it when supplied, but phone/email/external ID
       can still be used for a duplicate check without a name.
    ----------------------------------------------------- */

    if (participantName) {
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

    /* -----------------------------------------------------
       PHONE QUALITY
    ----------------------------------------------------- */

    if (participantPhone) {
      const phoneResult =
        validateYouthInWorkPhone(
          participantPhone,
        );

      if (!phoneResult.valid) {
        return badRequest(
          phoneResult.error ||
            "Enter a valid phone number.",
        );
      }
    }

    /* -----------------------------------------------------
       EMAIL QUALITY
    ----------------------------------------------------- */

    if (
      participantEmail &&
      !validEmail(participantEmail)
    ) {
      return badRequest(
        "Enter a valid primary email address.",
      );
    }

    /* -----------------------------------------------------
       DOB QUALITY
       UI uses DD/MM/YYYY. The shared parser also accepts ISO.
    ----------------------------------------------------- */

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
    }

    /* -----------------------------------------------------
       DUPLICATE CHECK
    ----------------------------------------------------- */

    const match =
      await findPotentialYouthInWorkDuplicate({
        participantName,

        participantPhone:
          optionalText(
            participantPhone,
          ),

        participantEmail:
          optionalText(
            participantEmail,
          ),

        participantExternalId:
          optionalText(
            participantExternalId,
          ),

        esoName:
          optionalText(
            esoName,
          ),

        district:
          optionalText(
            district,
          ),

        dateOfBirth,

        /*
         * Required by the shared assessment input type.
         * This endpoint only performs identity matching.
         */
        youthInWorkStatus:
          "duplicate_check",
      });

    /*
     * Nothing found:
     * participant can continue through the new-registration flow.
     */
    if (!match) {
      return NextResponse.json({
        matchFound: false,
        matchReason: null,
        participant: null,
      });
    }

    /*
     * Existing participant found.
     * This is intentionally a 200 response rather than an API error.
     * The UI should display the record and offer
     * "Use existing participant".
     */
    return NextResponse.json({
      matchFound: true,

      matchReason:
        match.matchReason,

      participant:
        match.participant,
    });
  } catch (error) {
    console.error(
      "YIW duplicate participant check failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Could not check whether this participant already exists.",
      },
      {
        status: 500,
      },
    );
  }
}
