// components/YouthInWorkTool.tsx

"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

/**
 * Youth in Work Assessment Tool - v3
 *
 * Flow:
 * 1. Select ESO.
 * 2. Search ONLY participants supported by that ESO.
 * 3. Existing participant -> load the master record; name/district stay locked and phone/email may be updated.
 * 4. "Register new" appears immediately below search, not after the result list.
 * 5. New participant -> complete profile -> system checks for an existing record globally.
 * 6. If a match exists, return the existing participant instead of creating a duplicate.
 * 7. If no match exists, continue to the YIW assessment.
 * 8. GPS is requested automatically and captured silently in the background.
 * 9. Save as draft (browser localStorage + manual save) or submit.
 */

type Participant = {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  externalId?: string | null;
  esoName: string;
  district?: string | null;
  region?: string | null;
  hasAssessment: boolean;
  dateOfBirth?: string | null;
  yearOfBirth?: number | null; // legacy server compatibility only
  gender?: string | null;
  subcounty?: string | null;
  parish?: string | null;
  village?: string | null;
  businessName?: string | null;
  sector?: string | null;
  businessSize?: string | null;
  employmentStatus?: string | null;
  employmentType?: string | null;
  educationLevel?: string | null;
  hasDisability?: boolean | null;
  disabilityType?: string | null;
  isRefugee?: boolean | null;
  countryOfOrigin?: string | null;
};

type FormState = {
  participantName: string;
  participantPhone: string;
  participantEmail: string;
  participantExternalId: string;
  dateOfBirth: string;
  gender: string;
  region: string;
  district: string;
  subcounty: string;
  parish: string;
  village: string;
  businessName: string;
  businessSector: string;
  businessSize: string;
  employmentStatus: string;
  employmentType: string;
  employerParticipantId: string;
  educationLevel: string;
  disabilityStatus: string;
  disabilityType: string;
  refugeeStatus: string;
  countryOfOrigin: string;
  foundationCourseStatus: string;
  foundationLearning: string;
  incomeFromProgram: string;
  incomeAmount: string;
  workImproved: string;
  workImprovementDescription: string;
  digitalMarketPlatforms: string;
  digitalFinanceProviders: string;
  businessEfficiencyPlatforms: string;
  notes: string;
};

type GpsState = {
  status:
    | "not_requested"
    | "capturing"
    | "captured"
    | "permission_denied"
    | "timeout"
    | "unavailable"
    | "error"
    | "capture_incomplete";
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  capturedAt?: string;
  error?: string;
};

type DraftRecord = {
  savedAt: string;
  selectedEso: string;
  selected: Participant | null;
  newPerson: boolean;
  newParticipantVerified?: boolean;
  query: string;
  form: FormState;
  improvementOutcomes: string[];
  digitalAdoptions?: string[];
  gps: GpsState;
};

const esoOptions = [
  "AGDI",
  "AID",
  "Challenges Uganda",
  "CURAD",
  "DFCU Foundation",
  "ECHAI/Excelhort",
  "Finding XY",
  "Living Earth Uganda",
  "Mkazipreneur",
  "MUBS EIC",
  "PEDN",
  "Stanbic Bank Incubator",
];

const sectors = [
  "Agriculture",
  "Trade and Service",
  "Fashion",
  "Light Manufacturing",
  "MICE",
  "Health",
];

type YouthInWorkRegion = "Central" | "Eastern" | "Northern" | "Western";

const centralDistricts = [
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

const easternDistricts = [
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

const northernDistricts = [
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

const westernDistricts = [
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

const districtRegionMap = new Map<string, YouthInWorkRegion>([
  ...centralDistricts.map((district) => [district.toLowerCase(), "Central"] as const),
  ...easternDistricts.map((district) => [district.toLowerCase(), "Eastern"] as const),
  ...northernDistricts.map((district) => [district.toLowerCase(), "Northern"] as const),
  ...westernDistricts.map((district) => [district.toLowerCase(), "Western"] as const),
]);

function regionForDistrict(district?: string | null): YouthInWorkRegion | "" {
  const key = String(district ?? "").trim().toLowerCase();
  return key ? districtRegionMap.get(key) || "" : "";
}

const businessSizes = ["Micro", "Small", "Medium"];

const educationLevels = [
  "Primary Education",
  "Secondary Education",
  "University",
  "Vocational/Technical Education",
];

const employmentTypes = ["Part-time", "Full-time"];

const countryOptions = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "American Samoa",
  "Andorra",
  "Angola",
  "Anguilla",
  "Antarctica",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Aruba",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bermuda",
  "Bhutan",
  "Bolivia",
  "Bonaire, Sint Eustatius and Saba",
  "Bosnia and Herzegovina",
  "Botswana",
  "Bouvet Island",
  "Brazil",
  "British Indian Ocean Territory",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cayman Islands",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Christmas Island",
  "Cocos (Keeling) Islands",
  "Colombia",
  "Comoros",
  "Cook Islands",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Curaçao",
  "Cyprus",
  "Czechia",
  "Côte d\"Ivoire",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Falkland Islands (Malvinas)",
  "Faroe Islands",
  "Fiji",
  "Finland",
  "France",
  "French Guiana",
  "French Polynesia",
  "French Southern Territories",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Gibraltar",
  "Greece",
  "Greenland",
  "Grenada",
  "Guadeloupe",
  "Guam",
  "Guatemala",
  "Guernsey",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Heard Island and McDonald Islands",
  "Holy See (Vatican City State)",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Isle of Man",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jersey",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Macao",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Martinique",
  "Mauritania",
  "Mauritius",
  "Mayotte",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Montserrat",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Caledonia",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "Niue",
  "Norfolk Island",
  "North Korea",
  "North Macedonia",
  "Northern Mariana Islands",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Pitcairn",
  "Poland",
  "Portugal",
  "Puerto Rico",
  "Qatar",
  "Republic of the Congo",
  "Romania",
  "Russia",
  "Rwanda",
  "Réunion",
  "Saint Barthélemy",
  "Saint Helena, Ascension and Tristan da Cunha",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Martin (French part)",
  "Saint Pierre and Miquelon",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Sint Maarten (Dutch part)",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Georgia and the South Sandwich Islands",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Svalbard and Jan Mayen",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tokelau",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkmenistan",
  "Turks and Caicos Islands",
  "Tuvalu",
  "Türkiye",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "United States Minor Outlying Islands",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Venezuela",
  "Vietnam",
  "Virgin Islands, British",
  "Virgin Islands, U.S.",
  "Wallis and Futuna",
  "Western Sahara",
  "Yemen",
  "Zambia",
  "Zimbabwe",
  "Åland Islands",
];

const districts = [
  "Abim", "Adjumani", "Agago", "Alebtong", "Amolatar", "Amudat", "Amuria", "Amuru", "Apac", "Arua",
  "Terego", "Budaka", "Bududa", "Bugiri", "Bugweri", "Buhweju", "Buikwe", "Bukedea", "Bukomansimbi", "Bukwo",
  "Bulambuli", "Buliisa", "Bundibugyo", "Bunyangabu", "Bushenyi", "Busia", "Butaleja", "Butambala", "Butebo", "Buvuma",
  "Buyende", "Dokolo", "Gomba", "Gulu", "Hoima", "Ibanda", "Iganga", "Isingiro", "Jinja", "Kaabong", "Kabale",
  "Kabarole", "Kaberamaido", "Kagadi", "Kakumiro", "Kalaki", "Kalangala", "Kaliro", "Kampala", "Kamuli", "Kamwenge",
  "Kanungu", "Kapchorwa", "Kapelebyong", "Karenga", "Kasese", "Kassanda", "Katakwi", "Kayunga", "Kazo", "Kibaale",
  "Kiboga", "Kibuku", "Kikuube", "Kiruhura", "Kiryandongo", "Kisoro", "Kitgum", "Koboko", "Kole", "Kotido",
  "Kumi", "Kwania", "Kween", "Kyankwanzi", "Kyegegwa", "Kyenjojo", "Kyotera", "Lamwo", "Lira", "Luuka",
  "Luwero", "Lwengo", "Lyantonde", "Madi Okollo", "Manafwa", "Maracha", "Masaka", "Masindi", "Mayuge", "Mbale",
  "Mbarara", "Mitooma", "Mityana", "Moroto", "Moyo", "Mpigi", "Mubende", "Mukono", "Nabilatuk", "Nakapiripirit",
  "Nakaseke", "Nakasongola", "Namayingo", "Namisindwa", "Namutumba", "Napak", "Nebbi", "Ngora", "Ntoroko", "Ntungamo",
  "Nwoya", "Obongi", "Omoro", "Otuke", "Oyam", "Pader", "Pakwach", "Pallisa", "Rakai", "Rubanda", "Rubirizi",
  "Rukiga", "Rukungiri", "Rwampara", "Serere", "Sheema", "Sironko", "Soroti", "Ssembabule", "Tororo", "Wakiso",
  "Yumbe", "Zombo",
];

const improvementOptions = [
  "Higher income",
  "Respect at workplace",
  "Sense of purpose",
  "Good reputation",
];

// Provisional until the Program's approved disability classification is supplied.
const disabilityTypes = [
  "Physical disability",
  "Visual impairment",
  "Hearing impairment",
  "Speech / communication disability",
  "Intellectual / learning disability",
  "Psychosocial disability",
  "Multiple disabilities",
];

const initialForm: FormState = {
  participantName: "",
  participantPhone: "",
  participantEmail: "",
  participantExternalId: "",
  dateOfBirth: "",
  gender: "",
  region: "",
  district: "",
  subcounty: "",
  parish: "",
  village: "",
  businessName: "",
  businessSector: "",
  businessSize: "",
  employmentStatus: "",
  employmentType: "",
  employerParticipantId: "",
  educationLevel: "",
  disabilityStatus: "",
  disabilityType: "",
  refugeeStatus: "",
  countryOfOrigin: "",
  foundationCourseStatus: "",
  foundationLearning: "",
  incomeFromProgram: "",
  incomeAmount: "",
  workImproved: "",
  workImprovementDescription: "",
  digitalMarketPlatforms: "",
  digitalFinanceProviders: "",
  businessEfficiencyPlatforms: "",
  notes: "",
};

const initialGps: GpsState = { status: "not_requested" };

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function draftKeyFor(selectedEso: string, selected: Participant | null, newPerson: boolean) {
  if (!selectedEso) return null;
  if (selected) return `yiw-draft:participant:${selected.id}`;
  if (newPerson) return `yiw-draft:new:${selectedEso}`;
  return null;
}

function textToList(value: string) {
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

function yesNoToBoolean(value: string) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

const placeholderValues = new Set([
  "test",
  "test user",
  "unknown",
  "n/a",
  "na",
  "none",
  "xxx",
  "sample",
  "demo",
  "dummy",
  "asdf",
  "qwerty",
]);

function validateFullName(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) return "Enter the participant's full name.";
  if (placeholderValues.has(clean.toLowerCase())) {
    return "Enter the participant's real full name, not placeholder data.";
  }
  if (/\d/.test(clean)) return "Full name cannot contain numbers.";
  if (!/^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*)+$/u.test(clean)) {
    return "Enter at least two valid names using letters only.";
  }
  return "";
}

function sanitizePhoneInput(value: string) {
  const trimmed = value.trimStart();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "").slice(0, 15);
  return `${hasPlus ? "+" : ""}${digits}`;
}

function validatePhone(value: string) {
  const clean = value.trim();
  if (!clean) return "Enter the participant's phone number.";
  if (!/^\+?\d{9,15}$/.test(clean)) {
    return "Enter a valid phone number using digits only, with an optional + at the beginning.";
  }
  return "";
}

function validateEmail(value: string) {
  const clean = value.trim();
  if (!clean) return "Enter the participant's primary email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return "Enter a valid primary email address.";
  return "";
}

function formatDobInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function displayDob(value?: string | null) {
  if (!value) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function validateDateOfBirth(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "Enter date of birth as DD/MM/YYYY.";

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "Enter a valid calendar date of birth.";
  }

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    )
  );

  if (date > todayUtc) {
    return "Date of birth cannot be in the future.";
  }

  let age =
    todayUtc.getUTCFullYear() -
    date.getUTCFullYear();

  const birthdayThisYear = new Date(
    Date.UTC(
      todayUtc.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );

  if (todayUtc < birthdayThisYear) {
    age -= 1;
  }

  if (age < 18 || age > 37) {
    return "New participants must be aged 18 to 37 years.";
  }
  return "";
}

