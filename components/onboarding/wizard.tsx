"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import {
  INTEREST_TAGS,
  OPPORTUNITY_TYPE_LABELS,
  USER_SELECTABLE_OPPORTUNITY_TYPES,
  STAGES,
  STAGE_LABELS,
  TIME_COMMITMENTS,
} from "@/lib/taxonomy";

export interface OnboardingData {
  name: string;
  country: string;
  ageRange: string;
  stage: string;
  gender: string;
  school: string;
  degree: string;
  fieldOfStudy: string;
  graduationYear?: number;
  academicInterests: string[];
  currentRole: string;
  industry: string;
  yearsExperience?: number;
  skills: string[];
  technologies: string[];
  interests: string[];
  aspirationsRaw: string;
  remoteOk: boolean;
  hybridOk: boolean;
  inPersonOk: boolean;
  preferredCountries: string[];
  paidOnly: boolean;
  timeCommitment: string;
  preferredTypes: string[];
  citizenship: string;
}

const STEP_TITLES = [
  "The basics",
  "Education",
  "Professional background",
  "What are you interested in?",
  "Where do you want to go?",
  "Preferences",
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-foreground-muted hover:border-primary"
      }`}
    >
      {children}
    </button>
  );
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function OnboardingWizard({
  initialStep,
  initialData,
  completeRedirect = "/feed",
}: {
  initialStep: number;
  initialData: OnboardingData;
  completeRedirect?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, 5));
  const [data, setData] = useState<OnboardingData>(initialData);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function persist(partial: Partial<OnboardingData> & { onboardingStep?: number; onboardingComplete?: boolean }) {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
  }

  async function goNext() {
    setSaving(true);
    const nextStep = Math.min(step + 1, 5);
    try {
      await persist(stepPayload(step, data, nextStep));
    } finally {
      setSaving(false);
    }
    if (step === 5) {
      await persist({ onboardingComplete: true });
      router.push(completeRedirect);
      router.refresh();
      return;
    }
    setStep(nextStep);
  }

  function goBack() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <div>
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-xs text-foreground-muted">
          <span>
            Step {step + 1} of {STEP_TITLES.length}
          </span>
          <span>{Math.round(((step + 1) / STEP_TITLES.length) * 100)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
          />
        </div>
      </div>

      <h1 className="font-display text-2xl text-foreground">{STEP_TITLES[step]}</h1>

      <div className="mt-6 space-y-5">
        {step === 0 && (
          <>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={data.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="country">Location / country</Label>
              <Input
                id="country"
                value={data.country}
                onChange={(e) => update("country", e.target.value)}
                placeholder="e.g. India"
              />
            </div>
            <div>
              <Label htmlFor="citizenship">Citizenship</Label>
              <Input
                id="citizenship"
                value={data.citizenship}
                onChange={(e) => update("citizenship", e.target.value)}
                placeholder="Used to check eligibility for opportunities with citizenship requirements"
              />
            </div>
            <div>
              <Label htmlFor="ageRange">Age range</Label>
              <Select id="ageRange" value={data.ageRange} onChange={(e) => update("ageRange", e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="13-17">13-17</option>
                <option value="18-21">18-21</option>
                <option value="22-25">22-25</option>
                <option value="26-30">26-30</option>
                <option value="31-40">31-40</option>
                <option value="41-100">41+</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="stage">Current stage</Label>
              <Select id="stage" value={data.stage} onChange={(e) => update("stage", e.target.value)}>
                <option value="">Select one</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select id="gender" value={data.gender} onChange={(e) => update("gender", e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="woman">Woman</option>
                <option value="man">Man</option>
                <option value="non-binary">Non-binary</option>
                <option value="self-describe">Self-describe</option>
              </Select>
              <p className="mt-1.5 text-xs text-foreground-muted">
                Only used to surface opportunities whose eligibility is explicitly restricted
                by gender. It&apos;s never shared or shown to anyone else.
              </p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <Label htmlFor="school">School / university</Label>
              <Input id="school" value={data.school} onChange={(e) => update("school", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="degree">Degree</Label>
              <Input id="degree" value={data.degree} onChange={(e) => update("degree", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fieldOfStudy">Field of study</Label>
              <Input
                id="fieldOfStudy"
                value={data.fieldOfStudy}
                onChange={(e) => update("fieldOfStudy", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="graduationYear">Graduation year</Label>
              <Input
                id="graduationYear"
                type="number"
                value={data.graduationYear ?? ""}
                onChange={(e) => update("graduationYear", e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div>
              <Label htmlFor="academicInterests">Academic interests</Label>
              <TagInput
                id="academicInterests"
                value={data.academicInterests}
                onChange={(v) => update("academicInterests", v)}
                placeholder="Type a field and press Enter (e.g. Computer Science, Public Policy)"
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <Label htmlFor="currentRole">Current role</Label>
              <Input
                id="currentRole"
                value={data.currentRole}
                onChange={(e) => update("currentRole", e.target.value)}
                placeholder="e.g. Software Engineer, or leave blank if you're a student"
              />
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" value={data.industry} onChange={(e) => update("industry", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="yearsExperience">Years of experience</Label>
              <Input
                id="yearsExperience"
                type="number"
                min={0}
                value={data.yearsExperience ?? ""}
                onChange={(e) =>
                  update("yearsExperience", e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </div>
            <div>
              <Label htmlFor="skills">Skills</Label>
              <TagInput
                id="skills"
                value={data.skills}
                onChange={(v) => update("skills", v)}
                placeholder="e.g. Leadership, Research, Public Speaking"
              />
            </div>
            <div>
              <Label htmlFor="technologies">Technologies & tools</Label>
              <TagInput
                id="technologies"
                value={data.technologies}
                onChange={(v) => update("technologies", v)}
                placeholder="e.g. Python, React, AWS"
              />
            </div>
          </>
        )}

        {step === 3 && (
          <div>
            <p className="mb-3 text-sm text-foreground-muted">Select all that apply.</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_TAGS.map((tag) => (
                <Chip
                  key={tag}
                  active={data.interests.includes(tag)}
                  onClick={() => update("interests", toggle(data.interests, tag))}
                >
                  {tag}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <Label htmlFor="aspirations">Tell Polaris where you want to go</Label>
            <Textarea
              id="aspirations"
              value={data.aspirationsRaw}
              onChange={(e) => update("aspirationsRaw", e.target.value)}
              placeholder="e.g. I want to eventually work in AI policy and build a career combining technology and public policy."
              rows={6}
            />
            <p className="mt-2 text-xs text-foreground-muted">
              Write naturally. Polaris uses this to understand your goals, not just your keywords.
            </p>
          </div>
        )}

        {step === 5 && (
          <>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Where would you work/study?</p>
              <div className="flex flex-wrap gap-2">
                <Chip active={data.remoteOk} onClick={() => update("remoteOk", !data.remoteOk)}>
                  Remote
                </Chip>
                <Chip active={data.hybridOk} onClick={() => update("hybridOk", !data.hybridOk)}>
                  Hybrid
                </Chip>
                <Chip active={data.inPersonOk} onClick={() => update("inPersonOk", !data.inPersonOk)}>
                  In-person
                </Chip>
              </div>
            </div>
            <div>
              <Label htmlFor="preferredCountries">Preferred countries/regions</Label>
              <TagInput
                id="preferredCountries"
                value={data.preferredCountries}
                onChange={(v) => update("preferredCountries", v)}
                placeholder="Type a country and press Enter, or leave blank for anywhere"
              />
            </div>
            <div>
              <Label htmlFor="timeCommitment">Time commitment</Label>
              <Select
                id="timeCommitment"
                value={data.timeCommitment}
                onChange={(e) => update("timeCommitment", e.target.value)}
              >
                <option value="">No preference</option>
                {TIME_COMMITMENTS.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/-/g, " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Opportunity types you care about</p>
              <div className="flex flex-wrap gap-2">
                {USER_SELECTABLE_OPPORTUNITY_TYPES.map((t) => (
                  <Chip
                    key={t}
                    active={data.preferredTypes.includes(t)}
                    onClick={() => update("preferredTypes", toggle(data.preferredTypes, t))}
                  >
                    {OPPORTUNITY_TYPE_LABELS[t]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Chip active={data.paidOnly} onClick={() => update("paidOnly", !data.paidOnly)}>
                {data.paidOnly ? "Only show free opportunities ✓" : "Only show free opportunities"}
              </Chip>
            </div>
          </>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <Button variant="ghost" onClick={goBack} disabled={step === 0 || saving}>
          Back
        </Button>
        <Button onClick={goNext} disabled={saving}>
          {saving ? "Saving…" : step === 5 ? "See my feed" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function stepPayload(step: number, data: OnboardingData, nextStep: number) {
  const base = { onboardingStep: nextStep };
  switch (step) {
    case 0:
      return {
        ...base,
        name: data.name,
        country: data.country,
        citizenship: data.citizenship,
        ageRange: data.ageRange || undefined,
        stage: (data.stage || undefined) as never,
        gender: data.gender || undefined,
      };
    case 1:
      return {
        ...base,
        school: data.school,
        degree: data.degree,
        fieldOfStudy: data.fieldOfStudy,
        graduationYear: data.graduationYear,
        academicInterests: data.academicInterests,
      };
    case 2:
      return {
        ...base,
        currentRole: data.currentRole,
        industry: data.industry,
        yearsExperience: data.yearsExperience,
        skills: data.skills,
        technologies: data.technologies,
      };
    case 3:
      return { ...base, interests: data.interests };
    case 4:
      return { ...base, aspirationsRaw: data.aspirationsRaw };
    case 5:
      return {
        ...base,
        remoteOk: data.remoteOk,
        hybridOk: data.hybridOk,
        inPersonOk: data.inPersonOk,
        preferredCountries: data.preferredCountries,
        timeCommitment: (data.timeCommitment || undefined) as never,
        preferredTypes: data.preferredTypes as never,
        paidOnly: data.paidOnly,
      };
    default:
      return base;
  }
}
