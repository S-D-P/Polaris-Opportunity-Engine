-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "country" TEXT,
    "ageRange" TEXT,
    "stage" TEXT,
    "school" TEXT,
    "degree" TEXT,
    "fieldOfStudy" TEXT,
    "graduationYear" INTEGER,
    "academicInterests" TEXT,
    "currentRole" TEXT,
    "industry" TEXT,
    "yearsExperience" INTEGER,
    "skills" TEXT,
    "interests" TEXT,
    "aspirationsRaw" TEXT,
    "aspirationsSummary" TEXT,
    "goalTags" TEXT,
    "remoteOk" BOOLEAN NOT NULL DEFAULT true,
    "hybridOk" BOOLEAN NOT NULL DEFAULT true,
    "inPersonOk" BOOLEAN NOT NULL DEFAULT true,
    "preferredCountries" TEXT,
    "paidOnly" BOOLEAN NOT NULL DEFAULT false,
    "timeCommitment" TEXT,
    "preferredTypes" TEXT,
    "citizenship" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "opportunityType" TEXT NOT NULL,
    "categories" TEXT NOT NULL,
    "fields" TEXT NOT NULL,
    "skills" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "eligibilitySummary" TEXT,
    "minimumAge" INTEGER,
    "maximumAge" INTEGER,
    "educationRequirements" TEXT,
    "experienceRequirements" TEXT,
    "citizenshipRequirements" TEXT,
    "genderRequirement" TEXT,
    "location" TEXT,
    "countries" TEXT NOT NULL,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "hybrid" BOOLEAN NOT NULL DEFAULT false,
    "inPerson" BOOLEAN NOT NULL DEFAULT false,
    "cost" TEXT,
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "funding" TEXT,
    "benefits" TEXT,
    "deadline" DATETIME,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "applicationUrl" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "dateDiscovered" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateUpdated" DATETIME NOT NULL,
    "lastCheckedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "verificationStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "isSeedData" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "aiSummary" TEXT,
    "aiTags" TEXT,
    "aiExtractedRequirements" TEXT,
    "embedding" TEXT,
    "fingerprint" TEXT NOT NULL,
    "duplicateOfId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Opportunity_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "config" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsStored" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsDuplicate" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    CONSTRAINT "IngestionJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackedOpportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SAVED',
    "notes" TEXT,
    "matchScoreSnapshot" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrackedOpportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackedOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchQueryLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "query" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchQueryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Opportunity_opportunityType_idx" ON "Opportunity"("opportunityType");

-- CreateIndex
CREATE INDEX "Opportunity_status_idx" ON "Opportunity"("status");

-- CreateIndex
CREATE INDEX "Opportunity_deadline_idx" ON "Opportunity"("deadline");

-- CreateIndex
CREATE INDEX "Opportunity_verificationStatus_idx" ON "Opportunity"("verificationStatus");

-- CreateIndex
CREATE INDEX "Opportunity_fingerprint_idx" ON "Opportunity"("fingerprint");

-- CreateIndex
CREATE INDEX "TrackedOpportunity_userId_status_idx" ON "TrackedOpportunity"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedOpportunity_userId_opportunityId_key" ON "TrackedOpportunity"("userId", "opportunityId");
