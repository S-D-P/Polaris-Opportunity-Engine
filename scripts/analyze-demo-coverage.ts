// Produces the current-state report requested before the India+global demo dataset expansion
// (docs/demo-dataset-plan.md): counts by status, geography, opportunity type,
// education/career level, and domain, plus a gap calculation against the 150-300 target.
//
// Education/career level and domain have no dedicated schema field — they're derived here by
// keyword-matching the existing free-text targetAudience/educationRequirements/categories/
// fields JSON arrays. This is reporting-only (nothing is written back to the database) and
// deliberately conservative: an opportunity that matches no keyword bucket is counted as
// "unclassified" rather than guessed into one.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_TARGET_MIN = 150;
const DEMO_TARGET_MAX = 300;

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function countBy<T extends string>(items: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item] = (counts[item] ?? 0) + 1;
  return counts;
}

const EDUCATION_LEVEL_KEYWORDS: Record<string, string[]> = {
  high_school: ["high school", "secondary school", "school student"],
  undergraduate: ["undergraduate", "undergrad", "bachelor"],
  postgraduate: ["postgraduate", "graduate student", "master", "phd", "doctoral"],
  recent_graduate: ["recent graduate", "new graduate"],
  early_career: ["early-career", "early career", "entry-level", "entry level"],
  experienced_professional: ["mid-career", "mid career", "experienced", "senior professional"],
  open_to_all: ["any education", "all levels", "open to all", "no formal education"],
};

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  technology: ["technology", "tech", "software", "engineering", "computer science"],
  ai_ml: ["ai", "artificial intelligence", "machine learning", "ml", "deep learning"],
  data_science: ["data science", "data analytics", "data engineering"],
  business: ["business", "management"],
  consulting: ["consulting", "case competition"],
  finance: ["finance", "financial", "banking", "investment"],
  economics: ["economics", "economic policy"],
  policy: ["public policy", "policy"],
  sustainability: ["sustainability", "climate", "environment", "clean energy"],
  entrepreneurship: ["entrepreneurship", "startup", "innovation challenge"],
  research: ["research"],
  leadership: ["leadership"],
  professional_development: ["professional development", "career development"],
};

function bucketByKeywords(haystacks: string[], keywordMap: Record<string, string[]>): string[] {
  const text = haystacks.join(" ").toLowerCase();
  const matched = Object.entries(keywordMap)
    .filter(([, keywords]) => keywords.some((k) => text.includes(k)))
    .map(([bucket]) => bucket);
  return matched.length > 0 ? matched : ["unclassified"];
}

async function main() {
  const opportunities = await prisma.opportunity.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      opportunityType: true,
      geographicScope: true,
      geographicDetail: true,
      targetAudience: true,
      educationRequirements: true,
      categories: true,
      fields: true,
      isSeedData: true,
    },
  });

  console.log(`Total opportunities in database: ${opportunities.length}\n`);

  console.log("=== 1. Counts by status ===");
  console.log(countBy(opportunities.map((o) => o.status)));

  console.log("\n=== 2. Counts by geography (geographicScope) ===");
  console.log(countBy(opportunities.map((o) => o.geographicScope)));
  const withDetail = opportunities.filter((o) => o.geographicDetail);
  if (withDetail.length > 0) {
    console.log("  geographicDetail values in use:", countBy(withDetail.map((o) => o.geographicDetail!)));
  }

  console.log("\n=== 3. Counts by opportunity type ===");
  console.log(countBy(opportunities.map((o) => o.opportunityType)));

  console.log("\n=== 4. Counts by education/career level (keyword-derived from targetAudience/educationRequirements) ===");
  const levelBuckets = opportunities.flatMap((o) =>
    bucketByKeywords([...parseJsonArray(o.targetAudience), ...parseJsonArray(o.educationRequirements)], EDUCATION_LEVEL_KEYWORDS)
  );
  console.log(countBy(levelBuckets));

  console.log("\n=== 5. Counts by domain (keyword-derived from categories/fields) ===");
  const domainBuckets = opportunities.flatMap((o) =>
    bucketByKeywords([...parseJsonArray(o.categories), ...parseJsonArray(o.fields)], DOMAIN_KEYWORDS)
  );
  console.log(countBy(domainBuckets));

  const activeIsh = opportunities.filter((o) => o.status === "OPEN" || o.status === "CLOSING_SOON");
  const seedOrDemo = opportunities.filter((o) => o.isSeedData);
  const real = opportunities.filter((o) => !o.isSeedData);

  console.log("\n=== 6. Gap to demo target ===");
  console.log(`  Total opportunities: ${opportunities.length} (${real.length} real/ingested, ${seedOrDemo.length} seed/demo)`);
  console.log(`  Active/closing-soon (the population the 150-300 target is really about): ${activeIsh.length}`);
  console.log(`  Target range: ${DEMO_TARGET_MIN}-${DEMO_TARGET_MAX}`);
  console.log(`  Gap to minimum (${DEMO_TARGET_MIN}): ${Math.max(0, DEMO_TARGET_MIN - activeIsh.length)}`);
  console.log(`  Gap to maximum (${DEMO_TARGET_MAX}): ${Math.max(0, DEMO_TARGET_MAX - activeIsh.length)}`);
  console.log(
    `  India-eligible today (INDIA_ONLY + GLOBAL + REMOTE_GLOBAL): ${
      opportunities.filter((o) => ["INDIA_ONLY", "GLOBAL", "REMOTE_GLOBAL"].includes(o.geographicScope)).length
    }`
  );
  console.log(`  India-specific today (INDIA_ONLY): ${opportunities.filter((o) => o.geographicScope === "INDIA_ONLY").length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
