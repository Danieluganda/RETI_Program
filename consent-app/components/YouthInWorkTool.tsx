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

  return (
    <section className="form-panel yiw-page" aria-labelledby="yiw-title">
      <header className="form-header">
        <div>
          <p className="eyebrow">10X Program</p>
          <h1 id="yiw-title">Youth in Work Assessment Tool</h1>
          <p className="form-intro">This assessment helps us understand young people who have gained new or improved employment opportunities through wage or self-employment.</p>
        </div>
      </header>

      <form className="a4-form yiw-form" onSubmit={submit}>
      <section className="section yiw-lookup">
        <h2>Participant lookup</h2>
        <p className="field-hint">Please search for the name used when signing up for the 10X Foundation Course.</p>
        <label htmlFor="yiw-search">Search by name, phone, email, or participant reference</label>
        <input id="yiw-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Start typing at least 2 characters" />
        {participants.length ? (
          <div className="yiw-results">
            {participants.map((participant) => (
              <button className="yiw-result" type="button" key={participant.id} onClick={() => chooseParticipant(participant)}>
                <strong>{participant.fullName}</strong>
                <span>{[participant.phone, participant.email, participant.esoName || "Outreach"].filter(Boolean).join(" · ")}</span>
                {participant.hasAssessment ? <em>Assessment already submitted</em> : null}
              </button>
            ))}
          </div>
        ) : null}
        {!selected ? (
          <button className="button secondary compact-button" type="button" onClick={() => { setNewPerson(true); setMessage(""); }}>
            Person not found? Add new person
          </button>
        ) : (
          <div className="selected-participant">
            <strong>Selected: {selected.fullName}</strong>
            <span>{selected.esoName || "Outreach"} · {selected.phone || "No phone recorded"}</span>
          </div>
        )}
      </section>

      {(selected || newPerson) ? (
        <>
          <h2>Participant details</h2>
          <div className="grid two">
            <label>Full name<input required value={form.participantName} readOnly={Boolean(selected)} onChange={(event) => updateField("participantName", event.target.value)} /></label>
            <label>Primary email<input required type="email" value={form.participantEmail} readOnly={Boolean(selected)} onChange={(event) => updateField("participantEmail", event.target.value)} /></label>
            <label>Phone number<input required value={form.participantPhone} readOnly={Boolean(selected)} onChange={(event) => updateField("participantPhone", event.target.value)} /></label>
            <label>Participant reference<input value={form.participantExternalId} readOnly={Boolean(selected)} onChange={(event) => updateField("participantExternalId", event.target.value)} /></label>
            <label>Implementing partner / support organization<input value={selected?.esoName || "Outreach"} readOnly /></label>
            <label>District<select required value={form.district} onChange={(event) => updateField("district", event.target.value)}><option value="">Select district</option>{districts.map((district) => <option key={district}>{district}</option>)}</select></label>
            <label>Enterprise / business sector<select required value={form.businessSector} onChange={(event) => updateField("businessSector", event.target.value)}><option value="">Select sector</option>{sectors.map((sector) => <option key={sector}>{sector}</option>)}</select></label>
            <label>Business name<input value={form.businessName} onChange={(event) => updateField("businessName", event.target.value)} /></label>
          </div>

          <h2>Assessment questions</h2>
          <div className="grid two">
            <label>Have you completed the 10X Business Foundation Course?<select required value={form.foundationCourseStatus} onChange={(event) => updateField("foundationCourseStatus", event.target.value)}><option value="">Select answer</option><option value="yes">Yes</option><option value="no">No</option><option value="currently_enrolled">Currently enrolled</option><option value="started_but_not_completed">Started but not completed</option></select></label>
            <label>Have you earned income or money as a result of the 10X Program?<select required value={form.incomeFromProgram} onChange={(event) => updateField("incomeFromProgram", event.target.value)}><option value="">Select answer</option><option value="yes">Yes</option><option value="no">No</option></select></label>
            <label>Youth in Work status<select required value={form.youthInWorkStatus} onChange={(event) => updateField("youthInWorkStatus", event.target.value)}><option value="">Select answer</option><option>Currently in work</option><option>Seeking work</option><option>Not currently in work</option><option>Needs follow-up</option></select></label>
            <label>Assessor name<input value={form.assessorName} onChange={(event) => updateField("assessorName", event.target.value)} /></label>
          </div>

          {foundationYes ? <label>What did you learn from the 10X Program Foundation Course, and what have you implemented?<textarea required rows={4} value={form.foundationLearning} onChange={(event) => updateField("foundationLearning", event.target.value)} /></label> : null}
          {foundationInProgress ? <label>What have you so far learned from the 10X Program Foundation Course?<textarea required rows={4} value={form.foundationLearning} onChange={(event) => updateField("foundationLearning", event.target.value)} /></label> : null}
          {incomeYes ? <label>If yes, how much have you earned?<input required type="number" min="0" step="1" value={form.incomeAmount} onChange={(event) => updateField("incomeAmount", event.target.value)} /></label> : null}
          {incomeYes ? <label>Have your working conditions improved since joining the 10X Program?<select required value={form.workImproved} onChange={(event) => updateField("workImproved", event.target.value)}><option value="">Select answer</option><option value="yes">Yes</option><option value="no">No</option></select></label> : null}
          {improvedYes ? <label>How did your work improve?<textarea required rows={4} value={form.workImprovementDescription} onChange={(event) => updateField("workImprovementDescription", event.target.value)} /></label> : null}
          {improvedYes ? <fieldset><legend>Which improvements resulted from the 10X Program? Select all that apply.</legend><div className="yiw-checks">{improvementOptions.map((option) => <label key={option}><input type="checkbox" checked={improvementOutcomes.includes(option)} onChange={() => toggleOutcome(option)} /> {option}</label>)}</div></fieldset> : null}

          <div className="yiw-gps">
            <button className="button secondary compact-button" type="button" onClick={captureLocation}>Capture GPS location</button>
            <span>{gps.latitude ? `Captured: ${gps.latitude.toFixed(5)}, ${gps.longitude?.toFixed(5)}` : "Optional location capture"}</span>
          </div>
          <label>Any other comments<textarea rows={4} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} /></label>
          {message ? <p className={`form-message ${message.includes("saved") || message.includes("captured") ? "success" : "error"}`}>{message}</p> : null}
          <div className="form-actions"><button className="button primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Submit assessment"}</button></div>
        </>
      ) : null}
      {message && !selected && !newPerson ? <p className="form-message error">{message}</p> : null}
      </form>
    </section>
  );
}
