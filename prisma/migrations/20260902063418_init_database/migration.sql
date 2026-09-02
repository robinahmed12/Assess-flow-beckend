-- CreateTable
CREATE TABLE "DatabaseTest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatabaseTest_pkey" PRIMARY KEY ("id")
);
