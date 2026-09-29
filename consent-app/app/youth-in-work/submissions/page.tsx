import { AppShell } from "@/components/AppShell";
import { getYouthInWorkAssessments } from "@/lib/youthInWork";

export const dynamic = "force-dynamic";

export default async function YouthInWorkSubmissionsPage() {
  const assessments = await getYouthInWorkAssessments();

  return (
    <AppShell>
      <div className="records-page yiw-submissions-page">
        <header className="topbar records-topbar">
          <div>
            <h1>Youth in Work submissions</h1>
            <p>Submitted Youth in Work assessments and participant outcomes.</p>
          </div>
          <div className="records-actions">
            <a className="button secondary" href="/youth-in-work">
              Open participant form
            </a>
            <a className="button primary" href="/api/youth-in-work/assessments" download>
              Download JSON
            </a>
          </div>
        </header>

        <section className="cards yiw-submission-metrics">
          <div className="metric">
            <span>Total submissions</span>
            <strong>{assessments.length}</strong>
          </div>
          <div className="metric">
            <span>Distinct ESOs</span>
            <strong>{new Set(assessments.map((assessment) => assessment.esoName).filter(Boolean)).size}</strong>
          </div>
          <div className="metric">
            <span>Latest submission</span>
            <strong className="compact-metric">
              {assessments[0]?.assessmentDate
                ? new Date(assessments[0].assessmentDate).toLocaleDateString()
                : "None"}
            </strong>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Submitted assessments</h2>
              <p>Each participant can submit one Youth in Work assessment.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>ESO</th>
                  <th>District</th>
                  <th>Work status</th>
                  <th>Income from 10X</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {assessments.length ? assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>
                      <strong>{assessment.participantName}</strong>
                      <small>{assessment.participantEmail || assessment.participantPhone || assessment.participantExternalId}</small>
                    </td>
                    <td>{assessment.esoName || "Not recorded"}</td>
                    <td>{assessment.district || "Not recorded"}</td>
                    <td>{assessment.youthInWorkStatus}</td>
                    <td>{assessment.incomeFromProgram || "Not recorded"}</td>
                    <td>{new Date(assessment.assessmentDate).toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6}>No Youth in Work submissions have been received yet.</td>
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
