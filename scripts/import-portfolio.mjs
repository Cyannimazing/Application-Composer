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
  availability: "40 hours per week. UTC+8, Philippines. Happy to arrange a call or demo.", rate: "Client-stated rates take priority over the fallback. Only when no client hourly rate is stated, use USD 10/hour by default with a fallback range of USD 8-10/hour. For a client hourly range, choose the lower-middle, about 40% of the way from the minimum to the maximum, then round sensibly within the range. Examples: client USD 20-30/hour -> USD 24/hour; client USD 10-20/hour -> USD 14/hour. Do not default to the lowest or highest rate. If the client states a single fixed hourly rate, use that rate. Treat up-to figures as budget caps rather than fixed rates. For a stated fixed-price or monthly budget, keep proposals within it and base the quote on actual scope and hours. If a monthly salary must be derived without a stated budget, use the applicable hourly rate, stated weekly hours and 52/12 weeks per month. Keep scope and conversion assumptions in applicant-only notes."
};
profile.guidance += " Always include my portfolio https://portfolio-cyannimazing.vercel.app/ and GitHub https://github.com/Cyannimazing in the main application message, even when relevant project URLs are already included. Use a friendly line such as Here is my portfolio for more sample work, followed by the portfolio URL, and a GitHub line. Use technology names only, without version numbers: Laravel, PHP, Next.js, Nuxt, Vue, React, Supabase. Do not write versions such as Laravel 12 or PHP 8.2. Keep URLs and factual requested prices, timelines and hours unchanged. Lead with what I can build for this client, describe 1-2 relevant concrete features naturally, and avoid dumping technical states or generic architecture lists.";
await mkdir(".local", { recursive: true });
await writeFile(".local/profile.json", JSON.stringify(profile, null, 2));
console.log(`Imported portfolio-backed profile with ${sourceProjects.match(/^### \d+\./gm)?.length || 0} projects; CV context ${cv ? "included" : "not yet added"}. Source files were not modified.`);
