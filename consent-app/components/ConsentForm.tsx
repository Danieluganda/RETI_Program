"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "./SignaturePad";

const consentTemplates = {
  "sample-space": {
    eyebrow: "10X Program",
    title: "Program Participants Consent Form",
    version: "10X-SAMPLE-v1",
    defaultOrganization: "Outbox (U) Limited",
    intro:
      "(\u201cwe,\u201d or \u201cus\u201d) is committed to improving its programs and ensuring they have a positive impact on program participants. To achieve this, we collect and analyze data about program participants. We value your privacy and are committed to protecting your personal data. This consent form explains how we collect, use, and share your personal information as part of the 10X Program.",
    purpose:
      "We collect your personal data to make analysis on the progress of the Program and improve the Program and learn from the data collected, including monitoring and evaluating the effectiveness of the 10X Program and to learn how to improve it for future participants.",
    dataList: [
      "Name, age, and gender",
      "Contact details",
      "Participation details in the Program",
      "Level of Education",
      "Marital status",
      "Refugee or displaced persons status",
      "Presence of a disability",
      "Feedback and responses to surveys",
    ],
    sharingList: [
      "Mastercard Foundation.",
      "Third-party data processors hired by Mastercard Foundation to support monitoring and evaluation, including data storage and analysis.",
      "Organizations contracted by Outbox, or those that have a Data Sharing Agreement (DSA) with Outbox, to support programme implementation, monitoring and evaluation, including securely storing, analyzing and reporting on programme data.",
    ],
    choiceText:
      "By consenting to share your data, you are helping for the success of the 10X Program for you and future participants.",
    agreementPrefix: "I agree to share my data with",
    agreementSuffix: "and Mastercard Foundation as well as any third-party data processors they may use for the purposes described above.",
  },
  "third-party-data-sharing": {
    eyebrow: "10X Program",
    title: "Third-Party Partner Data Sharing Consent Form",
    version: "10X-PARTNER-SHARE-v1",
    defaultOrganization: "",
    intro:
      "requests your consent to share selected personal and program participation data with approved third-party partners who may provide participant support services such as device financing, digital credit, asset financing, affordability checks, onboarding, verification, servicing, and related support.",
    purpose:
      "We collect and share your selected data only to help third-party partners assess eligibility, provide offers or services, verify your identity or participation, manage service delivery, and communicate with you about partner products or support that may be relevant to your participation in the program.",
    dataList: [
      "Name and contact details",
      "Participant ID or program reference",
      "Program participation and completion status",
      "Location or cohort information where relevant",
      "Device request or financing interest",
      "Basic affordability, repayment, or eligibility information where collected",
      "Partner service feedback and support outcomes",
    ],
    sharingList: [
      "Approved device financing partners",
      "Approved digital credit or financial service partners",
      "Approved device, asset, or connectivity service providers",
      "Third-party data processors supporting partner onboarding, verification, storage, analysis, servicing, or reporting.",
    ],
    choiceText:
      "By consenting to this data sharing, you allow approved partners to contact you and process your data for the partner services described above. Refusing this consent will not stop your participation in the core program.",
    agreementPrefix: "I agree to share my data with",
    agreementSuffix:
      "approved third-party partners including device financiers, digital credit providers, asset financing partners, and their processors for the purposes described above.",
  },
} as const;

type ConsentFormType = keyof typeof consentTemplates;

const partnerServiceData = {
  "device-financing": [
    "Participant name",
    "Phone number",
    "Program name and participation status",
    "Device financing interest",
    "Location or cohort information",
  ],
  "digital-credit": [
    "Participant name",
    "Phone number",
    "Program participation status",
    "Basic affordability or eligibility information",
    "Digital credit service interest",
  ],
  "asset-financing": [
    "Participant name",
    "Phone number",
    "Program participation status",
    "Asset or equipment financing interest",
    "Partner service feedback and support outcomes",
  ],
  connectivity: [
    "Participant name",
    "Phone number",
    "Program participation status",
    "Connectivity service interest",
    "Location or cohort information",
  ],
} as const;

const partnerOptions = [
  "Device financing partners",
  "Digital credit providers",
  "Asset financing partners",
  "Connectivity service providers",
];

const esoOptions = Array.from({ length: 12 }, (_, index) => `ESO ${index + 1}`);

type PartnerService = keyof typeof partnerServiceData;

