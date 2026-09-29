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

const supportOptions = ["Business skills", "Technical training", "Finance", "Market access", "Mentorship", "Employment opportunity"];

export function YouthInWorkTool() {
  const [query, setQuery] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Participant | null>(null);
  const [newPerson, setNewPerson] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [supportNeeded, setSupportNeeded] = useState<string[]>([]);
  const [form, setForm] = useState({
    participantName: "",
    participantPhone: "",
    participantEmail: "",
    participantExternalId: "",
    district: "",
    region: "",
    businessName: "",
    businessSector: "",
    employmentStatus: "",
    youthInWorkStatus: "",
    trainingInterest: "",
    notes: "",
    assessorName: "",
  });

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

  function updateField(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleSupport(value: string) {
    setSupportNeeded((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/youth-in-work/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, participantId: selected?.id, esoName: selected?.esoName || "Outreach", supportNeeded }),
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
    setSupportNeeded([]);
    setForm((current) => ({ ...current, participantName: "", participantPhone: "", participantEmail: "", participantExternalId: "" }));
  }

  return (
    <div className="yiw-page">
      <header className="topbar">
        <div>
          <h1>Youth in Work Assessment</h1>
          <p>Find an existing Outreach participant, or register a new person before completing the assessment.</p>
        </div>
      </header>

      <section className="panel yiw-lookup">
        <h2>1. Find participant</h2>
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
            Participant not found? Add new person
          </button>
        ) : (
          <div className="selected-participant">
            <strong>Selected: {selected.fullName}</strong>
            <span>{selected.esoName || "Outreach"} · {selected.phone || "No phone recorded"}</span>
          </div>
        )}
      </section>

      {(selected || newPerson) ? (
        <form className="panel yiw-form" onSubmit={submit}>
          <h2>2. Participant details</h2>
          <div className="grid two">
            <label>Full name<input required value={form.participantName} readOnly={Boolean(selected)} onChange={(event) => updateField("participantName", event.target.value)} /></label>
            <label>Phone number<input required={!selected} value={form.participantPhone} readOnly={Boolean(selected)} onChange={(event) => updateField("participantPhone", event.target.value)} /></label>
            <label>Email<input type="email" value={form.participantEmail} readOnly={Boolean(selected)} onChange={(event) => updateField("participantEmail", event.target.value)} /></label>
            <label>Participant reference<input value={form.participantExternalId} readOnly={Boolean(selected)} onChange={(event) => updateField("participantExternalId", event.target.value)} /></label>
            <label>District<input value={form.district} onChange={(event) => updateField("district", event.target.value)} /></label>
            <label>Region<input value={form.region} onChange={(event) => updateField("region", event.target.value)} /></label>
            <label>Business name<input value={form.businessName} onChange={(event) => updateField("businessName", event.target.value)} /></label>
            <label>Business sector<input value={form.businessSector} onChange={(event) => updateField("businessSector", event.target.value)} /></label>
          </div>

          <h2>3. Youth in Work questions</h2>
          <div className="grid two">
            <label>Current employment status<select required value={form.employmentStatus} onChange={(event) => updateField("employmentStatus", event.target.value)}><option value="">Select status</option><option>Working</option><option>Self-employed</option><option>Seeking work</option><option>In education or training</option><option>Not currently working</option></select></label>
            <label>Youth in Work status<select required value={form.youthInWorkStatus} onChange={(event) => updateField("youthInWorkStatus", event.target.value)}><option value="">Select answer</option><option>Yes, currently in work</option><option>Yes, seeking work</option><option>No</option><option>Needs follow-up</option></select></label>
            <label>Interested in training?<select value={form.trainingInterest} onChange={(event) => updateField("trainingInterest", event.target.value)}><option value="">Select answer</option><option>Yes</option><option>No</option><option>Not sure</option></select></label>
            <label>Assessor name<input value={form.assessorName} onChange={(event) => updateField("assessorName", event.target.value)} /></label>
          </div>
          <fieldset>
            <legend>Support needed</legend>
            <div className="yiw-checks">{supportOptions.map((option) => <label key={option}><input type="checkbox" checked={supportNeeded.includes(option)} onChange={() => toggleSupport(option)} /> {option}</label>)}</div>
          </fieldset>
          <label>Notes<textarea rows={4} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} /></label>
          {message ? <p className={`form-message ${message.includes("saved") ? "success" : "error"}`}>{message}</p> : null}
          <div className="form-actions"><button className="button primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Submit assessment"}</button></div>
        </form>
      ) : null}
      {message && !selected && !newPerson ? <p className="form-message error">{message}</p> : null}
    </div>
  );
}
