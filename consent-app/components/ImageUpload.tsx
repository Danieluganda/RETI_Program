"use client";

type ImageUploadProps = {
  label: string;
  onImage: (dataUrl: string) => void;
};

export function ImageUpload({ label, onImage }: ImageUploadProps) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      alert("Please upload a PNG or JPG image.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => onImage(String(reader.result)));
    reader.readAsDataURL(file);
  }

  return (
    <label>
      {label}
      <input type="file" accept="image/png,image/jpeg" onChange={handleChange} />
    </label>
  );
}