export function ConsentForm({
  initialFormType = "sample-space",
  lockFormType = false,
}: {
  initialFormType?: ConsentFormType;
  lockFormType?: boolean;
}) {
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [message, setMessage] = useState("");
  const initialTemplate = consentTemplates[initialFormType];
  const [implementingOrganization, setImplementingOrganization] = useState<string>(initialTemplate.defaultOrganization);
  const [participantSignature, setParticipantSignature] = useState("");
  const [interpreterSignature, setInterpreterSignature] = useState("");
  const [signingMethod, setSigningMethod] = useState("drawn");
  const [consentFormType, setConsentFormType] = useState<ConsentFormType>(initialFormType);
  const [serviceRequired, setServiceRequired] = useState<PartnerService>("device-financing");
  const [authorizedPartners, setAuthorizedPartners] = useState<string[]>([partnerOptions[0]]);
  const [interpreterUsed, setInterpreterUsed] = useState(false);
  const template = consentTemplates[consentFormType];
  const isPartnerConsent = consentFormType === "third-party-data-sharing";
  const dataShared = isPartnerConsent ? partnerServiceData[serviceRequired] : template.dataList;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    const selectedPartners = formData.getAll("authorizedPartners").map(String);
    const selectedData = formData.getAll("dataShared").map(String);

    const response = await fetch("/api/consents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        participantName: body.participantName,
        participantPhone: "",
        consentFormType,
        consentFormVersion: template.version,
        consentDecision: body.consentDecision || "consented",
        serviceRequired: isPartnerConsent ? serviceRequired : "",
        authorizedPartners: isPartnerConsent ? selectedPartners : [],
        dataShared: isPartnerConsent ? selectedData : dataShared,
        informationUnderstood: Boolean(body.consentAgreement),
        interpreterUsed,
        interpreterLanguage: body.language,
        interpreterName: body.interpreterName || body.interpreterSignatureName,
        signingMethod,
        participantSignatureData: participantSignature,
        interpreterSignatureData: interpreterSignature,
        consentDate: body.participantDate || today,
        collectorName: body.dataCollectorName || "Demo Collector",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Could not save consent.");
      return;
    }

    router.push(`/consent/thank-you?ref=${encodeURIComponent(data.referenceNumber)}`);
  }

  return (
    <section className="form-panel" aria-labelledby="form-title">
      <header className="form-header">
        <div>
          <p className="eyebrow">{template.eyebrow}</p>
          <h1 id="form-title">{template.title}</h1>
        </div>
      </header>

      <form className="a4-form" onSubmit={handleSubmit}>
        <section className="section">
          <label htmlFor="consentFormType">Consent form</label>
          {lockFormType ? (
            <input id="consentFormType" value={template.title} readOnly />
          ) : (
            <select
              id="consentFormType"
              name="consentFormType"
              value={consentFormType}
              onChange={(event) => {
                const nextFormType = event.target.value as ConsentFormType;
                setConsentFormType(nextFormType);
                setImplementingOrganization(consentTemplates[nextFormType].defaultOrganization);
              }}
            >
              <option value="sample-space">Sample Space Participant Consent</option>
              <option value="third-party-data-sharing">Third-Party Partner Data Sharing Consent</option>
            </select>
          )}
          <input type="hidden" name="consentFormType" value={consentFormType} />
          <input type="hidden" name="consentFormVersion" value={template.version} />
        </section>

        <section className="section">
          {isPartnerConsent ? (
            <>
              <label htmlFor="implementingOrganization">Implementing organization</label>
              <input
                id="implementingOrganization"
                name="implementingOrganization"
                value={implementingOrganization}
                onChange={(event) => setImplementingOrganization(event.target.value)}
                required
              />
            </>
          ) : (
            <input type="hidden" name="implementingOrganization" value={template.defaultOrganization} />
          )}
          <p className="consent-copy">
            <span>{implementingOrganization || template.defaultOrganization || "The implementing organization"}</span> {template.intro} Please read this form carefully and sign to indicate your consent.
          </p>
          <p className="note">Please read this form carefully before you decide.</p>
        </section>

        <section className="section grid two">
          <div>
            <label htmlFor="programName">Program name</label>
            <input id="programName" name="programName" defaultValue="10X: Enabling growth of MSMEs through the digital economy" required />
          </div>
          <div>
            <label htmlFor="esoName">ESO</label>
            <select id="esoName" name="esoName" required defaultValue="">
              <option value="" disabled>
                Select ESO
              </option>
              {esoOptions.map((eso) => (
                <option key={eso} value={eso}>
                  {eso}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dataCollectorOrganization">Data collector organization</label>
            <input
              id="dataCollectorOrganization"
              name="dataCollectorOrganization"
              defaultValue="Outbox (U) Limited of 3rd Floor, Kalooli Lwanga Tower, Plot 83 & 85, Ntinda Road Kampala, Uganda"
              required
            />
          </div>
          <div>
            <label htmlFor="dataCollectorName">Data collector name</label>
            <input id="dataCollectorName" name="dataCollectorName" />
          </div>
          <div>
            <label htmlFor="dataCollectorContact">Data collector contact information</label>
            <input id="dataCollectorContact" name="dataCollectorContact" defaultValue="+256 (0) 392 000 152; info@outbox.africa" required />
          </div>
        </section>

        {isPartnerConsent && (
          <section className="section">
            <h2>Partner Service Request</h2>
            <div className="grid two">
              <div>
                <label htmlFor="serviceRequired">Service required</label>
                <select
                  id="serviceRequired"
                  name="serviceRequired"
                  value={serviceRequired}
                  onChange={(event) => setServiceRequired(event.target.value as PartnerService)}
                  required
                >
                  <option value="device-financing">Device financing</option>
                  <option value="digital-credit">Digital credit</option>
                  <option value="asset-financing">Asset financing</option>
                  <option value="connectivity">Connectivity service</option>
                </select>
              </div>
              <div>
                <label>Authorized partner(s)</label>
                <div className="option-list">
                  {partnerOptions.map((partner) => (
                    <label className="checkbox-row compact" key={partner}>
                      <input
                        name="authorizedPartners"
                        type="checkbox"
                        value={partner}
                        checked={authorizedPartners.includes(partner)}
                        onChange={(event) => {
                          setAuthorizedPartners((current) =>
                            event.target.checked
                              ? [...current, partner]
                              : current.filter((item) => item !== partner),
                          );
                        }}
                      />
                      <span>{partner}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="section">
          <h2>1. Purpose of Data Collection and Use</h2>
          <p>{template.purpose}</p>
        </section>

        <section className="section">
          <h2>2. What Data Do We Collect?</h2>
          <p>We may collect some or all of the following information about you:</p>
          <ul className="check-list">
            {dataShared.map((item) => (
              <li key={item}>
                {item}
                {isPartnerConsent && <input type="hidden" name="dataShared" value={item} />}
              </li>
            ))}
          </ul>
        </section>

        <section className="section">
          <h2>3. Who Will Your Data Be Shared With?</h2>
          <p>We may share your personal data with:</p>
          <ul className="check-list">
            {template.sharingList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {!isPartnerConsent && (
            <p>
              For additional information on how Outbox processes personal data, contact us at{" "}
              <a href="mailto:zulu@outbox.africa">zulu@outbox.africa</a> or +256 (0) 392 000 152.
            </p>
          )}
          <input type="hidden" name="privacyOrganization" value="Outbox (U) Limited" />
          <input type="hidden" name="privacyPolicyUrl" value="zulu@outbox.africa; +256 (0) 392 000 152" />
        </section>

        <section className="section">
          <h2>4. Your Rights</h2>
          <p>
            You are not obligated to give your consent. You are eligible to participate in all
            aspects of the program, regardless of your decision to share your data. Consent to data
            sharing is entirely separate from program participation. You have the following rights
            regarding your personal data:
          </p>
          <ul className="check-list">
            <li><strong>Right to access:</strong> You have the right to request a copy of the information we hold about you.</li>
            <li><strong>Right to rectification:</strong> You have the right to ask us to correct any inaccurate information we hold about you.</li>
            <li><strong>Right to erasure:</strong> You have the right to ask us to delete your information.</li>
            <li><strong>Right to restriction of processing:</strong> You have the right to ask us to restrict the processing of your information.</li>
            <li><strong>Right to object to processing:</strong> You have the right to object to the processing of your information.</li>
            <li><strong>Right to data portability:</strong> You have the right to request that your data be transferred to another organization.</li>
          </ul>
        </section>

        <section className="section">
          <h2>5. Withdrawing Your Consent</h2>
          <p>
            You can withdraw your consent to share your data at any time. This will not affect your
            ability to participate in the program. To withdraw your consent, please send an email to
            zulu@outbox.africa or call +256 (0) 392 000 152.
          </p>
          <input type="hidden" name="withdrawalContact" value="zulu@outbox.africa; +256 (0) 392 000 152" />
        </section>

        <section className="section">
          <h2>6. Understanding Your Choices</h2>
          <p>
            {template.choiceText}
          </p>

          <div className="consent-box">
            <label className="checkbox-row">
              <input id="consentAgreement" name="consentAgreement" type="checkbox" required />
              <span>
                {template.agreementPrefix}
                {isPartnerConsent ? (
                  <input className="inline-input" aria-label="Organization receiving shared data" name="dataSharingOrganization" required />
                ) : (
                  <>
                    <strong> Outbox </strong>
                    <input type="hidden" name="dataSharingOrganization" value="Outbox" />
                  </>
                )}
                {template.agreementSuffix}
              </span>
            </label>
          </div>
        </section>

        {isPartnerConsent && (
          <section className="section">
            <h2>7. Accept or Decline Partner Data Sharing</h2>
            <div className="decision-options">
              <label className="checkbox-row compact">
                <input name="consentDecision" type="radio" value="consented" required />
                <span>I accept sharing the listed data with the selected partner(s).</span>
              </label>
              <label className="checkbox-row compact">
                <input name="consentDecision" type="radio" value="declined" required />
                <span>I decline sharing my data with third-party partners.</span>
              </label>
            </div>
          </section>
        )}

        {!isPartnerConsent && <input type="hidden" name="consentDecision" value="consented" />}

        <section className="section">
          <h2>Participant Confirmation</h2>
          <div className="grid two">
            <div>
              <label htmlFor="participantName">Participant name</label>
              <input id="participantName" name="participantName" required />
            </div>
            <div>
              <label htmlFor="participantDate">Date</label>
              <input id="participantDate" name="participantDate" type="date" defaultValue={today} readOnly required />
            </div>
          </div>
          <div className="signature-pad">
            <SignaturePad
              label="Participant signature or thumbprint"
              valueName="participantSignatureData"
              onChange={(dataUrl, method) => {
                setParticipantSignature(dataUrl);
                setSigningMethod(method);
              }}
            />
          </div>
        </section>

        <section className="section">
          <h2>Interpreter Confirmation</h2>
          <div className="decision-options interpreter-choice">
            <label className="checkbox-row compact">
              <input
                name="interpreterUsedChoice"
                type="radio"
                checked={!interpreterUsed}
                onChange={() => {
                  setInterpreterUsed(false);
                  setInterpreterSignature("");
                }}
              />
              <span>No interpreter was used.</span>
            </label>
            <label className="checkbox-row compact">
              <input
                name="interpreterUsedChoice"
                type="radio"
                checked={interpreterUsed}
                onChange={() => setInterpreterUsed(true)}
              />
              <span>Yes, an interpreter read or explained this form.</span>
            </label>
          </div>

          {interpreterUsed && (
            <>
              <p className="interpreter-statement">
                I <input aria-label="Interpreter name" name="interpreterName" required /> of{" "}
                <input aria-label="Interpreter organization" name="interpreterOrganization" required /> have distinctly,
                clearly and audibly interpreted/read the above in the{" "}
                <input aria-label="Language or dialect" name="language" required /> language/dialect to the abovenamed
                person who seemed to clearly understand the above and who made his/her mark in my presence.
              </p>
              <div className="grid two">
                <div>
                  <label htmlFor="interpreterDate">Date</label>
                  <input id="interpreterDate" name="interpreterDate" type="date" defaultValue={today} readOnly />
                </div>
                <div>
                  <label htmlFor="interpreterSignatureName">Interpreter name</label>
                  <input id="interpreterSignatureName" name="interpreterSignatureName" />
                </div>
              </div>
              <div className="signature-pad">
                <SignaturePad
                  label="Interpreter signature"
                  valueName="interpreterSignatureData"
                  onChange={(dataUrl) => setInterpreterSignature(dataUrl)}
                />
              </div>
            </>
          )}
        </section>

        <section className="section">
          {message && <p className="form-message error">{message}</p>}
          <div className="footer-actions">
            <button className="secondary" type="reset">
              Clear form
            </button>
            <button className="primary" type="submit">
              Submit completed form
            </button>
          </div>
        </section>
      </form>
    </section>
  );
}
