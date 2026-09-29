"use client";

import { useEffect, useState } from "react";

type Participant = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  externalId: string;
  esoName: string;
  district: string;
  region: string;
  hasAssessment: boolean;
};

const sectors = ["Agriculture", "Health", "Meetings, incentives and conferences", "Light manufacturing", "Trade and services", "Fashion and design", "Others"];
const districts = ["Abim", "Adjumani", "Agago", "Alebtong", "Amolatar", "Amudat", "Amuria", "Amuru", "Apac", "Arua", "Terego", "Budaka", "Bududa", "Bugiri", "Bugweri", "Buhweju", "Buikwe", "Bukedea", "Bukomansimbi", "Bukwo", "Bulambuli", "Buliisa", "Bundibugyo", "Bunyangabu", "Bushenyi", "Busia", "Butaleja", "Butambala", "Butebo", "Buvuma", "Buyende", "Dokolo", "Gomba", "Gulu", "Hoima", "Ibanda", "Iganga", "Isingiro", "Jinja", "Kaabong", "Kabale", "Kabarole", "Kaberamaido", "Kagadi", "Kakumiro", "Kalaki", "Kalangala", "Kaliro", "Kampala", "Kamuli", "Kamwenge", "Kanungu", "Kapchorwa", "Kapelebyong", "Karenga", "Kasese", "Kassanda", "Katakwi", "Kayunga", "Kazo", "Kibaale", "Kiboga", "Kibuku", "Kikuube", "Kiruhura", "Kiryandongo", "Kisoro", "Kitgum", "Koboko", "Kole", "Kotido", "Kumi", "Kwania", "Kween", "Kyankwanzi", "Kyegegwa", "Kyenjojo", "Kyotera", "Lamwo", "Lira", "Luuka", "Luwero", "Lwengo", "Lyantonde", "Madi Okollo", "Manafwa", "Maracha", "Masaka", "Masindi", "Mayuge", "Mbale", "Mbarara", "Mitooma", "Mityana", "Moroto", "Moyo", "Mpigi", "Mubende", "Mukono", "Nabilatuk", "Nakapiripirit", "Nakaseke", "Nakasongola", "Namayingo", "Namisindwa", "Namutumba", "Napak", "Nebbi", "Ngora", "Ntoroko", "Ntungamo", "Nwoya", "Obongi", "Omoro", "Otuke", "Oyam", "Pader", "Pakwach", "Pallisa", "Rakai", "Rubanda", "Rubirizi", "Rukiga", "Rukungiri", "Rwampara", "Serere", "Sheema", "Sironko", "Soroti", "Ssembabule", "Tororo", "Wakiso", "Yumbe", "Zombo"];
const improvementOptions = ["Higher income", "Respect at workplace", "Sense of purpose", "Good reputation"];

type FormState = {
  participantName: string;
  participantPhone: string;
  participantEmail: string;
  participantExternalId: string;
  district: string;
  region: string;
  businessName: string;
  businessSector: string;
  foundationCourseStatus: string;
  foundationLearning: string;
  incomeFromProgram: string;
  incomeAmount: string;
  workImproved: string;
  workImprovementDescription: string;
  youthInWorkStatus: string;
  notes: string;
  assessorName: string;
};

const initialForm: FormState = {
  participantName: "", participantPhone: "", participantEmail: "", participantExternalId: "",
  district: "", region: "", businessName: "", businessSector: "", foundationCourseStatus: "",
  foundationLearning: "", incomeFromProgram: "", incomeAmount: "", workImproved: "",
  workImprovementDescription: "", youthInWorkStatus: "", notes: "", assessorName: "",
};

