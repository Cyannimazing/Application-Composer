import type { Capture, Field } from "./contracts";
export type Platform = "onlinejobs" | "upwork" | "other";
export const platforms: { id: Platform; label: string; title: string; form: string; description: string }[] = [
  { id: "onlinejobs", label: "OnlineJobs.ph", title: "OnlineJobs.ph application", form: "OnlineJobs.ph form", description: "Add the job details. Prepare a relevant subject, message and answers." },
  { id: "upwork", label: "Upwork", title: "Upwork proposal", form: "Upwork proposal form", description: "Address the client’s stack, cover letter and screening questions." },
  { id: "other", label: "Other websites", title: "Website application", form: "Application form", description: "A flexible workspace for other job boards and application pages." },
];
export function detectPlatform(capture: Capture): Platform {
  if (capture.platform) return capture.platform;
  const host = new URL(capture.url).hostname;
  if (host === "upwork.com" || host.endsWith(".upwork.com")) return "upwork";
  if (host === "onlinejobs.ph" || host.endsWith(".onlinejobs.ph")) return "onlinejobs";
  return "other";
}
export function templateCapture(platform: Platform, questions = "", context = "", title = ""): Capture {
  const id = crypto.randomUUID();
  const field = (label: string, type = "textarea", required = true, maxLength = 10000): Field => ({ id: `${id}-f${crypto.randomUUID().slice(0, 8)}`, label, type, required, maxLength, value: "", options: [] });
  const fields = platform === "onlinejobs" ? [field("Application subject", "text", true, 200), field("Application message", "textarea", true, 10000), field("Contact email", "email", false, 250), field("Apply Points", "number", false, 3)] : platform === "upwork" ? [field("Cover letter", "textarea", true, 10000), field("Hourly rate (USD)", "number", false, 20), { ...field("Project duration", "select", false), options: [{ value: "less_than_month", label: "Less than 1 month" }, { value: "one_to_three", label: "1 to 3 months" }, { value: "three_to_six", label: "3 to 6 months" }, { value: "more_than_six", label: "More than 6 months" }] }] : [field("Application subject", "text", false, 200), field("Application message"), field("Portfolio URL", "url", false, 2000)];
  const extra = questions.split("\n").map(q => q.trim()).filter(Boolean).slice(0, 25).map(q => field(q));
  return { id, platform, url: `http://127.0.0.1:32187/${platform}/manual`, title: title || platforms.find(p => p.id === platform)!.title, context, fields: [...fields, ...extra], capturedAt: new Date().toISOString(), tabId: -1, manual: true };
}

export function personalAnswers(capture: Capture, profile: import("./contracts").Profile): import("./contracts").Answer[] {
  return capture.fields.map(field => {
    const label = field.label.toLowerCase(); let value = "";
    if (/portfolio/.test(label)) value = profile.portfolio;
    else if (/github/.test(label)) value = profile.experience.match(/https:\/\/github\.com\/[A-Za-z0-9_-]+/)?.[0] || "";
    else if (/email|e-mail/.test(label) && (field.type === "email" || /contact|your/.test(label))) value = profile.email;
    else if (/full name|your name|applicant name/.test(label)) value = profile.name;
    else if (/hourly rate/.test(label)) value = profile.rate.match(/USD\s*(\d+(?:\.\d+)?)\s*\/\s*hour/i)?.[1] || "";
    else if (/monthly|salary/.test(label) && /usd|dollar|\$/.test(label)) value = profile.rate.match(/USD\s*(\d+(?:\.\d+)?)\s*\/\s*month/i)?.[1] || "";
    else if (/availability/.test(label)) {
      if (field.type === "select") value = field.options.find(option => /40/.test(option.label))?.value || "";
      else value = profile.availability;
    }
    if (value.length > field.maxLength) value = "";
    return { fieldId: field.id, value, reason: value ? "From your saved personal profile." : "", needsInput: false };
  });
}
