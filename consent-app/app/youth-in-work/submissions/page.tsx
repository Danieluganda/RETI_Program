import { AppShell } from "@/components/AppShell";
import { getYouthInWorkAssessments } from "@/lib/youthInWork";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    eso?: string;
    district?: string;
    sector?: string;
    period?: string;
  }>;
};

function clean(value?: string | null) {
  return String(value || "").trim();
}

function normalize(value?: string | null) {
  return clean(value).toLowerCase();
}

function friendlyLabel(value?: string | null) {
  const text = clean(value);

  if (!text) return "Not recorded";

  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function isYes(value?: string | null) {
  return ["yes", "y", "true"].includes(normalize(value));
}

function startOfPeriod(period: string) {
  const now = new Date();

  if (period === "today") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
  }

  if (period === "week") {
    const date = new Date(now);
    const day = date.getDay();
    const difference = day === 0 ? 6 : day - 1;

    date.setDate(date.getDate() - difference);
    date.setHours(0, 0, 0, 0);

    return date;
  }

  if (period === "month") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
  }

  return null;
}

function Bar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const width = percentage(value, total);

  return (
    <div className="yiw-breakdown-row">
      <div className="yiw-breakdown-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <div className="yiw-breakdown-track">
        <span
          className="yiw-breakdown-fill"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default async function YouthInWorkSubmissionsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  let assessments: Awaited<ReturnType<typeof getYouthInWorkAssessments>> = [];
  let databaseError = "";

  try {
    assessments = await getYouthInWorkAssessments();
  } catch (error) {
    console.error("Could not load Youth in Work submissions:", error);
    databaseError =
      "Live submissions are temporarily unavailable. Check the database connection and try again.";
  }

  const q = normalize(params.q);
  const selectedEso = clean(params.eso);
  const selectedDistrict = clean(params.district);
  const selectedSector = clean(params.sector);
  const selectedPeriod = clean(params.period);

  const periodStart = startOfPeriod(selectedPeriod);

  const esos = [
    ...new Set(
      assessments
        .map((assessment) => clean(assessment.esoName))
        .filter(Boolean),
    ),
  ].sort();

  const districts = [
    ...new Set(
      assessments
        .map((assessment) => clean(assessment.district))
        .filter(Boolean),
    ),
  ].sort();

  const sectors = [
    ...new Set(
      assessments
        .map((assessment) => clean(assessment.businessSector))
        .filter(Boolean),
    ),
  ].sort();

  const filteredAssessments = assessments.filter((assessment) => {
    const searchTarget = [
      assessment.participantName,
      assessment.participantEmail,
      assessment.participantPhone,
      assessment.participantExternalId,
      assessment.esoName,
      assessment.district,
      assessment.businessSector,
    ]
      .map(normalize)
      .join(" ");

    if (q && !searchTarget.includes(q)) return false;

    if (
      selectedEso &&
      clean(assessment.esoName) !== selectedEso
    ) {
      return false;
    }

    if (
      selectedDistrict &&
      clean(assessment.district) !== selectedDistrict
    ) {
      return false;
    }

    if (
      selectedSector &&
      clean(assessment.businessSector) !== selectedSector
    ) {
      return false;
    }

    if (
      periodStart &&
      new Date(assessment.assessmentDate) < periodStart
    ) {
      return false;
    }

    return true;
  });

  const exportParams = new URLSearchParams();
  if (params.q) exportParams.set("q", params.q);
  if (selectedEso) exportParams.set("eso", selectedEso);
  if (selectedDistrict) exportParams.set("district", selectedDistrict);
  if (selectedSector) exportParams.set("sector", selectedSector);
  if (selectedPeriod) exportParams.set("period", selectedPeriod);
  const exportHref = `/api/exports/youth-in-work${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  const total = filteredAssessments.length;

  const esoCount = new Set(
    filteredAssessments
      .map((assessment) => clean(assessment.esoName))
      .filter(Boolean),
  ).size;

  const incomeYes = filteredAssessments.filter((assessment) =>
    isYes(assessment.incomeFromProgram),
  ).length;

  const workImproved = filteredAssessments.filter((assessment) =>
    isYes(assessment.workImproved),
  ).length;

  const courseCompleted = filteredAssessments.filter((assessment) =>
    ["yes", "completed"].includes(
      normalize(assessment.foundationCourseStatus),
    ),
  ).length;

  const needsAttention = filteredAssessments.filter((assessment) => {
    const noContact =
      !clean(assessment.participantEmail) &&
      !clean(assessment.participantPhone);

    const noDistrict = !clean(assessment.district);

    return noContact || noDistrict;
  }).length;

  const esoCounts = Object.entries(
    filteredAssessments.reduce<Record<string, number>>(
      (result, assessment) => {
        const eso = clean(assessment.esoName) || "Not recorded";
        result[eso] = (result[eso] || 0) + 1;
        return result;
      },
      {},
    ),
  ).sort((a, b) => b[1] - a[1]);

  const courseCounts = Object.entries(
    filteredAssessments.reduce<Record<string, number>>(
      (result, assessment) => {
        const status = friendlyLabel(
          assessment.foundationCourseStatus,
        );

        result[status] = (result[status] || 0) + 1;

        return result;
      },
      {},
    ),
  ).sort((a, b) => b[1] - a[1]);

  const ugx = new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  });

  return (
    <AppShell>
      <div className="records-page yiw-dashboard-page">
        <header className="topbar records-topbar yiw-dashboard-header">
          <div>
            <span className="yiw-page-kicker">Youth in Work</span>

            <h1>Submissions</h1>

            <p>Review and export collected Youth in Work assessments.</p>
          </div>

          <div className="records-actions">
            <a
              className="button secondary"
              href="/youth-in-work"
            >
              Open participant form
            </a>

            <a
              className="button primary"
              href={exportHref}
              download
            >
              Download CSV
            </a>
          </div>
        </header>

        <section className="yiw-dashboard-filters">
          <form method="get" className="yiw-filter-form">
            <div className="yiw-filter-search">
              <label htmlFor="q">Search</label>

              <input
                id="q"
                name="q"
                defaultValue={params.q || ""}
                placeholder="Name, phone, email or participant ID"
              />
            </div>

            <div>
              <label htmlFor="eso">ESO</label>

              <select
                id="eso"
                name="eso"
                defaultValue={selectedEso}
              >
                <option value="">All ESOs</option>

                {esos.map((eso) => (
                  <option key={eso} value={eso}>
                    {eso}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="district">District</label>

              <select
                id="district"
                name="district"
                defaultValue={selectedDistrict}
              >
                <option value="">All districts</option>

                {districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sector">Sector</label>

              <select
                id="sector"
                name="sector"
                defaultValue={selectedSector}
              >
                <option value="">All sectors</option>

                {sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="period">Period</label>

              <select
                id="period"
                name="period"
                defaultValue={selectedPeriod}
              >
                <option value="">All time</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
              </select>
            </div>

            <div className="yiw-filter-actions">
              <button className="button primary" type="submit">
                Apply filters
              </button>

              <a
                className="button secondary"
                href="/youth-in-work/submissions"
              >
                Reset
              </a>
            </div>
          </form>
        </section>

        {databaseError ? (
          <section className="yiw-database-alert" role="alert">
            <strong>Submissions unavailable</strong>
            <span>{databaseError}</span>
          </section>
        ) : null}

        <section className="yiw-kpi-grid">
          <article className="yiw-kpi-card">
            <span className="yiw-kpi-label">
              Total assessed
            </span>

            <strong>{total}</strong>

            <small>Submitted YIW assessments</small>
          </article>

          <article className="yiw-kpi-card">
            <span className="yiw-kpi-label">
              ESOs reporting
            </span>

            <strong>{esoCount}</strong>

            <small>Distinct ESOs represented</small>
          </article>

          <article className="yiw-kpi-card">
            <span className="yiw-kpi-label">
              Income from 10X
            </span>

            <strong>{percentage(incomeYes, total)}%</strong>

            <small>
              {incomeYes} of {total} participants
            </small>
          </article>

          <article className="yiw-kpi-card">
            <span className="yiw-kpi-label">
              Work improved
            </span>

            <strong>
              {percentage(workImproved, total)}%
            </strong>

            <small>
              {workImproved} participants reporting improvement
            </small>
          </article>

          <article className="yiw-kpi-card">
            <span className="yiw-kpi-label">
              Foundation completed
            </span>

            <strong>
              {percentage(courseCompleted, total)}%
            </strong>

            <small>
              {courseCompleted} completed participants
            </small>
          </article>

          <article
            className={`yiw-kpi-card ${
              needsAttention ? "yiw-kpi-warning" : ""
            }`}
          >
            <span className="yiw-kpi-label">
              Needs attention
            </span>

            <strong>{needsAttention}</strong>

            <small>
              Missing district or participant contact
            </small>
          </article>
        </section>


        <section className="panel yiw-submissions-register">
          <div className="section-heading yiw-register-heading">
            <div>
              <span className="yiw-section-kicker">
                Register
              </span>

              <h2>Submitted assessments</h2>

              <p>
                Showing {filteredAssessments.length} of{" "}
                {assessments.length} submissions.
              </p>
            </div>

            <div className="yiw-register-count">
              {filteredAssessments.length} records
            </div>
          </div>

          <div className="table-wrap">
            <table className="yiw-submissions-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>ESO</th>
                  <th>District</th>
                  <th>Sector</th>
                  <th>Foundation Course</th>
                  <th>Income from 10X</th>
                  <th>Work improved</th>
                  <th>Submitted</th>
                </tr>
              </thead>

              <tbody>
                {filteredAssessments.length ? (
                  filteredAssessments.map((assessment) => (
                    <tr key={assessment.id}>
                      <td>
                        <div className="yiw-participant-cell">
                          <strong>
                            {assessment.participantName}
                          </strong>

                          <small>
                            {assessment.participantEmail ||
                              assessment.participantPhone ||
                              assessment.participantExternalId ||
                              "No contact recorded"}
                          </small>
                        </div>
                      </td>

                      <td>
                        {assessment.esoName || "Not recorded"}
                      </td>

                      <td>
                        {assessment.district || "Not recorded"}
                      </td>

                      <td>
                        {assessment.businessSector ||
                          "Not recorded"}
                      </td>

                      <td>
                        <span className="yiw-status-pill">
                          {friendlyLabel(
                            assessment.foundationCourseStatus,
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="yiw-table-outcome">
                          <strong>
                            {friendlyLabel(
                              assessment.incomeFromProgram,
                            )}
                          </strong>

                          {assessment.incomeAmount ? (
                            <small>
                              {ugx.format(
                                assessment.incomeAmount,
                              )}
                            </small>
                          ) : null}
                        </div>
                      </td>

                      <td>
                        {friendlyLabel(
                          assessment.workImproved,
                        )}
                      </td>

                      <td>
                        <div className="yiw-date-cell">
                          <strong>
                            {new Date(
                              assessment.assessmentDate,
                            ).toLocaleDateString()}
                          </strong>

                          <small>
                            {new Date(
                              assessment.assessmentDate,
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </small>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8}>
                      <div className="yiw-table-empty">
                        <strong>
                          No submissions match these filters.
                        </strong>

                        <span>
                          Adjust or reset the filters to see other
                          records.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
