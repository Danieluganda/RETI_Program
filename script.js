const form = document.querySelector("#consentForm");
const message = document.querySelector("#formMessage");
const saveDraftButton = document.querySelector("#saveDraftButton");
const printButton = document.querySelector("#printButton");
const draftKey = "programParticipantConsentDraft";
const signaturePads = new Map();

const today = new Date().toISOString().slice(0, 10);
document.querySelector("#participantDate").value = today;
document.querySelector("#interpreterDate").value = today;

function getFormData() {
  const data = {};

  new FormData(form).forEach((value, key) => {
    if (value instanceof File) return;
    data[key] = value;
  });

  data.consentAgreement = document.querySelector("#consentAgreement").checked;
  data.completedAt = new Date().toISOString();
  return data;
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function fillDraft(data) {
  Object.entries(data).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;

    if (field.type === "checkbox") {
      field.checked = Boolean(value);
      return;
    }

    field.value = value;
  });

  updateDynamicOrganization();
  restoreSignaturePreviews(data);
}

function updateDynamicOrganization() {
  const organization = form.elements.implementingOrganization.value.trim();
  document.querySelectorAll("[data-field='implementingOrganization']").forEach((node) => {
    node.textContent = organization || "The implementing organization";
  });
}

function saveDraft() {
  localStorage.setItem(draftKey, JSON.stringify(getFormData()));
  setMessage("Draft saved on this device.");
}

function downloadJson(data) {
  const participantName = data.participantName || "participant";
  const fileSafeName = participantName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = `${fileSafeName || "participant"}-consent-form.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function setupSignaturePad(pad) {
  const name = pad.dataset.signaturePad;
  const canvas = pad.querySelector(".signature-canvas");
  const clearButton = pad.querySelector("[data-clear-signature]");
  const upload = pad.querySelector("[data-upload-signature]");
  const valueField = pad.querySelector("[data-signature-value]");
  const preview = pad.querySelector(".signature-preview");
  const context = canvas.getContext("2d");
  let isDrawing = false;
  let hasDrawn = false;

  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 3;
  context.strokeStyle = "#111827";

  function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function setSignatureValue(dataUrl) {
    valueField.value = dataUrl;
    valueField.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function showPreview(dataUrl) {
    preview.src = dataUrl;
    preview.hidden = true;
  }

  function clearSignature() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
    valueField.value = "";
    upload.value = "";
    preview.removeAttribute("src");
    preview.hidden = true;
  }

  function startDrawing(event) {
    event.preventDefault();
    isDrawing = true;
    hasDrawn = true;
    const point = getPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function draw(event) {
    if (!isDrawing) return;
    event.preventDefault();
    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    if (hasDrawn) {
      setSignatureValue(canvas.toDataURL("image/png"));
    }
  }

  function loadImage(dataUrl) {
    const image = new Image();

    image.addEventListener("load", () => {
      clearSignature();
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const x = (canvas.width - width) / 2;
      const y = (canvas.height - height) / 2;

      context.drawImage(image, x, y, width, height);
      hasDrawn = true;
      setSignatureValue(dataUrl);
      showPreview(dataUrl);
    });

    image.src = dataUrl;
  }

  canvas.addEventListener("pointerdown", startDrawing);
  canvas.addEventListener("pointermove", draw);
  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);
  canvas.addEventListener("pointerleave", stopDrawing);

  clearButton.addEventListener("click", clearSignature);

  upload.addEventListener("change", () => {
    const file = upload.files[0];
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setMessage("Please upload a PNG or JPG image.", true);
      upload.value = "";
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => loadImage(reader.result));
    reader.readAsDataURL(file);
  });

  signaturePads.set(name, { clearSignature, loadImage });
}

function restoreSignaturePreviews(data) {
  signaturePads.forEach((padControls, name) => {
    const dataUrl = data[`${name}Data`];
    if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
      padControls.loadImage(dataUrl);
    }
  });
}

const savedDraft = localStorage.getItem(draftKey);
document.querySelectorAll("[data-signature-pad]").forEach(setupSignaturePad);

if (savedDraft) {
  try {
    fillDraft(JSON.parse(savedDraft));
    setMessage("A saved draft was restored from this device.");
  } catch {
    localStorage.removeItem(draftKey);
  }
}

form.addEventListener("input", updateDynamicOrganization);

saveDraftButton.addEventListener("click", saveDraft);

printButton.addEventListener("click", () => {
  window.print();
});

form.addEventListener("reset", () => {
  localStorage.removeItem(draftKey);
  window.setTimeout(() => {
    document.querySelector("#participantDate").value = today;
    document.querySelector("#interpreterDate").value = today;
    signaturePads.forEach((padControls) => padControls.clearSignature());
    updateDynamicOrganization();
    setMessage("Form cleared.");
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    setMessage("Please complete the required fields before downloading.", true);
    return;
  }

  if (!form.elements.participantSignatureData.value) {
    setMessage("Please draw or upload the participant signature or thumbprint.", true);
    form.elements.participantSignatureData.focus();
    return;
  }

  const data = getFormData();
  downloadJson(data);
  localStorage.removeItem(draftKey);
  setMessage("Completed form downloaded.");
});