function validateRequiredText(value: string, label: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < 2) return `Enter a valid ${label}.`;
  if (placeholderValues.has(clean.toLowerCase())) return `Enter a valid ${label}, not placeholder data.`;
  return "";
}

export function YouthInWorkTool() {
  const [selectedEso, setSelectedEso] = useState("");
  const [query, setQuery] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Participant | null>(null);
  const [newPerson, setNewPerson] = useState(false);
  const [newParticipantVerified, setNewParticipantVerified] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<Participant | null>(null);
  const [duplicateMatchReason, setDuplicateMatchReason] = useState("");
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);

  const [employerQuery, setEmployerQuery] = useState("");
  const [employerResults, setEmployerResults] = useState<Participant[]>([]);
  const [selectedEmployer, setSelectedEmployer] = useState<Participant | null>(null);
  const [searchingEmployers, setSearchingEmployers] = useState(false);
  const [employerError, setEmployerError] = useState("");

  const [improvementOutcomes, setImprovementOutcomes] = useState<string[]>([]);
  const [digitalAdoptions, setDigitalAdoptions] = useState<string[]>([]);
  const [gps, setGps] = useState<GpsState>(initialGps);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");

  const [evidencePhotoData, setEvidencePhotoData] =
    useState("");

  const [evidencePhotoName, setEvidencePhotoName] =
    useState("");

  const [evidencePhotoError, setEvidencePhotoError] =
    useState("");

  const draftStarted = Boolean(selectedEso && (selected || newPerson));
  const assessmentStarted = Boolean(
    selectedEso && (selected || (newPerson && newParticipantVerified)),
  );

  const incomeYes = form.incomeFromProgram === "yes";
  const improvedYes = form.workImproved === "yes";
  const foundationYes = form.foundationCourseStatus === "yes";
  const foundationInProgress = [
    "currently_enrolled",
    "started_but_not_completed",
  ].includes(form.foundationCourseStatus);

  const currentDraftKey = useMemo(
    () => draftKeyFor(selectedEso, selected, newPerson),
    [selectedEso, selected, newPerson],
  );

  function updateField(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  type RegistrationControl =
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement;

  function getRegistrationControl(
    field: keyof FormState,
    labelText = "",
  ): RegistrationControl | null {
    const selectors: Partial<Record<keyof FormState, string>> = {
      participantName:
        '#yiw-participant-name-new, #yiw-name-new, input[name="participantName"]',
      participantPhone:
        '#yiw-phone-new, input[name="participantPhone"], input[type="tel"]',
      participantEmail:
        '#yiw-email-new, input[name="participantEmail"], input[type="email"]',
      dateOfBirth:
        '#yiw-dob, input[name="dateOfBirth"]',
      gender:
        'input[name="gender"]',
      region:
        '#yiw-region-new, select[id*="region"], input[id*="region"]',
      district:
        '#yiw-district-new, select[id*="district"]',
      subcounty:
        '#yiw-subcounty-new, input[id*="subcounty"]',
      parish:
        '#yiw-parish-new, input[id*="parish"]',
      village:
        '#yiw-village-new, input[id*="village"]',
      businessName:
        '#yiw-business-name-new',
      businessSize:
        '#yiw-business-size-new',
      employmentType:
        '#yiw-employment-new',
      educationLevel:
        '#yiw-education-new',
      disabilityStatus:
        'input[name="disabilityStatus"], input[name="disability"]',
      disabilityType:
        '#yiw-disability-type-new, select[id*="disability-type"]',
      refugeeStatus:
        'input[name="refugeeStatus"], input[name="refugee"]',
      countryOfOrigin:
        '#yiw-country-origin-new, select[id*="country"], input[id*="country"]',
    };

    const selector = selectors[field];

    if (selector) {
      const direct =
        document.querySelector<RegistrationControl>(selector);

      if (direct) return direct;
    }

    if (labelText) {
      const labels =
        Array.from(
          document.querySelectorAll<HTMLLabelElement>("label"),
        );

      const matchingLabel =
        labels.find((label) =>
          (label.textContent || "")
            .toLowerCase()
            .includes(labelText.toLowerCase()),
        );

      if (matchingLabel) {
        if (matchingLabel.htmlFor) {
          const byId =
            document.getElementById(
              matchingLabel.htmlFor,
            ) as RegistrationControl | null;

          if (byId) return byId;
        }

        const fieldContainer =
          matchingLabel.closest(".yiw-field");

        const inside =
          fieldContainer?.querySelector<RegistrationControl>(
            "input, select, textarea",
          );

        if (inside) return inside;
      }
    }

    return null;
  }

  function clearRegistrationFieldError(
    field: keyof FormState,
  ) {
    document
      .querySelectorAll(
        `[data-yiw-error-for="${String(field)}"]`,
      )
      .forEach((element) => element.remove());

    const control =
      getRegistrationControl(field);

    if (!control) return;

    control.setCustomValidity("");
    control.removeAttribute("aria-invalid");
    control.style.borderColor = "";
    control.style.boxShadow = "";
  }

  function clearAllRegistrationFieldErrors() {
    (
      [
        "participantName",
        "participantPhone",
        "participantEmail",
        "dateOfBirth",
        "gender",
        "region",
        "district",
        "subcounty",
        "parish",
        "village",
        "businessName",
        "businessSize",
        "employmentStatus",
        "educationLevel",
        "disabilityStatus",
        "disabilityType",
        "refugeeStatus",
        "countryOfOrigin",
      ] as Array<keyof FormState>
    ).forEach(clearRegistrationFieldError);
  }

  function showRegistrationFieldError(
    field: keyof FormState,
    message: string,
    labelText = "",
  ) {
    clearRegistrationFieldError(field);

    // Field validation belongs beside the field, not in the
    // global message box at the bottom of the page.
    setMessage("");

    const control =
      getRegistrationControl(
        field,
        labelText,
      );

    if (!control) {
      // Safe fallback if a future UI change removes an expected
      // field selector.
      setMessage(message);
      return false;
    }

    control.setCustomValidity(message);
    control.setAttribute(
      "aria-invalid",
      "true",
    );

    control.style.borderColor = "#b42318";
    control.style.boxShadow =
      "0 0 0 1px #b42318";

    const fieldContainer =
      control.closest(".yiw-field") ||
      control.parentElement;

    if (fieldContainer) {
      const error =
        document.createElement("span");

      error.dataset.yiwErrorFor =
        String(field);

      error.setAttribute(
        "role",
        "alert",
      );

      error.textContent = message;

      error.style.display = "block";
      error.style.marginTop = "5px";
      error.style.fontSize = "0.78rem";
      error.style.fontWeight = "600";
      error.style.color = "#b42318";

      fieldContainer.appendChild(error);
    }

    requestAnimationFrame(() => {
      (
        fieldContainer || control
      ).scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      control.focus({
        preventScroll: true,
      });
    });

    return false;
  }

  function updateRegistrationField(name: keyof FormState, value: string) {
    clearRegistrationFieldError(name);

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "district"
        ? { region: regionForDistrict(value) }
        : {}),
    }));

    if (newPerson && newParticipantVerified) {
      setNewParticipantVerified(false);
      setDuplicateMatch(null);
      setDuplicateMatchReason("");
      setMessage("Participant details changed. Check the participant again before continuing.");
    }
  }

  function resetAssessmentFields() {
    setForm(initialForm);
    setEmployerQuery("");
    setEmployerResults([]);
    setSelectedEmployer(null);
    setSearchingEmployers(false);
    setEmployerError("");
    setImprovementOutcomes([]);
    setDigitalAdoptions([]);
    setGps(initialGps);
    setEditingEmail(false);
    setEditingPhone(false);
    setNewParticipantVerified(false);
    setDuplicateMatch(null);
    setDuplicateMatchReason("");
    setCheckingDuplicate(false);
    setDraftSavedAt("");
  }

  function resetParticipantSelection(keepEso = true) {
    setSelected(null);
    setNewPerson(false);
    setQuery("");
    setParticipants([]);
    setMessage("");
    resetAssessmentFields();
    if (!keepEso) setSelectedEso("");
  }

  function handleEsoChange(value: string) {
    setSelectedEso(value);
    setSelected(null);
    setNewPerson(false);
    setQuery("");
    setParticipants([]);
    setMessage("");
    resetAssessmentFields();
  }

  useEffect(() => {
    if (!selectedEso || query.trim().length < 2 || selected || newPerson) {
      setParticipants([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setMessage("");
      try {
        const params = new URLSearchParams({ q: query.trim(), eso: selectedEso });
        const response = await fetch(`/api/youth-in-work/participants?${params.toString()}`);
        if (!response.ok) throw new Error("Participant search failed.");
        const data = await response.json();
        const returned: Participant[] = data.participants || [];
        const allowed = returned.filter(
          (participant) => normalize(participant.esoName || "") === normalize(selectedEso),
        );
        setParticipants(allowed);
      } catch {
        setParticipants([]);
        setMessage("Participant search is unavailable.");
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedEso, query, selected, newPerson]);

  useEffect(() => {
    if (
      !newPerson ||
      !selectedEso ||
      selectedEmployer ||
      employerQuery.trim().length < 2
    ) {
      setEmployerResults([]);
      return;
    }

    const timer =
      setTimeout(async () => {
        setSearchingEmployers(true);
        setEmployerError("");

        try {
          const params =
            new URLSearchParams({
              q: employerQuery.trim(),
              eso: selectedEso,
            });

          const response =
            await fetch(
              `/api/youth-in-work/employers?${params.toString()}`,
            );

          if (!response.ok) {
            throw new Error(
              "Employer search failed.",
            );
          }

          const data =
            await response.json();

          setEmployerResults(
            data.employers || [],
          );
        } catch {
          setEmployerResults([]);
          setEmployerError(
            "Employer search is unavailable.",
          );
        } finally {
          setSearchingEmployers(false);
        }
      }, 300);

    return () =>
      clearTimeout(timer);
  }, [
    newPerson,
    selectedEso,
    employerQuery,
    selectedEmployer,
  ]);

  function chooseEmployer(
    employer: Participant,
  ) {
    setSelectedEmployer(employer);

    setEmployerQuery(
      employer.fullName,
    );

    setEmployerResults([]);
    setEmployerError("");

    /*
     * Employer owns the enterprise.
     * These values are assessment context only; the new worker
     * must not be treated as the owner of this business.
     */
    setForm((current) => ({
      ...current,

      employerParticipantId:
        employer.id,

      employmentStatus: "Wage employment",
      employmentType: "",

      businessName:
        employer.businessName || "",

      businessSector:
        employer.sector || "",

      businessSize:
        employer.businessSize || "",
    }));
  }

  function clearEmployer() {
    setSelectedEmployer(null);
    setEmployerQuery("");
    setEmployerResults([]);
    setEmployerError("");

    setForm((current) => ({
      ...current,

      employerParticipantId: "",
      employmentStatus: "",
      employmentType: "",

      businessName: "",
      businessSector: "",
      businessSize: "",
    }));
  }
  function restoreDraft(key: string) {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return false;
      const draft = JSON.parse(stored) as DraftRecord;
      setSelectedEso(draft.selectedEso);
      setSelected(draft.selected);
      setNewPerson(draft.newPerson);
      setNewParticipantVerified(Boolean(draft.newParticipantVerified));
      setQuery(draft.query || "");

      const restoredForm = {
        ...initialForm,
        ...(draft.form || {}),
      };

      if (restoredForm.district) {
        restoredForm.region =
          regionForDistrict(restoredForm.district) ||
          restoredForm.region;
      }

      setForm(restoredForm);
      setImprovementOutcomes(draft.improvementOutcomes || []);
      setDigitalAdoptions(draft.digitalAdoptions || []);
      setGps({ ...initialGps, ...(draft.gps || {}) });
      setDraftSavedAt(draft.savedAt);
      setDuplicateMatch(null);
      setDuplicateMatchReason("");
      if (draft.selected) {
        setEditingEmail(!draft.form?.participantEmail);
        setEditingPhone(!draft.form?.participantPhone);
      } else if (draft.newPerson) {
        setEditingEmail(true);
        setEditingPhone(true);
      }
      return true;
    } catch {
      return false;
    }
  }

  function saveDraft(showMessage = true) {
    if (!currentDraftKey || !draftStarted) return;
    const draft: DraftRecord = {
      savedAt: new Date().toISOString(),
      selectedEso,
      selected,
      newPerson,
      newParticipantVerified,
      query,
      form,
      improvementOutcomes,
      digitalAdoptions,
      gps,
    };
    try {
      localStorage.setItem(currentDraftKey, JSON.stringify(draft));
      setDraftSavedAt(draft.savedAt);
      if (showMessage) {
        const savedAt = new Date(draft.savedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        setMessage(`Draft saved at ${savedAt}.`);
      }
    } catch {
      if (showMessage) setMessage("Draft could not be saved on this device.");
    }
  }

  useEffect(() => {
    if (!draftStarted || !currentDraftKey) return;
    const timer = setTimeout(() => saveDraft(false), 1200);
    return () => clearTimeout(timer);
  }, [
    draftStarted,
    currentDraftKey,
    selectedEso,
    selected,
    newPerson,
    newParticipantVerified,
    query,
    form,
    improvementOutcomes,
    digitalAdoptions,
    gps,
  ]);

  function applyParticipantToForm(participant: Participant, fallback?: Partial<FormState>) {
    setForm({
      ...initialForm,
      ...fallback,
      participantName: participant.fullName || fallback?.participantName || "",
      participantPhone: participant.phone || fallback?.participantPhone || "",
      participantEmail: participant.email || fallback?.participantEmail || "",
      participantExternalId: participant.externalId || fallback?.participantExternalId || "",
      dateOfBirth: displayDob(participant.dateOfBirth) || fallback?.dateOfBirth || "",
      gender: participant.gender || fallback?.gender || "",
      district: participant.district || fallback?.district || "",
      region: regionForDistrict(participant.district) || participant.region || fallback?.region || "",
      subcounty: participant.subcounty || fallback?.subcounty || "",
      parish: participant.parish || fallback?.parish || "",
      village: participant.village || fallback?.village || "",
      businessName: participant.businessName || fallback?.businessName || "",
      businessSector: participant.sector || fallback?.businessSector || "",
      businessSize: participant.businessSize || fallback?.businessSize || "",
      employmentStatus: participant.employmentStatus || fallback?.employmentStatus || "",
      employmentType: participant.employmentType || fallback?.employmentType || "",
      educationLevel: participant.educationLevel || fallback?.educationLevel || "",
      disabilityStatus:
        typeof participant.hasDisability === "boolean"
          ? participant.hasDisability
            ? "yes"
            : "no"
          : fallback?.disabilityStatus || "",
      disabilityType: participant.disabilityType || fallback?.disabilityType || "",
      refugeeStatus:
        typeof participant.isRefugee === "boolean"
          ? participant.isRefugee
            ? "yes"
            : "no"
          : fallback?.refugeeStatus || "",
      countryOfOrigin: participant.countryOfOrigin || fallback?.countryOfOrigin || "",
    });
  }

  function chooseParticipant(participant: Participant) {
    if (!selectedEso) {
      setMessage("Select an ESO before choosing a participant.");
      return;
    }
    if (normalize(participant.esoName || "") !== normalize(selectedEso)) {
      setMessage("This participant is not attached to the selected ESO and cannot be assessed here.");
      return;
    }
    if (participant.hasAssessment) {
      setMessage(`${participant.fullName} already has a submitted Youth in Work assessment.`);
      return;
    }

    const key = `yiw-draft:participant:${participant.id}`;
    const hasDraft = localStorage.getItem(key);
    if (
      hasDraft &&
      window.confirm(`A saved draft exists for ${participant.fullName}. Continue from that draft?`)
    ) {
      restoreDraft(key);
      setParticipants([]);
      setMessage("Saved draft restored.");
      return;
    }

    setSelected(participant);
    setNewPerson(false);
    setNewParticipantVerified(false);
    setDuplicateMatch(null);
    setDuplicateMatchReason("");
    setParticipants([]);
    setQuery(participant.fullName);
    applyParticipantToForm(participant);
    setEditingEmail(!participant.email);
    setEditingPhone(!participant.phone);
    setImprovementOutcomes([]);
    setDigitalAdoptions([]);
    setGps(initialGps);
    setDraftSavedAt("");
    setMessage("");
  }

  function startNewParticipant() {
    if (!selectedEso) {
      setMessage("Select an ESO first.");
      return;
    }

    const key = `yiw-draft:new:${selectedEso}`;
    const hasDraft = localStorage.getItem(key);
    if (
      hasDraft &&
      window.confirm(`A saved new-participant draft exists for ${selectedEso}. Continue from that draft?`)
    ) {
      restoreDraft(key);
      setParticipants([]);
      setMessage("Saved draft restored.");
      return;
    }

    setSelected(null);
    setNewPerson(true);
    setQuery("");
    setParticipants([]);
    setMessage("");
    resetAssessmentFields();
    setEditingEmail(true);
    setEditingPhone(true);
  }

  function editNewParticipantDetails() {
    setNewParticipantVerified(false);
    setDuplicateMatch(null);
    setDuplicateMatchReason("");
    setMessage("Update the participant details, then check again before continuing.");
  }

  function validateNewParticipantRegistration() {
    clearAllRegistrationFieldErrors();
    setEmployerError("");

    const nameError =
      validateFullName(
        form.participantName,
      );

    if (nameError) {
      return showRegistrationFieldError(
        "participantName",
        nameError,
        "Full name",
      );
    }

    const phoneError =
      validatePhone(
        form.participantPhone,
      );

    if (phoneError) {
      return showRegistrationFieldError(
        "participantPhone",
        phoneError,
        "Phone number",
      );
    }

    const emailError =
      validateEmail(
        form.participantEmail,
      );

    if (emailError) {
      return showRegistrationFieldError(
        "participantEmail",
        emailError,
        "Primary email",
      );
    }

    const dobError =
      validateDateOfBirth(
        form.dateOfBirth,
      );

    if (dobError) {
      return showRegistrationFieldError(
        "dateOfBirth",
        dobError,
        "Date of birth",
      );
    }

    if (!form.gender) {
      return showRegistrationFieldError(
        "gender",
        "Select the participant's gender.",
        "gender",
      );
    }

    if (!form.region) {
      return showRegistrationFieldError(
        "region",
        "Select the participant's region.",
        "Region",
      );
    }

    if (!form.district) {
      return showRegistrationFieldError(
        "district",
        "Select the participant's district.",
        "District",
      );
    }

    for (const [field, value, label] of [
      ["subcounty", form.subcounty, "Subcounty / Town Council"],
      ["parish", form.parish, "Parish / Ward"],
      ["village", form.village, "Village / Cell"],
    ] as const) {
      const error =
        validateRequiredText(
          value,
          label,
        );

      if (error) {
        return showRegistrationFieldError(
          field,
          error,
          label,
        );
      }
    }

    if (form.employerParticipantId && !["Part-time", "Full-time"].includes(form.employmentType)) {
      return showRegistrationFieldError(
        "employmentStatus",
        "Select the participant's employment status.",
        "Employment status",
      );
    }

    if (!form.employerParticipantId) {
      setEmployerError(
        "Select an existing Self-employed participant as the employer.",
      );

      requestAnimationFrame(() => {
        const element =
          document.getElementById(
            "yiw-employer-search-new",
          );

        element?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        (
          element as HTMLInputElement | null
        )?.focus({
          preventScroll: true,
        });
      });

      return false;
    }


    if (!form.educationLevel) {
      return showRegistrationFieldError(
        "educationLevel",
        "Select the participant's highest level of education.",
        "highest level of education",
      );
    }

    if (!form.disabilityStatus) {
      return showRegistrationFieldError(
        "disabilityStatus",
        "Select the participant's disability status.",
        "Disability status",
      );
    }

    if (
      form.disabilityStatus === "yes" &&
      !form.disabilityType
    ) {
      return showRegistrationFieldError(
        "disabilityType",
        "Select the participant's disability type.",
        "Disability type",
      );
    }

    if (!form.refugeeStatus) {
      return showRegistrationFieldError(
        "refugeeStatus",
        "Select the participant's refugee status.",
        "Refugee status",
      );
    }

    if (
      form.refugeeStatus === "yes" &&
      !form.countryOfOrigin
    ) {
      return showRegistrationFieldError(
        "countryOfOrigin",
        "Select the participant's country of origin.",
        "country of origin",
      );
    }

    return true;
  }

  async function checkNewParticipant() {
    if (!newPerson) return;
    setMessage("");
    setDuplicateMatch(null);
    setDuplicateMatchReason("");
    if (!validateNewParticipantRegistration()) return;

    setCheckingDuplicate(true);
    try {
      const response = await fetch("/api/youth-in-work/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantName: form.participantName.trim(),
          participantPhone: form.participantPhone.trim(),
          participantEmail: form.participantEmail.trim(),
          participantExternalId: form.participantExternalId.trim(),
          esoName: selectedEso,
          district: form.district,
          dateOfBirth: form.dateOfBirth,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Could not check the participant.");
        return;
      }
      if (data.matchFound && data.participant) {
        setDuplicateMatch(data.participant as Participant);
        setDuplicateMatchReason(String(data.matchReason || ""));
        setNewParticipantVerified(false);
        setMessage(
          data.participant.hasAssessment
            ? "This participant already exists and already has a submitted Youth in Work assessment."
            : "An existing participant matches these details. Review the record below.",
        );
        return;
      }
      setNewParticipantVerified(true);
      setMessage("New participant verified. No existing record was found. Continue with the assessment.");
    } catch {
      setMessage("Could not check the participant. Please try again.");
    } finally {
      setCheckingDuplicate(false);
    }
  }

  function useDuplicateParticipant() {
    if (!duplicateMatch) return;
    if (duplicateMatch.hasAssessment) {
      setMessage(`${duplicateMatch.fullName} already has a submitted Youth in Work assessment.`);
      return;
    }

    const previousForm = form;
    setSelectedEso(duplicateMatch.esoName);
    setSelected(duplicateMatch);
    setNewPerson(false);
    setNewParticipantVerified(false);
    setDuplicateMatch(null);
    setDuplicateMatchReason("");
    setParticipants([]);
    setQuery(duplicateMatch.fullName);
    applyParticipantToForm(duplicateMatch, previousForm);
    setEditingEmail(!(duplicateMatch.email || previousForm.participantEmail));
    setEditingPhone(!(duplicateMatch.phone || previousForm.participantPhone));
    setImprovementOutcomes([]);
    setDigitalAdoptions([]);
    setGps(initialGps);
    setDraftSavedAt("");
    setMessage(`Existing participant selected under ${duplicateMatch.esoName}.`);
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setGps({ status: "unavailable", error: "This browser does not support geolocation." });
      return;
    }

    setGps((current) => ({ ...current, status: "capturing", error: undefined }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          status: "captured",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
      },
      (error) => {
        if (error.code === 1) {
          setGps({ status: "permission_denied", error: "Location permission was denied." });
          return;
        }
        if (error.code === 3) {
          setGps({ status: "timeout", error: "Location capture timed out." });
          return;
        }
        setGps({ status: "error", error: error.message || "Location could not be captured." });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  useEffect(() => {
    if (!draftStarted || gps.status !== "not_requested") return;
    captureLocation();
  }, [draftStarted, gps.status]);

  function toggleOutcome(value: string) {
    setImprovementOutcomes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function toggleDigitalAdoption(value: string) {
    setDigitalAdoptions((current) => {
      if (current.includes(value)) {
        if (value === "markets") updateField("digitalMarketPlatforms", "");
        if (value === "finance") updateField("digitalFinanceProviders", "");
        if (value === "efficiency") updateField("businessEfficiencyPlatforms", "");
        return current.filter((item) => item !== value);
      }
      return [...current, value];
    });
  }

  function validateBeforeSubmit() {
    if (!selectedEso) {
      setMessage("Select an ESO.");
      return false;
    }
    if (!selected && !(newPerson && newParticipantVerified)) {
      setMessage("Select an existing participant or verify a new participant before continuing.");
      return false;
    }
    if (newPerson) {
      if (!validateNewParticipantRegistration()) return false;
      if (!newParticipantVerified) {
        setMessage("Check the new participant for an existing record before submitting.");
        return false;
      }
    }

    /*
     * Existing participants come from the master participant dataset.
     * Do not force the enumerator to re-enter profile fields that are
     * missing from historical/imported records. Only validate a contact
     * field if the enumerator actually changed it.
     */
    if (selected) {
      const originalPhone = (selected.phone || "").trim();
      const currentPhone = form.participantPhone.trim();

      if (currentPhone && currentPhone !== originalPhone) {
        const phoneError = validatePhone(currentPhone);
        if (phoneError) {
          setEditingPhone(true);
          setMessage(phoneError);
          return false;
        }
      }

      const originalEmail = (selected.email || "").trim().toLowerCase();
      const currentEmail = form.participantEmail.trim();

      if (
        currentEmail &&
        currentEmail.toLowerCase() !== originalEmail
      ) {
        const emailError = validateEmail(currentEmail);
        if (emailError) {
          setEditingEmail(true);
          setMessage(emailError);
          return false;
        }
      }
    }

    if (!newPerson && !form.businessSector) {
      setMessage("Select the participant's Enterprise / Business sector.");
      return false;
    }
    if (!form.foundationCourseStatus) {
      setMessage("Answer the 10X Business Foundation Course question.");
      return false;
    }
    if ((foundationYes || foundationInProgress) && !form.foundationLearning.trim()) {
      setMessage("Complete the Foundation Course learning question.");
      return false;
    }
    if (!form.incomeFromProgram) {
      setMessage("Answer whether the participant earned income from the 10X Program.");
      return false;
    }
    if (incomeYes && !/^\d+$/.test(form.incomeAmount)) {
      setMessage("Income amount must contain numbers only.");
      return false;
    }
    if (!form.workImproved) {
      setMessage("Answer whether the participant's working conditions improved.");
      return false;
    }
    if (improvedYes && !form.workImprovementDescription.trim()) {
      setMessage("Describe how the participant's work improved.");
      return false;
    }
    if (improvedYes && !improvementOutcomes.length) {
      setMessage("Select at least one improvement outcome.");
      return false;
    }
    if (digitalAdoptions.includes("markets") && !form.digitalMarketPlatforms.trim()) {
      setMessage("Enter the digital market platform used.");
      return false;
    }
    if (digitalAdoptions.includes("finance") && !form.digitalFinanceProviders.trim()) {
      setMessage("Enter the digital finance provider used.");
      return false;
    }
    if (digitalAdoptions.includes("efficiency") && !form.businessEfficiencyPlatforms.trim()) {
      setMessage("Enter the digital platform or tool used to improve business efficiency.");
      return false;
    }
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!validateBeforeSubmit()) return;
    setSaving(true);

    /*
     * GPS capture is intentionally non-blocking.
     *
     * "capturing" is a transient browser/UI state and must never be persisted as
     * the final status of a submitted assessment. If the enumerator submits
     * before the browser resolves geolocation, record an explicit final status
     * instead of leaving the database permanently saying "capturing".
     */
    const submittedGps: GpsState =
      gps.status === "capturing"
        ? {
            ...gps,
            status: "capture_incomplete",
            error:
              gps.error ||
              "Location capture had not completed before the assessment was submitted.",
          }
        : gps;

    try {
      const response = await fetch("/api/youth-in-work/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: selected?.id,
          participantName: form.participantName.trim(),
          participantPhone: newPerson
            ? form.participantPhone.trim()
            : form.participantPhone.trim() &&
                form.participantPhone.trim() !== (selected?.phone || "").trim()
              ? form.participantPhone.trim()
              : undefined,
          participantEmail: newPerson
            ? form.participantEmail.trim()
            : form.participantEmail.trim() &&
                form.participantEmail.trim().toLowerCase() !==
                  (selected?.email || "").trim().toLowerCase()
              ? form.participantEmail.trim()
              : undefined,
          participantExternalId: newPerson
            ? form.participantExternalId.trim()
            : undefined,
          esoName: selectedEso,
          dateOfBirth: newPerson ? form.dateOfBirth : undefined,
          gender: newPerson ? form.gender : undefined,
          region: newPerson ? form.region.trim() : undefined,
          district: newPerson ? form.district : undefined,
          subcounty: newPerson ? form.subcounty.trim() : undefined,
          parish: newPerson ? form.parish.trim() : undefined,
          village: newPerson ? form.village.trim() : undefined,
          businessName: newPerson ? form.businessName.trim() : undefined,
          businessSector: form.businessSector,
          businessSize: newPerson ? undefined : form.businessSize,
          employmentStatus: newPerson ? "Wage employment" : undefined,
          employmentType: newPerson ? form.employmentType : undefined,
          employerParticipantId: newPerson ? form.employerParticipantId : undefined,
          educationLevel: newPerson ? form.educationLevel.trim() : undefined,
          hasDisability: newPerson
            ? yesNoToBoolean(form.disabilityStatus)
            : undefined,
          disabilityType:
            newPerson && form.disabilityStatus === "yes"
              ? form.disabilityType
              : undefined,
          isRefugee: newPerson
            ? yesNoToBoolean(form.refugeeStatus)
            : undefined,
          countryOfOrigin:
            newPerson && form.refugeeStatus === "yes"
              ? form.countryOfOrigin.trim()
              : undefined,
          foundationCourseStatus: form.foundationCourseStatus,
          foundationLearning: form.foundationLearning.trim(),
          incomeFromProgram: form.incomeFromProgram,
          incomeAmount: incomeYes ? form.incomeAmount : undefined,
          workImproved: form.workImproved,
          workImprovementDescription: improvedYes ? form.workImprovementDescription.trim() : "",
          improvementOutcomes: improvedYes ? improvementOutcomes : [],
          digitalMarketsAccess: digitalAdoptions.includes("markets"),
          digitalMarketPlatforms: digitalAdoptions.includes("markets")
            ? textToList(form.digitalMarketPlatforms)
            : [],
          digitalFinanceAccess: digitalAdoptions.includes("finance"),
          digitalFinanceProviders: digitalAdoptions.includes("finance")
            ? textToList(form.digitalFinanceProviders)
            : [],
          businessEfficiencyAccess: digitalAdoptions.includes("efficiency"),
          businessEfficiencyPlatforms: digitalAdoptions.includes("efficiency")
            ? textToList(form.businessEfficiencyPlatforms)
            : [],
          notes: form.notes.trim(),

          evidencePhotoData:
            evidencePhotoData || undefined,
          youthInWorkStatus: "captured",
          gpsCaptureStatus: submittedGps.status,
          gpsLatitude: submittedGps.latitude,
          gpsLongitude: submittedGps.longitude,
          gpsAccuracy: submittedGps.accuracy,
          gpsCapturedAt: submittedGps.capturedAt,
          gpsCaptureError: submittedGps.error,
          status: "submitted",
          registrationSource: newPerson ? "youth_in_work_new" : "outreach_dataset",
        }),
      });

      const data = await response.json();

      if (
        response.status === 409 &&
        data.code === "PARTICIPANT_ALREADY_EXISTS" &&
        data.participant
      ) {
        setDuplicateMatch(data.participant as Participant);
        setDuplicateMatchReason(String(data.matchReason || ""));
        setNewParticipantVerified(false);
        setMessage("An existing participant matches these details. Review the returned participant record.");
        return;
      }

      if (!response.ok) {
        setMessage(data.error || "Could not submit the assessment.");
        return;
      }

      if (currentDraftKey) localStorage.removeItem(currentDraftKey);

      setMessage(`Assessment submitted for ${data.participant?.fullName || form.participantName}.`);
      setSelected(null);
      setNewPerson(false);
      setNewParticipantVerified(false);
      setDuplicateMatch(null);
      setDuplicateMatchReason("");
      setQuery("");
      setParticipants([]);
      setImprovementOutcomes([]);
      setDigitalAdoptions([]);
      setGps(initialGps);
      setForm(initialForm);
      setDraftSavedAt("");
      setEditingEmail(false);
      setEditingPhone(false);
    } catch {
      setMessage("Could not submit the assessment. Save it as a draft and try again.");
    } finally {
      setSaving(false);
    }
  }

  function choiceCard(name: keyof FormState, value: string, label: string) {
    return (
      <label className={`yiw-choice-card ${form[name] === value ? "is-selected" : ""}`}>
        <input
          type="radio"
          name={name}
          checked={form[name] === value}
          onChange={() => updateField(name, value)}
        />
        <span className="yiw-choice-dot" aria-hidden="true" />
        <span>{label}</span>
      </label>
    );
  }

  const displayedParticipants = participants.filter(
    (participant) => normalize(participant.esoName || "") === normalize(selectedEso),
  );

  const messageIsSuccess =
    message.includes("submitted") ||
    message.includes("saved") ||
    message.includes("restored") ||
    message.includes("verified") ||
    message.includes("selected under");

  return (
    <div className="yiw-public">
      <header className="yiw-topbar">
        <div className="yiw-topbar-inner">
          <div className="yiw-topbar-spacer" aria-hidden="true" />
          <div className="yiw-topbar-meta">
            <strong>Assessment Form</strong>
            <span> </span>
          </div>
        </div>
      </header>

      <main className="yiw-wrap yiw-wrap-single">
        <div className="yiw-document">
          <section className="yiw-document-head">
            <div>
              <span className="yiw-document-kicker">YOUTH IN WORK</span>
              <h3>Youth in Work Assessment</h3>
              <p className="yiw-document-subtitle">Capture employment and work outcomes</p>
            </div>

            <div className="yiw-document-meta" aria-label="Form information">
              <div>
                <span> </span>
                <strong> </strong>
              </div>
              <div>
                <span>STATUS</span>
                <strong>{draftStarted ? "In progress" : "Draft"}</strong>
              </div>
            </div>
          </section>

          <div className="yiw-intro-note">
            Welcome to the Youth in Work Assessment Tool. This tool helps us understand young people who have gained new or improved employment opportunities, whether through wage or self-employment. It also captures changes in income, working conditions and digital adoption through the 10X Program.
          </div>

          <form className="yiw-form-card" onSubmit={submit}>
            <section className="yiw-section">
              <div className="yiw-section-head">
                <span className="yiw-section-no">1</span>
                <div>
                  <h2>Entrepreneur Support Organization</h2>
                  <p className="yiw-lead">Select the ESO before searching for a participant.</p>
                </div>
              </div>

              <div className="yiw-field">
                <label className="yiw-field-label" htmlFor="yiw-eso">
                  Entrepreneur Support Organization (ESO)
                  <span className="yiw-required"> *</span>
                </label>
                <select
                  id="yiw-eso"
                  required
                  value={selectedEso}
                  onChange={(event) => handleEsoChange(event.target.value)}
                >
                  <option value="">Select Entrepreneur Support Organization</option>
                  {esoOptions.map((eso) => (
                    <option key={eso} value={eso}>{eso}</option>
                  ))}
                </select>
                <span className="yiw-field-hint">
                  Existing-participant search is restricted to the selected ESO.
                </span>
              </div>
            </section>

            {selectedEso ? (
              <section className="yiw-section">
                <div className="yiw-section-head">
                  <span className="yiw-section-no">2</span>
                  <div>
                    <h2>Find participant</h2>
                    <p className="yiw-lead">
                      Search within {selectedEso} by name, phone, email or participant reference.
                    </p>
                  </div>
                </div>

                {!selected && !newPerson ? (
                  <>
                    <div className="yiw-field">
                      <label className="yiw-field-label" htmlFor="yiw-participant-search">
                        Participant
                      </label>
                      <input
                        id="yiw-participant-search"
                        type="search"
                        autoComplete="off"
                        value={query}
                        placeholder={`Search ${selectedEso} participant`}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setMessage("");
                        }}
                      />
                      {searching ? <span className="yiw-field-hint">Searching participants...</span> : null}
                    </div>

                    <div className="yiw-inline-actions">
                      <button
                        className="yiw-button yiw-secondary"
                        type="button"
                        onClick={startNewParticipant}
                      >
                        Participant not found - register as new
                      </button>
                    </div>

                    {displayedParticipants.length ? (
                      <div
                        className="yiw-results"
                        style={{ maxHeight: 360, overflowY: "auto", overscrollBehavior: "contain" }}
                      >
                        {displayedParticipants.map((participant) => (
                          <button
                            className="yiw-result"
                            type="button"
                            key={participant.id}
                            disabled={participant.hasAssessment}
                            onClick={() => chooseParticipant(participant)}
                          >
                            <strong>{participant.fullName}</strong>
                            <span>
                              {[participant.phone, participant.email, participant.district]
                                .filter(Boolean)
                                .join(" | ")}
                            </span>
                            {participant.hasAssessment ? (
                              <em>Assessment already submitted</em>
                            ) : (
                              <em>Select participant</em>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {selected ? (
                  <div className="yiw-selected">
                    <div>
                      <strong>{selected.fullName}</strong>
                      <span>{selected.esoName} · {selected.district || "No district recorded"}</span>
                    </div>
                    <button
                      type="button"
                      className="yiw-button yiw-secondary yiw-compact-button"
                      onClick={() => resetParticipantSelection(true)}
                    >
                      Change participant
                    </button>
                  </div>
                ) : null}

                {newPerson ? (
                  <div className="yiw-selected">
                    <div>
                      <strong>New participant registration</strong>
                      <span>Registering under {selectedEso}</span>
                    </div>
                    <button
                      type="button"
                      className="yiw-button yiw-secondary yiw-compact-button"
                      onClick={() => resetParticipantSelection(true)}
                    >
                      Back to search
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {newPerson ? (
              <section className="yiw-section">
                <div className="yiw-section-head">
                  <span className="yiw-section-no">3</span>
                  <div>
                    <h2>Register new participant</h2>
                    <p className="yiw-lead">
                      Complete the participant profile, then check for an existing record before continuing.
                    </p>
                  </div>
                </div>

                {newParticipantVerified ? (
                  <div className="yiw-selected">
                    <div>
                      <strong>New participant verified</strong>
                      <span>No matching participant was found. You can continue with the assessment.</span>
                    </div>
                    <button
                      type="button"
                      className="yiw-button yiw-secondary yiw-compact-button"
                      onClick={editNewParticipantDetails}
                    >
                      Edit details
                    </button>
                  </div>
                ) : null}

                <div className="yiw-grid-2">
                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-name">Full name <span className="yiw-required">*</span></label>
                    <input
                      id="yiw-name"
                      autoComplete="name"
                      maxLength={120}
                      placeholder="Enter at least two names"
                      disabled={newParticipantVerified}
                      value={form.participantName}
                      onChange={(event) => updateRegistrationField("participantName", event.target.value)}
                    />
                    <span className="yiw-field-hint">Use the participant's real full name. At least two names are required; numbers and placeholders are rejected.</span>
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-dob">Date of birth <span className="yiw-required">*</span></label>
                    <input
                      id="yiw-dob"
                      type="text"
                      inputMode="numeric"
                      autoComplete="bday"
                      maxLength={10}
                      pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
                      placeholder="DD/MM/YYYY"
                      disabled={newParticipantVerified}
                      value={form.dateOfBirth}
                      onChange={(event) => updateRegistrationField("dateOfBirth", formatDobInput(event.target.value))}
                    />
                    <span className="yiw-field-hint">Use DD/MM/YYYY, for example 25/09/1994.</span>
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label">What is your gender? <span className="yiw-required">*</span></label>
                    <div className="yiw-choice-grid">
                      {(["Male", "Female"] as const).map((gender) => (
                        <label
                          key={gender}
                          className={`yiw-choice-card ${form.gender === gender ? "is-selected" : ""}`}
                        >
                          <input
                            type="radio"
                            name="gender"
                            disabled={newParticipantVerified}
                            checked={form.gender === gender}
                            onChange={() => updateRegistrationField("gender", gender)}
                          />
                          <span className="yiw-choice-dot" aria-hidden="true" />
                          <span>{gender}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-phone-new">Phone number <span className="yiw-required">*</span></label>
                    <input
                      id="yiw-phone-new"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={16}
                      placeholder="e.g. 0772123456 or +256772123456"
                      disabled={newParticipantVerified}
                      value={form.participantPhone}
                      onChange={(event) => updateRegistrationField("participantPhone", sanitizePhoneInput(event.target.value))}
                    />
                    <span className="yiw-field-hint">Digits only; an optional + is allowed at the beginning.</span>
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-email-new">Primary email <span className="yiw-required">*</span></label>
                    <input
                      id="yiw-email-new"
                      type="email"
                      autoComplete="email"
                      disabled={newParticipantVerified}
                      value={form.participantEmail}
                      onChange={(event) => updateRegistrationField("participantEmail", event.target.value)}
                    />
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-district-new">District <span className="yiw-required">*</span></label>
                    <select
                      id="yiw-district-new"
                      disabled={newParticipantVerified}
                      value={form.district}
                      onChange={(event) => updateRegistrationField("district", event.target.value)}
                    >
                      <option value="">Select district</option>
                      {districts.map((district) => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-region-new">Region</label>
                    <input
                      id="yiw-region-new"
                      readOnly
                      tabIndex={-1}
                      value={form.region}
                      placeholder="Assigned automatically from district"
                    />
                    <span className="yiw-field-hint">
                      Region is assigned automatically from the selected district to prevent mismatched geography.
                    </span>
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-subcounty-new">Subcounty / Town Council <span className="yiw-required">*</span></label>
                    <input
                      id="yiw-subcounty-new"
                      disabled={newParticipantVerified}
                      value={form.subcounty}
                      onChange={(event) => updateRegistrationField("subcounty", event.target.value)}
                    />
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-parish-new">Parish / Ward <span className="yiw-required">*</span></label>
                    <input
                      id="yiw-parish-new"
                      disabled={newParticipantVerified}
                      value={form.parish}
                      onChange={(event) => updateRegistrationField("parish", event.target.value)}
                    />
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-village-new">Village / Cell <span className="yiw-required">*</span></label>
                    <input
                      id="yiw-village-new"
                      disabled={newParticipantVerified}
                      value={form.village}
                      onChange={(event) => updateRegistrationField("village", event.target.value)}
                    />
                  </div>

                    <div className="yiw-field">
                      <label className="yiw-field-label" htmlFor="yiw-employer-search-new">
                        Employer / Supported entrepreneur <span className="yiw-required">*</span>
                      </label>

                      {selectedEmployer ? (
                        <div className="yiw-selected">
                          <div>
                            <strong>{selectedEmployer.fullName}</strong>
                            <span>
                              {selectedEmployer.businessName || "Self-employed participant"} · {selectedEmployer.esoName}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="yiw-button yiw-secondary yiw-compact-button"
                            disabled={newParticipantVerified}
                            onClick={clearEmployer}
                          >
                            Change employer
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            id="yiw-employer-search-new"
                            disabled={newParticipantVerified}
                            value={employerQuery}
                            placeholder="Search supported entrepreneur by name, phone or ID"
                            onChange={(event) => {
                              setEmployerQuery(
                                event.target.value,
                              );
                              setEmployerError("");

                              updateRegistrationField(
                                "employerParticipantId",
                                "",
                              );
                            }}
                          />

                          <span className="yiw-field-hint">
                            Select the existing Self-employed entrepreneur under {selectedEso} who created this job.
                          </span>

                          {searchingEmployers ? (
                            <span className="yiw-field-hint">
                              Searching employers...
                            </span>
                          ) : null}

                          {employerResults.length ? (
                            <div
                              style={{
                                display: "grid",
                                gap: "8px",
                                marginTop: "8px",
                              }}
                            >
                              {employerResults.map((employer) => (
                                <button
                                  key={employer.id}
                                  type="button"
                                  className="yiw-button yiw-secondary"
                                  onClick={() =>
                                    chooseEmployer(employer)
                                  }
                                >
                                  {employer.fullName}
                                  {employer.businessName
                                    ? ` — ${employer.businessName}`
                                    : ""}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {employerError ? (
                            <span
                              role="alert"
                              style={{
                                display: "block",
                                marginTop: "5px",
                                color: "#b42318",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                              }}
                            >
                              {employerError}
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-employment-new">
                      Employment type <span className="yiw-required">*</span>
                    </label>

                    <select
                      id="yiw-employment-new"
                      disabled={newParticipantVerified || !selectedEmployer}
                      value={form.employmentType}
                      onChange={(event) => updateRegistrationField("employmentType", event.target.value)}
                    >
                      <option value="">Select job type</option>
                      {employmentTypes.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>




                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-education-new">
                      What is your highest level of education? <span className="yiw-required">*</span>
                    </label>
                    <select
                      id="yiw-education-new"
                      disabled={newParticipantVerified}
                      value={form.educationLevel}
                      onChange={(event) => updateRegistrationField("educationLevel", event.target.value)}
                    >
                      <option value="">Select education level</option>
                      {educationLevels.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="yiw-field yiw-field-spaced">
                  <label className="yiw-field-label">Disability status <span className="yiw-required">*</span></label>
                  <div className="yiw-choice-grid">
                    {(["yes", "no"] as const).map((value) => (
                      <label
                        key={value}
                        className={`yiw-choice-card ${form.disabilityStatus === value ? "is-selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="disabilityStatus"
                          disabled={newParticipantVerified}
                          checked={form.disabilityStatus === value}
                          onChange={() => {
                            updateRegistrationField("disabilityStatus", value);
                            if (value === "no") updateField("disabilityType", "");
                          }}
                        />
                        <span className="yiw-choice-dot" aria-hidden="true" />
                        <span>{value === "yes" ? "Yes" : "No"}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {form.disabilityStatus === "yes" ? (
                  <div className="yiw-conditional">
                    <div className="yiw-field">
                      <label className="yiw-field-label" htmlFor="yiw-disability-type">Type of disability <span className="yiw-required">*</span></label>
                      <select
                        id="yiw-disability-type"
                        disabled={newParticipantVerified}
                        value={form.disabilityType}
                        onChange={(event) => updateRegistrationField("disabilityType", event.target.value)}
                      >
                        <option value="">Select disability type</option>
                        {disabilityTypes.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                <div className="yiw-field yiw-field-spaced">
                  <label className="yiw-field-label">Refugee status <span className="yiw-required">*</span></label>
                  <div className="yiw-choice-grid">
                    {(["yes", "no"] as const).map((value) => (
                      <label
                        key={value}
                        className={`yiw-choice-card ${form.refugeeStatus === value ? "is-selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="refugeeStatus"
                          disabled={newParticipantVerified}
                          checked={form.refugeeStatus === value}
                          onChange={() => {
                            updateRegistrationField("refugeeStatus", value);
                            if (value === "no") updateField("countryOfOrigin", "");
                          }}
                        />
                        <span className="yiw-choice-dot" aria-hidden="true" />
                        <span>{value === "yes" ? "Yes" : "No"}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {form.refugeeStatus === "yes" ? (
                  <div className="yiw-conditional">
                    <div className="yiw-field">
                      <label className="yiw-field-label" htmlFor="yiw-country-origin">Country of origin <span className="yiw-required">*</span></label>
                      <select
                        id="yiw-country-origin"
                        disabled={newParticipantVerified}
                        value={form.countryOfOrigin}
                        onChange={(event) => updateRegistrationField("countryOfOrigin", event.target.value)}
                      >
                        <option value="">Select country of origin</option>
                        {form.countryOfOrigin && !countryOptions.includes(form.countryOfOrigin) ? (
                          <option value={form.countryOfOrigin}>{form.countryOfOrigin}</option>
                        ) : null}
                        {countryOptions.map((country) => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                {duplicateMatch ? (
                  <div className="yiw-conditional">
                    <div className="yiw-selected">
                      <div>
                        <strong>Existing participant found</strong>
                        <span>
                          {duplicateMatch.fullName} · {duplicateMatch.esoName} · {duplicateMatch.district || "District not recorded"}
                        </span>
                        <span>{[duplicateMatch.phone, duplicateMatch.email].filter(Boolean).join(" | ")}</span>
                        {duplicateMatchReason ? (
                          <span>Match: {duplicateMatchReason.replace(/_/g, " ")}</span>
                        ) : null}
                        {duplicateMatch.hasAssessment ? <em>Youth in Work assessment already submitted</em> : null}
                      </div>
                      {!duplicateMatch.hasAssessment ? (
                        <button
                          type="button"
                          className="yiw-button yiw-primary yiw-compact-button"
                          onClick={useDuplicateParticipant}
                        >
                          Use existing participant
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {!newParticipantVerified ? (
                  <div className="yiw-actions">
                    <button
                      type="button"
                      className="yiw-button yiw-primary"
                      disabled={checkingDuplicate}
                      onClick={checkNewParticipant}
                    >
                      {checkingDuplicate ? "Checking..." : "Check participant & continue"}
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {selected ? (
              <section className="yiw-section">
                <div className="yiw-section-head">
                  <span className="yiw-section-no">3</span>
                  <div>
                    <h2>Participant details</h2>
                    <p className="yiw-lead">
                      These details come from the master participant record. They do not need to be re-entered for this assessment.
                    </p>
                  </div>
                </div>

                <div className="yiw-grid-2">
                  <div className="yiw-field">
                    <label className="yiw-field-label">Full name</label>
                    <input value={form.participantName || "Not recorded"} readOnly />
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label">District</label>
                    <input value={form.district || "Not recorded"} readOnly />
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-region-existing">Region</label>
                    <input
                      id="yiw-region-existing"
                      value={
                        regionForDistrict(form.district) ||
                        form.region ||
                        "Not recorded"
                      }
                      readOnly
                    />
                    {form.district && regionForDistrict(form.district) ? (
                      <span className="yiw-field-hint">
                        Region is derived automatically from the participant's district.
                      </span>
                    ) : null}
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label">Participant reference</label>
                    <input value={form.participantExternalId || "Not recorded"} readOnly />
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-email-existing">Primary email</label>
                    <div className="yiw-edit-row">
                      <input
                        id="yiw-email-existing"
                        type="email"
                        autoComplete="email"
                        value={form.participantEmail}
                        readOnly={!editingEmail}
                        placeholder="Not recorded"
                        onChange={(event) => updateField("participantEmail", event.target.value)}
                      />
                      <button
                        type="button"
                        className="yiw-button yiw-secondary yiw-compact-button"
                        onClick={() => setEditingEmail((current) => !current)}
                      >
                        {editingEmail ? "Done" : "Update"}
                      </button>
                    </div>
                    <span className="yiw-field-hint">
                      Optional: update only if the stored contact is missing or incorrect.
                    </span>
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-phone-existing">Phone number</label>
                    <div className="yiw-edit-row">
                      <input
                        id="yiw-phone-existing"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={16}
                        value={form.participantPhone}
                        readOnly={!editingPhone}
                        placeholder="Not recorded"
                        onChange={(event) => updateField("participantPhone", sanitizePhoneInput(event.target.value))}
                      />
                      <button
                        type="button"
                        className="yiw-button yiw-secondary yiw-compact-button"
                        onClick={() => setEditingPhone((current) => !current)}
                      >
                        {editingPhone ? "Done" : "Update"}
                      </button>
                    </div>
                    <span className="yiw-field-hint">
                      Optional: update only if the stored contact is missing or incorrect.
                    </span>
                  </div>
                </div>
              </section>
            ) : null}

            {assessmentStarted ? (
              <>
                <section className="yiw-section">
                  <div className="yiw-section-head">
                    <span className="yiw-section-no">4</span>
                    <div>
                      <h2>Business and 10X Foundation Course</h2>
                      <p className="yiw-lead">Enterprise sector, business profile, course completion and learning.</p>
                    </div>
                  </div>

                  {newPerson ? (
                    <div className="yiw-field">
                      <label
                        className="yiw-field-label"
                        htmlFor="yiw-sector"
                      >
                        Supported entrepreneur's business sector
                      </label>

                      <input
                        id="yiw-sector"
                        value={
                          form.businessSector ||
                          "Not recorded on entrepreneur profile"
                        }
                        readOnly
                        disabled
                      />

                      <span className="yiw-field-hint">
                        Inherited from{" "}
                        {selectedEmployer?.fullName ||
                          "the selected supported entrepreneur"}.
                      </span>

                      {selectedEmployer?.businessName ? (
                        <span className="yiw-field-hint">
                          Business:{" "}
                          {selectedEmployer.businessName}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="yiw-field">
                      <label
                        className="yiw-field-label"
                        htmlFor="yiw-sector"
                      >
                        What sector is your Enterprise?{" "}
                        <span className="yiw-required">*</span>
                      </label>

                      <select
                        id="yiw-sector"
                        required
                        value={form.businessSector}
                        onChange={(event) =>
                          updateField(
                            "businessSector",
                            event.target.value,
                          )
                        }
                      >
                        <option value="">
                          Select sector
                        </option>

                        {sectors.map((sector) => (
                          <option
                            key={sector}
                            value={sector}
                          >
                            {sector}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="yiw-field yiw-field-spaced">
                    <label className="yiw-field-label">
                      Have you completed the 10X Business Foundation Course? <span className="yiw-required">*</span>
                    </label>
                    <div className="yiw-choice-grid">
                      {choiceCard("foundationCourseStatus", "yes", "Yes")}
                      {choiceCard("foundationCourseStatus", "no", "No")}
                      {choiceCard("foundationCourseStatus", "currently_enrolled", "Currently enrolled")}
                      {choiceCard("foundationCourseStatus", "started_but_not_completed", "Started but not completed")}
                    </div>
                  </div>

                  {foundationYes ? (
                    <div className="yiw-conditional">
                      <div className="yiw-field">
                        <label className="yiw-field-label" htmlFor="yiw-learning">
                          What did you learn from the 10X Program Foundation Course that you have implemented? <span className="yiw-required">*</span>
                        </label>
                        <textarea
                          id="yiw-learning"
                          required
                          rows={4}
                          value={form.foundationLearning}
                          placeholder="What did you learn and implement?"
                          onChange={(event) => updateField("foundationLearning", event.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}

                  {foundationInProgress ? (
                    <div className="yiw-conditional">
                      <div className="yiw-field">
                        <label className="yiw-field-label" htmlFor="yiw-learning-progress">
                          What have you so far learned from the 10X Program Foundation Course? <span className="yiw-required">*</span>
                        </label>
                        <textarea
                          id="yiw-learning-progress"
                          required
                          rows={4}
                          value={form.foundationLearning}
                          onChange={(event) => updateField("foundationLearning", event.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}
                </section>

                <section className="yiw-section">
                  <div className="yiw-section-head">
                    <span className="yiw-section-no">5</span>
                    <div>
                      <h2>Youth in Work outcomes</h2>
                      <p className="yiw-lead">Income and working-condition outcomes.</p>
                    </div>
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label">
                      Have you earned income / money as a result of the 10X Program? <span className="yiw-required">*</span>
                    </label>
                    <div className="yiw-choice-grid">
                      {choiceCard("incomeFromProgram", "yes", "Yes")}
                      {choiceCard("incomeFromProgram", "no", "No")}
                    </div>
                  </div>

                  {incomeYes ? (
                    <div className="yiw-conditional">
                      <div className="yiw-field">
                        <label className="yiw-field-label" htmlFor="yiw-income">
                          If yes, how much have you earned? (UGX) <span className="yiw-required">*</span>
                        </label>
                        <input
                          id="yiw-income"
                          required
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="e.g. 250000"
                          value={form.incomeAmount}
                          onChange={(event) => updateField("incomeAmount", event.target.value.replace(/\D/g, ""))}
                        />
                        <span className="yiw-field-hint">
                          Enter numbers only. Do not enter UGX, USh, Shs, commas or other text.
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="yiw-field yiw-field-spaced">
                    <label className="yiw-field-label">
                      Have your working conditions improved since joining the 10X Program? <span className="yiw-required">*</span>
                    </label>
                    <div className="yiw-choice-grid">
                      {choiceCard("workImproved", "yes", "Yes")}
                      {choiceCard("workImproved", "no", "No")}
                    </div>
                  </div>

                  {improvedYes ? (
                    <div className="yiw-conditional yiw-inner-conditional">
                      <div className="yiw-field">
                        <label className="yiw-field-label" htmlFor="yiw-improvement">
                          If yes, how did your work improve? <span className="yiw-required">*</span>
                        </label>
                        <textarea
                          id="yiw-improvement"
                          required
                          rows={4}
                          value={form.workImprovementDescription}
                          placeholder="Describe how your work improved."
                          onChange={(event) => updateField("workImprovementDescription", event.target.value)}
                        />
                      </div>

                      <div className="yiw-field">
                        <label className="yiw-field-label">
                          As a result, which of the following has the improvement led to? <span className="yiw-required">*</span>
                        </label>
                        <span className="yiw-field-hint">Choose all that apply.</span>
                        <div className="yiw-choice-grid">
                          {improvementOptions.map((option) => (
                            <label
                              className={`yiw-check-card ${improvementOutcomes.includes(option) ? "is-selected" : ""}`}
                              key={option}
                            >
                              <input
                                type="checkbox"
                                checked={improvementOutcomes.includes(option)}
                                onChange={() => toggleOutcome(option)}
                              />
                              <span className="yiw-check-box" aria-hidden="true" />
                              <span>{option}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>

                <section className="yiw-section">
                  <div className="yiw-section-head">
                    <span className="yiw-section-no">6</span>
                    <div>
                      <h2>Digital adoption</h2>
                      <p className="yiw-lead">Digital channels, providers and tools adopted through the 10X Program.</p>
                    </div>
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label">
                      Which of the following digital adoption have you experienced?
                    </label>
                    <span className="yiw-field-hint">Choose all that apply.</span>
                    <div className="yiw-choice-grid">
                      {[
                        ["markets", "Access to digital markets"],
                        ["finance", "Access to digital finance"],
                        ["efficiency", "Business efficiency"],
                      ].map(([value, label]) => (
                        <label
                          key={value}
                          className={`yiw-check-card ${digitalAdoptions.includes(value) ? "is-selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={digitalAdoptions.includes(value)}
                            onChange={() => toggleDigitalAdoption(value)}
                          />
                          <span className="yiw-check-box" aria-hidden="true" />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {digitalAdoptions.includes("markets") ? (
                    <div className="yiw-conditional">
                      <div className="yiw-field">
                        <label className="yiw-field-label" htmlFor="yiw-digital-markets">
                          Which digital market platform(s) are you using? <span className="yiw-required">*</span>
                        </label>
                        <textarea
                          id="yiw-digital-markets"
                          rows={3}
                          value={form.digitalMarketPlatforms}
                          placeholder="Enter platform(s). Separate multiple entries with commas."
                          onChange={(event) => updateField("digitalMarketPlatforms", event.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}

                  {digitalAdoptions.includes("finance") ? (
                    <div className="yiw-conditional">
                      <div className="yiw-field">
                        <label className="yiw-field-label" htmlFor="yiw-digital-finance">
                          Which digital finance provider(s) are you using? <span className="yiw-required">*</span>
                        </label>
                        <textarea
                          id="yiw-digital-finance"
                          rows={3}
                          value={form.digitalFinanceProviders}
                          placeholder="Enter provider(s). Separate multiple entries with commas."
                          onChange={(event) => updateField("digitalFinanceProviders", event.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}

                  {digitalAdoptions.includes("efficiency") ? (
                    <div className="yiw-conditional">
                      <div className="yiw-field">
                        <label className="yiw-field-label" htmlFor="yiw-business-efficiency">
                          Which digital platform or tool is improving your business efficiency? <span className="yiw-required">*</span>
                        </label>
                        <textarea
                          id="yiw-business-efficiency"
                          rows={3}
                          value={form.businessEfficiencyPlatforms}
                          placeholder="Enter platform/tool(s). Separate multiple entries with commas."
                          onChange={(event) => updateField("businessEfficiencyPlatforms", event.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}
                </section>

                                <section className="yiw-section">
                  <div className="yiw-section-head">
                    <span className="yiw-section-no">7</span>
                    <div>
                      <h2>Supporting evidence</h2>
                      <p className="yiw-lead">
                        Optional photo supporting this participant assessment.
                      </p>
                    </div>
                  </div>


                  <div className="yiw-field">
                    <label
                      className="yiw-field-label"
                      htmlFor="yiw-evidence-photo"
                    >
                      Evidence photo
                    </label>

                    <p className="yiw-field-hint">
                      Optional. Take a photo or upload a JPEG/PNG image as supporting evidence.
                    </p>

                    <input
                      id="yiw-evidence-photo"
                      type="file"
                      accept="image/jpeg,image/png"
                      capture="environment"
                      onChange={(event) => {
                        const file =
                          event.target.files?.[0];

                        setEvidencePhotoError("");

                        if (!file) {
                          setEvidencePhotoData("");
                          setEvidencePhotoName("");
                          return;
                        }

                        if (
                          ![
                            "image/jpeg",
                            "image/png",
                          ].includes(file.type)
                        ) {
                          setEvidencePhotoData("");
                          setEvidencePhotoName("");

                          setEvidencePhotoError(
                            "Select a JPEG or PNG image.",
                          );

                          event.currentTarget.value = "";
                          return;
                        }

                        if (
                          file.size >
                          5 * 1024 * 1024
                        ) {
                          setEvidencePhotoData("");
                          setEvidencePhotoName("");

                          setEvidencePhotoError(
                            "Evidence photo must be smaller than 5 MB.",
                          );

                          event.currentTarget.value = "";
                          return;
                        }

                        const reader =
                          new FileReader();

                        reader.onload = () => {
                          const result =
                            typeof reader.result ===
                            "string"
                              ? reader.result
                              : "";

                          if (!result) {
                            setEvidencePhotoError(
                              "The selected image could not be read.",
                            );

                            return;
                          }

                          setEvidencePhotoData(
                            result,
                          );

                          setEvidencePhotoName(
                            file.name,
                          );
                        };

                        reader.onerror = () => {
                          setEvidencePhotoData("");
                          setEvidencePhotoName("");

                          setEvidencePhotoError(
                            "The selected image could not be read.",
                          );
                        };

                        reader.readAsDataURL(
                          file,
                        );
                      }}
                    />

                    {evidencePhotoData ? (
                      <div
                        style={{
                          marginTop: "12px",
                          display: "grid",
                          gap: "10px",
                          maxWidth: "320px",
                        }}
                      >
                        <img
                          src={evidencePhotoData}
                          alt="Evidence preview"
                          style={{
                            width: "100%",
                            maxHeight: "220px",
                            objectFit: "cover",
                            borderRadius: "10px",
                          }}
                        />

                        <small>
                          {evidencePhotoName}
                        </small>

                        <button
                          type="button"
                          className="yiw-button yiw-secondary yiw-compact-button"
                          onClick={() => {
                            setEvidencePhotoData("");
                            setEvidencePhotoName("");
                            setEvidencePhotoError("");

                            const input =
                              document.getElementById(
                                "yiw-evidence-photo",
                              ) as HTMLInputElement | null;

                            if (input) {
                              input.value = "";
                            }
                          }}
                        >
                          Remove photo
                        </button>
                      </div>
                    ) : null}

                    {evidencePhotoError ? (
                      <span
                        role="alert"
                        style={{
                          display: "block",
                          marginTop: "8px",
                          color: "#b42318",
                        }}
                      >
                        {evidencePhotoError}
                      </span>
                    ) : null}
                  </div>
                </section>
<section className="yiw-section">
                  <div className="yiw-section-head">
                    <span className="yiw-section-no">8</span>
                    <div>
                      <h2>Additional comments</h2>
                      <p className="yiw-lead">Optional closing comments from the participant.</p>
                    </div>
                  </div>

                  <div className="yiw-field">
                    <label className="yiw-field-label" htmlFor="yiw-notes">Any other comments</label>
                    <textarea
                      id="yiw-notes"
                      rows={4}
                      value={form.notes}
                      onChange={(event) => updateField("notes", event.target.value)}
                    />
                  </div>
                  <div className="yiw-notice">Thank you for your participation.</div>
                </section>

                {message ? (
                  <p className={`yiw-message ${messageIsSuccess ? "success" : "error"}`}>{message}</p>
                ) : null}

                {draftSavedAt ? (
                  <div className="yiw-draft-status">
                    Draft available on this device · Last saved {new Date(draftSavedAt).toLocaleString()}
                  </div>
                ) : null}

                <div className="yiw-actions">
                  <button
                    className="yiw-button yiw-secondary"
                    type="button"
                    onClick={() => saveDraft(true)}
                    disabled={saving}
                  >
                    Save as draft
                  </button>

                  <button
                    className="yiw-button yiw-secondary"
                    type="button"
                    onClick={() => resetParticipantSelection(true)}
                    disabled={saving}
                  >
                    Clear / change participant
                  </button>

                  <button className="yiw-button yiw-primary" type="submit" disabled={saving}>
                    {saving ? "Submitting..." : "Submit completed assessment"}
                  </button>
                </div>
              </>
            ) : null}

            {message && !assessmentStarted ? (
              <p className={`yiw-message ${messageIsSuccess ? "success" : "error"}`}>{message}</p>
            ) : null}
          </form>
        </div>
      </main>

        <style>{`
          .yiw-public {
            --yiw-ink: #0f2747;
            --yiw-ink-soft: #526784;
            --yiw-blue: #0b4a8b;
            --yiw-blue-dark: #082f5f;
            --yiw-line: #d8e0ea;
            --yiw-line-strong: #becbdd;
            --yiw-page: #eef3f8;
            --yiw-paper: #ffffff;
            --yiw-soft: #f6f8fb;
            --yiw-success: #eaf7ef;
            --yiw-success-ink: #17663b;
            --yiw-error: #fff2f0;
            --yiw-error-ink: #9b2c2c;
            min-height: 100vh;
            background: var(--yiw-page);
            color: var(--yiw-ink);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            line-height: 1.45;
          }

          .yiw-public * {
            box-sizing: border-box;
          }

          .yiw-public .yiw-topbar {
            background: #ffffff !important;
            border-bottom: 1px solid var(--yiw-line) !important;
            box-shadow: none !important;
          }

          .yiw-public .yiw-topbar-inner {
            width: min(100%, 980px);
            min-height: 70px;
            margin: 0 auto;
            padding: 12px 28px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .yiw-public .yiw-topbar-spacer {
            min-width: 1px;
          }

          .yiw-public .yiw-topbar-meta {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
          }

          .yiw-public .yiw-topbar-meta strong {
            font-size: 12px;
            color: #111827;
            font-weight: 700;
          }

          .yiw-public .yiw-topbar-meta span {
            font-size: 11px;
            color: #5e7391;
            letter-spacing: .04em;
          }

          .yiw-public .yiw-wrap {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 34px 20px 72px !important;
          }

          .yiw-public .yiw-wrap-single > div,
          .yiw-public .yiw-document {
            width: min(940px, 100%);
            margin: 0 auto;
            background: var(--yiw-paper);
            border: 1px solid var(--yiw-line);
            border-radius: 0 !important;
            box-shadow: 0 12px 30px rgba(30, 52, 78, .07) !important;
            overflow: hidden;
          }

          .yiw-public .yiw-document-head {
            padding: 34px 32px 26px;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 28px;
            border-bottom: 1px solid var(--yiw-line);
            background: #fff;
          }

          .yiw-public .yiw-document-kicker {
            display: inline-block;
            margin-bottom: 8px;
            color: var(--yiw-blue);
            font-size: 11px;
            line-height: 1;
            font-weight: 800;
            letter-spacing: .16em;
          }

          .yiw-public .yiw-document-head h1 {
            margin: 0;
            color: #0d294d;
            font-size: clamp(27px, 3.2vw, 36px);
            line-height: 1.08;
            letter-spacing: -.035em;
            font-weight: 800;
          }

          .yiw-public .yiw-document-subtitle {
            margin: 8px 0 0;
            color: var(--yiw-ink-soft);
            font-size: 15px;
          }

          .yiw-public .yiw-document-meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(72px, auto));
            gap: 8px;
            flex-shrink: 0;
          }

          .yiw-public .yiw-document-meta > div {
            min-width: 72px;
            padding: 10px 11px;
            border: 1px solid var(--yiw-line-strong);
            background: #fbfcfe;
          }

          .yiw-public .yiw-document-meta span {
            display: block;
            margin-bottom: 4px;
            color: #6a7d97;
            font-size: 9px;
            letter-spacing: .12em;
          }

          .yiw-public .yiw-document-meta strong {
            display: block;
            color: var(--yiw-ink);
            font-size: 12px;
            font-weight: 800;
          }

          .yiw-public .yiw-intro-note {
            margin: 22px 32px 0;
            padding: 14px 16px;
            border-left: 3px solid var(--yiw-blue);
            background: var(--yiw-soft);
            color: #1e3656;
            font-size: 12.5px;
            line-height: 1.55;
          }

          .yiw-public .yiw-form-card {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .yiw-public .yiw-section {
            margin: 0 !important;
            padding: 30px 32px 32px !important;
            background: #fff !important;
            border: 0 !important;
            border-bottom: 1px solid var(--yiw-line) !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .yiw-public .yiw-section:first-of-type {
            padding-top: 30px !important;
          }

          .yiw-public .yiw-section-head {
            display: grid !important;
            grid-template-columns: 42px minmax(0, 1fr);
            align-items: start !important;
            gap: 14px !important;
            margin: 0 0 22px !important;
          }

          .yiw-public .yiw-section-no {
            width: 38px !important;
            height: 32px !important;
            min-width: 38px !important;
            display: grid !important;
            place-items: center !important;
            border: 1px solid #b6c5d8 !important;
            border-radius: 4px !important;
            background: #f7f9fc !important;
            color: var(--yiw-blue-dark) !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            box-shadow: none !important;
          }

          .yiw-public .yiw-section-head h2 {
            margin: 0 !important;
            color: #102a4a !important;
            font-size: 18px !important;
            line-height: 1.25 !important;
            font-weight: 800 !important;
            letter-spacing: -.015em;
          }

          .yiw-public .yiw-lead {
            margin: 4px 0 0 !important;
            color: #5e7391 !important;
            font-size: 12px !important;
            line-height: 1.45 !important;
          }

          .yiw-public .yiw-grid-2 {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px 20px !important;
          }

          .yiw-public .yiw-field {
            gap: 7px !important;
          }

          .yiw-public .yiw-field-spaced {
            margin-top: 20px !important;
          }

          .yiw-public .yiw-field-label {
            color: #102947 !important;
            font-size: 12.5px !important;
            line-height: 1.35 !important;
            font-weight: 750 !important;
          }

          .yiw-public .yiw-required {
            color: #b42318 !important;
          }

          .yiw-public input,
          .yiw-public select,
          .yiw-public textarea {
            width: 100%;
            border: 1px solid #c4d0df !important;
            border-radius: 6px !important;
            background: #fff !important;
            color: #122c4c !important;
            box-shadow: none !important;
            font: inherit;
            font-size: 13px !important;
            outline: none;
            transition: border-color .15s ease, box-shadow .15s ease;
          }

          .yiw-public input,
          .yiw-public select {
            min-height: 44px !important;
            padding: 10px 12px !important;
          }

          .yiw-public textarea {
            padding: 11px 12px !important;
            resize: vertical;
          }

          .yiw-public input:focus,
          .yiw-public select:focus,
          .yiw-public textarea:focus {
            border-color: var(--yiw-blue) !important;
            box-shadow: 0 0 0 3px rgba(11, 74, 139, .09) !important;
          }

          .yiw-public input[readonly] {
            background: #f7f9fc !important;
            color: #526784 !important;
          }

          .yiw-public input:disabled,
          .yiw-public select:disabled,
          .yiw-public textarea:disabled {
            background: #f4f6f9 !important;
            color: #7b8ca4 !important;
            opacity: 1 !important;
          }

          .yiw-public .yiw-field-hint {
            margin-top: 0 !important;
            color: #6b7f99 !important;
            font-size: 10.5px !important;
            line-height: 1.4 !important;
          }

          .yiw-public .yiw-inline-actions {
            display: flex;
            justify-content: flex-start;
            margin-top: 16px !important;
          }

          .yiw-public .yiw-button {
            min-height: 40px !important;
            padding: 9px 14px !important;
            border-radius: 5px !important;
            font-size: 12px !important;
            line-height: 1.2 !important;
            font-weight: 750 !important;
            box-shadow: none !important;
            cursor: pointer;
          }

          .yiw-public .yiw-button.yiw-primary {
            border: 1px solid var(--yiw-blue-dark) !important;
            background: var(--yiw-blue-dark) !important;
            color: #fff !important;
          }

          .yiw-public .yiw-button.yiw-primary:hover:not(:disabled) {
            background: #06264d !important;
          }

          .yiw-public .yiw-button.yiw-secondary {
            border: 1px solid #aebed2 !important;
            background: #fff !important;
            color: var(--yiw-blue-dark) !important;
          }

          .yiw-public .yiw-button.yiw-secondary:hover:not(:disabled) {
            background: #f5f8fc !important;
          }

          .yiw-public .yiw-button:disabled {
            opacity: .5 !important;
            cursor: not-allowed !important;
          }

          .yiw-public .yiw-compact-button {
            min-height: 34px !important;
            padding: 7px 10px !important;
            font-size: 11px !important;
          }

          .yiw-public .yiw-results {
            margin-top: 16px !important;
            padding: 0 !important;
            border: 1px solid var(--yiw-line) !important;
            border-radius: 6px !important;
            background: #fff !important;
            overflow: auto;
          }

          .yiw-public .yiw-result {
            width: 100%;
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 3px 16px !important;
            padding: 12px 14px !important;
            border: 0 !important;
            border-bottom: 1px solid #e8edf3 !important;
            border-radius: 0 !important;
            background: #fff !important;
            text-align: left;
          }

          .yiw-public .yiw-result:last-child {
            border-bottom: 0 !important;
          }

          .yiw-public .yiw-result:hover:not(:disabled) {
            background: #f7f9fc !important;
          }

          .yiw-public .yiw-result strong {
            color: #132e4e !important;
            font-size: 12.5px !important;
          }

          .yiw-public .yiw-result span {
            grid-column: 1;
            color: #667a94 !important;
            font-size: 10.5px !important;
          }

          .yiw-public .yiw-result em {
            grid-column: 2;
            grid-row: 1 / span 2;
            align-self: center;
            color: #5e7391 !important;
            font-size: 10.5px !important;
            font-style: normal !important;
          }

          .yiw-public .yiw-selected {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 18px !important;
            margin: 18px 0 0 !important;
            padding: 13px 14px !important;
            border: 1px solid #cfd9e6 !important;
            border-radius: 5px !important;
            background: #f7f9fc !important;
            box-shadow: none !important;
          }

          .yiw-public .yiw-selected strong {
            display: block;
            color: #12304f !important;
            font-size: 12.5px !important;
          }

          .yiw-public .yiw-selected span,
          .yiw-public .yiw-selected em {
            display: block;
            margin-top: 3px;
            color: #667a94 !important;
            font-size: 10.5px !important;
            font-style: normal !important;
          }

          .yiw-public .yiw-choice-grid {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 8px !important;
            margin-top: 7px !important;
          }

          .yiw-public .yiw-choice-card,
          .yiw-public .yiw-check-card {
            min-height: 42px !important;
            display: flex !important;
            align-items: center !important;
            gap: 9px !important;
            padding: 9px 11px !important;
            border: 1px solid #c9d4e2 !important;
            border-radius: 5px !important;
            background: #fff !important;
            color: #233d5d !important;
            box-shadow: none !important;
            font-size: 12px !important;
            cursor: pointer;
          }

          .yiw-public .yiw-choice-card.is-selected,
          .yiw-public .yiw-check-card.is-selected {
            border-color: #7ea2cc !important;
            background: #f0f6fc !important;
          }

          .yiw-public .yiw-choice-card input,
          .yiw-public .yiw-check-card input {
            position: absolute !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }

          .yiw-public .yiw-choice-dot,
          .yiw-public .yiw-check-box {
            width: 15px !important;
            height: 15px !important;
            min-width: 15px !important;
            border: 1px solid #9fb0c5 !important;
            background: #fff !important;
            box-shadow: none !important;
          }

          .yiw-public .yiw-choice-dot {
            border-radius: 50% !important;
          }

          .yiw-public .yiw-check-box {
            border-radius: 3px !important;
          }

          .yiw-public .yiw-choice-card.is-selected .yiw-choice-dot {
            border: 4px solid var(--yiw-blue) !important;
          }

          .yiw-public .yiw-check-card.is-selected .yiw-check-box {
            border-color: var(--yiw-blue) !important;
            background: var(--yiw-blue) !important;
          }

          .yiw-public .yiw-conditional {
            margin-top: 18px !important;
            padding: 16px !important;
            border: 1px solid #d9e2ec !important;
            border-left: 3px solid #8faecc !important;
            border-radius: 0 5px 5px 0 !important;
            background: #fafbfd !important;
            box-shadow: none !important;
          }

          .yiw-public .yiw-inner-conditional {
            display: grid;
            gap: 18px;
          }

          .yiw-public .yiw-edit-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px !important;
            align-items: stretch !important;
          }

          .yiw-public .yiw-actions {
            display: flex !important;
            flex-wrap: wrap;
            justify-content: flex-end !important;
            gap: 8px !important;
            margin: 22px 0 0 !important;
          }

          .yiw-public .yiw-notice {
            margin-top: 20px !important;
            padding: 12px 14px !important;
            border: 1px solid #d3dce8 !important;
            border-radius: 4px !important;
            background: #f8fafc !important;
            color: #506682 !important;
            font-size: 11px !important;
          }

          .yiw-public .yiw-message {
            margin: 18px 32px 0 !important;
            padding: 12px 14px !important;
            border-radius: 4px !important;
            font-size: 11.5px !important;
            font-weight: 650 !important;
          }

          .yiw-public .yiw-message.success {
            border: 1px solid #b9dec7 !important;
            background: var(--yiw-success) !important;
            color: var(--yiw-success-ink) !important;
          }

          .yiw-public .yiw-message.error {
            border: 1px solid #efc7c2 !important;
            background: var(--yiw-error) !important;
            color: var(--yiw-error-ink) !important;
          }

          .yiw-public .yiw-draft-status {
            margin: 12px 32px 0 !important;
            padding: 9px 12px !important;
            border: 1px dashed #c2cfde !important;
            border-radius: 4px !important;
            background: #fbfcfe !important;
            color: #6b7f99 !important;
            font-size: 10.5px !important;
          }

          .yiw-public .yiw-form-card > .yiw-actions {
            padding: 0 32px 28px;
          }

          @media (max-width: 720px) {
            .yiw-public .yiw-wrap {
              padding: 0 0 40px !important;
            }

            .yiw-public .yiw-wrap-single > div,
            .yiw-public .yiw-document {
              width: 100%;
              border-left: 0 !important;
              border-right: 0 !important;
              box-shadow: none !important;
            }

            .yiw-public .yiw-document-head {
              padding: 26px 20px 22px;
              flex-direction: column;
            }

            .yiw-public .yiw-document-meta {
              align-self: stretch;
            }

            .yiw-public .yiw-document-meta > div {
              flex: 1;
            }

            .yiw-public .yiw-intro-note {
              margin: 18px 20px 0;
            }

            .yiw-public .yiw-section {
              padding: 26px 20px 28px !important;
            }

            .yiw-public .yiw-grid-2 {
              grid-template-columns: 1fr !important;
            }

            .yiw-public .yiw-message,
            .yiw-public .yiw-draft-status {
              margin-left: 20px !important;
              margin-right: 20px !important;
            }

            .yiw-public .yiw-form-card > .yiw-actions {
              padding-left: 20px;
              padding-right: 20px;
            }

            .yiw-public .yiw-topbar-inner {
              padding-left: 18px;
              padding-right: 18px;
            }

            .yiw-public .yiw-choice-grid {
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 480px) {
            .yiw-public .yiw-choice-grid {
              grid-template-columns: 1fr;
            }

            .yiw-public .yiw-section-head {
              grid-template-columns: 36px minmax(0, 1fr);
              gap: 10px !important;
            }

            .yiw-public .yiw-section-no {
              width: 32px !important;
              min-width: 32px !important;
            }

            .yiw-public .yiw-actions {
              justify-content: stretch !important;
            }

            .yiw-public .yiw-actions .yiw-button {
              width: 100%;
            }
          }

          @media print {
            .yiw-public {
              background: #fff !important;
            }

            .yiw-public .yiw-topbar {
              display: none !important;
            }

            .yiw-public .yiw-wrap {
              padding: 0 !important;
            }

            .yiw-public .yiw-wrap-single > div,
            .yiw-public .yiw-document {
              width: 210mm;
              min-height: 297mm;
              border: 0 !important;
              box-shadow: none !important;
            }
          }
        `}</style>
    </div>
  );
}