export function YouthInWorkTool() {
  const [query, setQuery] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Participant | null>(null);
  const [newPerson, setNewPerson] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [improvementOutcomes, setImprovementOutcomes] = useState<string[]>([]);
  const [gps, setGps] = useState<{ latitude?: number; longitude?: number; accuracy?: number }>({});
  const [form, setForm] = useState<FormState>(initialForm);

  useEffect(() => {
    if (query.trim().length < 2) {
      setParticipants([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/youth-in-work/participants?q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((data) => setParticipants(data.participants || []))
        .catch(() => setMessage("Participant search is unavailable."));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function updateField(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function chooseParticipant(participant: Participant) {
    if (participant.hasAssessment) {
      setMessage(`${participant.fullName} already has a Youth in Work assessment.`);
      return;
    }
    setSelected(participant);
    setNewPerson(false);
    setQuery(participant.fullName);
    setForm((current) => ({
      ...current,
      participantName: participant.fullName,
      participantPhone: participant.phone,
      participantEmail: participant.email,
      participantExternalId: participant.externalId,
      district: participant.district,
      region: participant.region,
    }));
    setMessage("");
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setMessage("This browser does not support GPS capture.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
        setMessage("GPS location captured.");
      },
      () => setMessage("GPS location could not be captured. You can continue without it."),
    );
  }

  function toggleOutcome(value: string) {
    setImprovementOutcomes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/youth-in-work/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        participantId: selected?.id,
        esoName: selected?.esoName || "Outreach",
        incomeAmount: form.incomeAmount,
        improvementOutcomes,
        ...gps,
      }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Could not save the assessment.");
      return;
    }
    setMessage(`Assessment saved for ${data.participant.fullName}.`);
    setSelected(null);
    setNewPerson(false);
    setQuery("");
    setParticipants([]);
    setImprovementOutcomes([]);
    setGps({});
    setForm(initialForm);
  }

  const incomeYes = form.incomeFromProgram === "yes";
  const improvedYes = form.workImproved === "yes";
  const foundationYes = form.foundationCourseStatus === "yes";
  const foundationInProgress = ["currently_enrolled", "started_but_not_completed"].includes(form.foundationCourseStatus);
  const requiredValues = [
    Boolean(form.businessSector),
    Boolean(form.district),
    Boolean(form.foundationCourseStatus),
    Boolean(form.incomeFromProgram),
    Boolean(form.youthInWorkStatus),
  ];
  if (foundationYes || foundationInProgress) requiredValues.push(Boolean(form.foundationLearning.trim()));
  if (incomeYes) {
    requiredValues.push(Boolean(form.incomeAmount));
    requiredValues.push(Boolean(form.workImproved));
  }
  if (improvedYes) {
    requiredValues.push(Boolean(form.workImprovementDescription.trim()));
    requiredValues.push(improvementOutcomes.length > 0);
  }
  const completedRequired = requiredValues.filter(Boolean).length;
  const completionPercent = requiredValues.length ? Math.round((completedRequired / requiredValues.length) * 100) : 0;

  function choiceCard(name: keyof FormState, value: string, label: string) {
    return (
      <label className={`yiw-choice-card ${form[name] === value ? "is-selected" : ""}`}>
        <input type="radio" name={name} checked={form[name] === value} onChange={() => updateField(name, value)} />
        <span className="yiw-choice-dot" aria-hidden="true" />
        <span>{label}</span>
      </label>
    );
  }

  return (
    <div className="yiw-public">
      <header className="yiw-topbar">
        <div className="yiw-topbar-inner">
          <div className="yiw-brand">
            <div className="yiw-brand-mark">10X</div>
            <div><strong>Youth in Work</strong><span>Assessment Tool | Outbox 10X Program</span></div>
          </div>
          <span className="yiw-badge">Participant form</span>
        </div>
      </header>

      <main className="yiw-wrap">
        <div>
          <section className="yiw-hero">
            <span className="yiw-hero-kicker">Youth in Work Assessment</span>
            <h1>Capture employment and work outcomes.</h1>
            <p>Welcome to the Youth in Work Assessment Tool. This form helps us understand young people who have gained new or improved employment opportunities through wage or self-employment, and how the 10X Program has supported their progress.</p>
          </section>

          <form className="yiw-form-card" onSubmit={submit}>
            <section className="yiw-section yiw-lookup">
              <div className="yiw-section-head"><span className="yiw-section-no">1</span><div><h2>Participant details</h2><p className="yiw-lead">Find your existing record before completing the assessment.</p></div></div>
              <div className="yiw-grid-2">
                <div className="yiw-field yiw-full">
                  <label className="yiw-field-label" htmlFor="yiw-search">Search for your name, phone, email, or participant reference</label>
                  <input id="yiw-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Start typing at least 2 characters" />
                </div>
              </div>
              {participants.length ? <div className="yiw-results">{participants.map((participant) => <button className="yiw-result" type="button" key={participant.id} onClick={() => chooseParticipant(participant)}><strong>{participant.fullName}</strong><span>{[participant.phone, participant.email, participant.esoName || "Outreach"].filter(Boolean).join(" | ")}</span>{participant.hasAssessment ? <em>Assessment already submitted</em> : null}</button>)}</div> : null}
              {!selected ? <button className="yiw-button yiw-secondary" type="button" onClick={() => { setNewPerson(true); setMessage(""); }}>I am not listed - enter my details</button> : <div className="yiw-selected"><strong>{selected.fullName}</strong><span>{selected.esoName || "Outreach"} | {selected.phone || "No phone recorded"}</span></div>}
            </section>

            {(selected || newPerson) ? <>
              <section className="yiw-section">
                <div className="yiw-section-head"><span className="yiw-section-no">2</span><div><h2>Participant information</h2><p className="yiw-lead">Please confirm your contact and business details.</p></div></div>
                <div className="yiw-grid-2">
                  <div className="yiw-field"><label className="yiw-field-label" htmlFor="yiw-name">Full name <span className="yiw-required">*</span></label><input id="yiw-name" required value={form.participantName} readOnly={Boolean(selected)} onChange={(event) => updateField("participantName", event.target.value)} /></div>
                  <div className="yiw-field"><label className="yiw-field-label" htmlFor="yiw-email">Primary email <span className="yiw-required">*</span></label><input id="yiw-email" required type="email" value={form.participantEmail} readOnly={Boolean(selected)} onChange={(event) => updateField("participantEmail", event.target.value)} /></div>
                  <div className="yiw-field"><label className="yiw-field-label" htmlFor="yiw-phone">Phone number <span className="yiw-required">*</span></label><input id="yiw-phone" required value={form.participantPhone} readOnly={Boolean(selected)} onChange={(event) => updateField("participantPhone", event.target.value)} /></div>
                  <div className="yiw-field"><label className="yiw-field-label" htmlFor="yiw-ref">Participant reference</label><input id="yiw-ref" value={form.participantExternalId} readOnly={Boolean(selected)} onChange={(event) => updateField("participantExternalId", event.target.value)} /></div>
                  <div className="yiw-field"><label className="yiw-field-label">Implementing partner / support organization</label><input value={selected?.esoName || "Outreach"} readOnly /></div>
                  <div className="yiw-field"><label className="yiw-field-label" htmlFor="yiw-district">District <span className="yiw-required">*</span></label><select id="yiw-district" required value={form.district} onChange={(event) => updateField("district", event.target.value)}><option value="">Select district</option>{districts.map((district) => <option key={district}>{district}</option>)}</select></div>
                  <div className="yiw-field"><label className="yiw-field-label" htmlFor="yiw-sector">Enterprise / business sector <span className="yiw-required">*</span></label><select id="yiw-sector" required value={form.businessSector} onChange={(event) => updateField("businessSector", event.target.value)}><option value="">Select sector</option>{sectors.map((sector) => <option key={sector}>{sector}</option>)}</select></div>
                  <div className="yiw-field"><label className="yiw-field-label" htmlFor="yiw-business">Business name</label><input id="yiw-business" value={form.businessName} onChange={(event) => updateField("businessName", event.target.value)} /></div>
                </div>
              </section>

              <section className="yiw-section">
                <div className="yiw-section-head"><span className="yiw-section-no">3</span><div><h2>10X Foundation Course</h2><p className="yiw-lead">Tell us about your course participation and learning.</p></div></div>
                <div className="yiw-field"><label className="yiw-field-label">Have you completed the 10X Business Foundation Course? <span className="yiw-required">*</span></label><div className="yiw-choice-grid">{choiceCard("foundationCourseStatus", "yes", "Yes")}{choiceCard("foundationCourseStatus", "no", "No")}{choiceCard("foundationCourseStatus", "currently_enrolled", "Currently enrolled")}{choiceCard("foundationCourseStatus", "started_but_not_completed", "Started but not completed")}</div></div>
                {foundationYes ? <div className="yiw-conditional"><div className="yiw-field"><label className="yiw-field-label" htmlFor="yiw-learning">What did you learn from the 10X Program Foundation Course? <span className="yiw-required">*</span></label><textarea id="yiw-learning" required rows={4} value={form.foundationLearning} onChange={(event) => updateField("foundationLearning", event.target.value)} placeholder="What did you learn and implement?" /></div></div> : null}
                {foundationInProgress ? <div className="yiw-conditional"><div className="yiw-field"><label className="yiw-field-label" htmlFor="yiw-learning-progress">What have you so far learned from the 10X Program Foundation Course? <span className="yiw-required">*</span></label><textarea id="yiw-learning-progress" required rows={4} value={form.foundationLearning} onChange={(event) => updateField("foundationLearning", event.target.value)} /></div></div> : null}
              </section>

              <section className="yiw-section">
                <div className="yiw-section-head"><span className="yiw-section-no">4</span><div><h2>Youth in Work outcomes</h2><p className="yiw-lead">Share what has changed as a result of the 10X Program.</p></div></div>
                <div className="yiw-field"><label className="yiw-field-label">Have you earned income or money as a result of the 10X Program? <span className="yiw-required">*</span></label><div className="yiw-choice-grid">{choiceCard("incomeFromProgram", "yes", "Yes")}{choiceCard("incomeFromProgram", "no", "No")}</div></div>
                {incomeYes ? <div className="yiw-conditional"><div className="yiw-grid-2"><div className="yiw-field"><label className="yiw-field-label" htmlFor="yiw-income">If yes, how much have you earned? <span className="yiw-required">*</span></label><input id="yiw-income" required type="number" min="0" step="1" value={form.incomeAmount} onChange={(event) => updateField("incomeAmount", event.target.value)} /></div><div className="yiw-field"><label className="yiw-field-label">Have your working conditions improved? <span className="yiw-required">*</span></label><div className="yiw-choice-grid">{choiceCard("workImproved", "yes", "Yes")}{choiceCard("workImproved", "no", "No")}</div></div></div>
                  {improvedYes ? <div className="yiw-conditional yiw-inner-conditional"><div className="yiw-field"><label className="yiw-field-label" htmlFor="yiw-improvement">How did your work improve? <span className="yiw-required">*</span></label><textarea id="yiw-improvement" required rows={4} value={form.workImprovementDescription} onChange={(event) => updateField("workImprovementDescription", event.target.value)} placeholder="Describe how your work improved." /></div><div className="yiw-field"><label className="yiw-field-label">Which improvements resulted from the 10X Program? <span className="yiw-required">*</span></label><div className="yiw-choice-grid">{improvementOptions.map((option) => <label className={`yiw-check-card ${improvementOutcomes.includes(option) ? "is-selected" : ""}`} key={option}><input type="checkbox" checked={improvementOutcomes.includes(option)} onChange={() => toggleOutcome(option)} /><span className="yiw-check-box" aria-hidden="true" /><span>{option}</span></label>)}</div></div></div> : null}
                </div> : null}
                <div className="yiw-conditional"><div className="yiw-field"><label className="yiw-field-label">Youth in Work status <span className="yiw-required">*</span></label><div className="yiw-choice-grid">{choiceCard("youthInWorkStatus", "Currently in work", "Currently in work")}{choiceCard("youthInWorkStatus", "Seeking work", "Seeking work")}{choiceCard("youthInWorkStatus", "Not currently in work", "Not currently in work")}{choiceCard("youthInWorkStatus", "Needs follow-up", "Needs follow-up")}</div></div></div>
                <div className="yiw-conditional"><div className="yiw-field"><label className="yiw-field-label">GPS location</label><div className="yiw-gps-grid"><input value={gps.latitude?.toFixed(6) || ""} readOnly placeholder="Latitude not captured" /><input value={gps.longitude?.toFixed(6) || ""} readOnly placeholder="Longitude not captured" /><button className="yiw-button yiw-secondary" type="button" onClick={captureLocation}>Use current location</button></div></div></div>
              </section>

              <section className="yiw-section">
                <div className="yiw-section-head"><span className="yiw-section-no">5</span><div><h2>Additional comments</h2><p className="yiw-lead">Optional closing comments from the participant.</p></div></div>
                <div className="yiw-field"><label className="yiw-field-label" htmlFor="yiw-notes">Any other comments</label><textarea id="yiw-notes" rows={4} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} /></div>
                <div className="yiw-notice">Thank you for your participation.</div>
              </section>
              {message ? <p className={`yiw-message ${message.includes("saved") || message.includes("captured") ? "success" : "error"}`}>{message}</p> : null}
              <div className="yiw-actions"><button type="button" className="yiw-button yiw-secondary" onClick={() => { setForm(initialForm); setSelected(null); setNewPerson(false); setQuery(""); setImprovementOutcomes([]); setGps({}); setMessage(""); }}>Clear form</button><button type="submit" className="yiw-button yiw-primary" disabled={saving}>{saving ? "Saving..." : "Submit assessment"}</button></div>
            </> : null}
            {message && !selected && !newPerson ? <p className="yiw-message error">{message}</p> : null}
          </form>
        </div>
        <aside className="yiw-sidebar">
          <div className="yiw-side-card"><h3>Form completion</h3><p>The indicator updates as the required questions are completed.</p><div className="yiw-progress"><span style={{ width: `${completionPercent}%` }} /></div><div className="yiw-progress-meta"><span>{completionPercent}% complete</span><span>{completedRequired} / {requiredValues.length}</span></div></div>
          <div className="yiw-side-card"><h3>How this form works</h3><p>Find your existing record first. Questions about course learning, income, and work improvements appear only when relevant to your answers.</p></div>
          <div className="yiw-side-card"><h3>Need help?</h3><p>Use the same name, email, and phone number used when signing up for the 10X Foundation Course.</p></div>
        </aside>
      </main>
    </div>
  );
}
