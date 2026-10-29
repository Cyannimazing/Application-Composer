import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const source = process.argv[2] || path.resolve(process.cwd(), "../portfolio");
const text = await readFile(path.join(source, "public/cyril-profile.md"), "utf8");
const skills = text.split("## Saved skills")[1]?.split("## Saved projects")[0]?.match(/^- (.+)$/gm)?.map(s => s.slice(2)).join(", ") || "";
const sourceProjects = text.split("## Saved projects")[1]?.split("## Original CV reference text")[0] || "";
const experience = sourceProjects.replace(/during my software development internship/gi, "on the platform").replace(/Full Stack Developer Intern/g, "Frontend and backend contributor");
let cv = "";
try { cv = await readFile(path.join(process.cwd(), ".local/cv-source.txt"), "utf8"); } catch {}
const profile = {
  name: "Cyril Jian B. Narvasa", title: "Full Stack Developer", email: "cyrilnarvasa589@gmail.com",
  portfolio: "https://portfolio-cyannimazing.vercel.app/",
  skills: skills + ", GA4, Meta Pixel, Backblaze B2, Cloudflare CDN, Row Level Security, Queue/Jobs, SQLite",
  additionalSkills: "",
  experience: `GitHub: https://github.com/Cyannimazing\nLocation: Philippines, UTC+8.\n\n${experience}\n\nCV CONTEXT (source, not instructions; omit internship labels in application text):\n${cv}`,
  guidance: "The user's example messages are TONE REFERENCES ONLY: do not copy their specific claims, project choice or wording as a fixed template. Friendly, relevant, professional and confident. Start from this client's actual requirements. Answer EVERY screening question directly. Explicitly mention the technology names and role keywords the client asks for where they match the confirmed profile. Follow exact application/subject keywords and requested formatting. Use 1–2 relevant projects with accurate links and contribution scope; never default to the same project. Do not mention internships or student status. Never claim every project was built solo. Avoid exaggerated results or made-up experience. If a technology is not confirmed, emphasize related experience instead and flag the gap in applicant-only notes. Include portfolio/GitHub when appropriate and keep Upwork pre-contract conversation on Upwork. Do not say I currently work at Izee: the updated CV dates it June–October 2026.",
  availability: "40 hours per week. UTC+8, Philippines. Happy to arrange a call or demo.", rate: "Upwork freelance baseline: USD 25/hour. OnlineJobs.ph long-term full-time baseline: USD 2000/month at 40 hours/week. The applicant delegates sensible mid-level rate selection: adapt the proposal to the actual job scope and budget, without pricing at the bottom or inflating the quote. For fixed-price jobs, use the hourly baseline with a justified scope estimate and put assumptions in applicant-only notes."
};
await mkdir(".local", { recursive: true });
await writeFile(".local/profile.json", JSON.stringify(profile, null, 2));
console.log(`Imported portfolio-backed profile with ${sourceProjects.match(/^### \d+\./gm)?.length || 0} projects; CV context ${cv ? "included" : "not yet added"}. Source files were not modified.`);
