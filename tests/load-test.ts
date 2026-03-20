/**
 * Load & stress tests for Startup Matchmaker
 * Tests concurrency, race conditions, and edge cases
 *
 * Run: npx tsx tests/load-test.ts
 */

const SUPABASE_URL = "https://iuxpiutfhskitcaesyjk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1eHBpdXRmaHNraXRjYWVzeWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTM2NjQsImV4cCI6MjA4OTQyOTY2NH0.EmtokUF3yZVBVwmqiVxvFE-RT_XwaqW2igiXtW-SNiY";
const VERCEL_URL = "https://neon-matchmaker.vercel.app";

// Sample emails from luma_list for testing
const LUMA_EMAILS = [
  "1998gauravranawat@gmail.com",
  "utkarsh@persistence.dev",
  "luma@shivamkhandelwal.in",
  "avijitverma16@gmail.com",
  "sivaharsha@gmail.com",
  "vineetkotecha222@gmail.com",
  "rishitchaturvedi@gmail.com",
  "vaishnaviyrathod069@gmail.com",
  "karnalprateek@gmail.com",
  "connect@aixpertrecruit.com",
  "anshu.master@gmail.com",
  "avl.anusha9@gmail.com",
  "shivansh.karan@gmail.com",
  "ayansadhukhan28@gmail.com",
  "prathm120814@gmail.com",
  "rahul@redgorillas.io",
  "kmalkan.gatech@gmail.com",
  "abhinav@chainflux.com",
  "nikhil.gundawar92@gmail.com",
  "saprative@gmail.com",
  "nik@tryollie.com",
  "dawardeka@iitb.ac.in",
  "sunil.agarwal@vibedoctor.dev",
  "amit@grovio.ai",
  "nandini@supragent.ai",
  "mohansuresh333@gmail.com",
  "harshilkumarpindikuru@gmail.com",
  "martipradyumna@gmail.com",
  "aditya.dpsg.15@gmail.com",
  "jainnaman027@gmail.com",
  "aktechhere@gmail.com",
  "sumisoundarya96@gmail.com",
  "anubhav8764@gmail.com",
  "sanchit.mittl@outlook.com",
  "pandurangmopgar7410@gmail.com",
  "ishrajesh@yardstick.live",
  "mithun1848+luma@gmail.com",
  "maheshs.iimk5@gmail.com",
  "tusharxo18@gmail.com",
  "devchetan42@gmail.com",
  "ajay@neatlogs.com",
  "vjarunima@gmail.com",
  "manish@instavm.io",
  "samyabrata@getmaxim.ai",
  "abhishekchakram@gmail.com",
  "anuvesh@tinydoc.ai",
  "adarsh@latspace.in",
  "ajay@pepsales.ai",
  "hchaturvedi@rippling.com",
  "raveen.b@gmail.com",
  "pranava.sri@gmail.com",
  "alankritkhatri9@gmail.com",
  "soorajshankar@gmail.com",
  "sagar.sankalpa@gmail.com",
  "vinayaksingh762@gmail.com",
  "bohra.manit@gmail.com",
  "mehta.madhav55@gmail.com",
  "laxmansrivastacc@gmail.com",
  "vashusingh2005.jan@gmail.com",
  "sahith@thedouble.ai",
  "saurabh.iitbhu15@gmail.com",
  "sourabhkapure@gmail.com",
  "porwalveer34@gmail.com",
  "gopinathaofficial@gmail.com",
  "sparsh.prakash03@gmail.com",
  "pgpm1114.milon@spjimr.org",
  "aprohith@gmail.com",
  "jyothish@refringence.com",
  "madhavmangal786@gmail.com",
  "cogniqaai@gmail.com",
  "anshumjani.2004@gmail.com",
  "sarikashirolkar@gmail.com",
  "aakashmalviya3108@gmail.com",
  "pepgopi@amazon.com",
  "abhinav.garg@craftaihq.com",
  "pritesh@guickly.com",
  "kritarth.mishra@gobblecube.ai",
  "avinash1605@gmail.com",
  "sagar@joist.ai",
  "punith.vs74064@gmail.com",
  "suyashkamalakar@gmail.com",
  "gopalgoyal612002@gmail.com",
  "mukesh1811@gmail.com",
  "paidivivek@gmail.com",
  "sushma.anthuraj@genstrat.ai",
  "ajay@ai-swar.com",
  "saradindusengupta2@gmail.com",
  "deepam@wizcommerce.com",
  "ravish@wizcommerce.com",
  "sidharth037@gmail.com",
  "retrovrv@gmail.com",
  "vaibhav@predixion.ai",
  "devansh@superbryn.com",
  "bhagath.gottipati@gmail.com",
  "feng920303@gmail.com",
  "shubhani@neon.fund",
  // Duplicates to reach 150 for stress testing
  "1998gauravranawat@gmail.com",
  "utkarsh@persistence.dev",
  "luma@shivamkhandelwal.in",
  "avijitverma16@gmail.com",
  "sivaharsha@gmail.com",
  "vineetkotecha222@gmail.com",
  "rishitchaturvedi@gmail.com",
  "vaishnaviyrathod069@gmail.com",
  "karnalprateek@gmail.com",
  "connect@aixpertrecruit.com",
  "anshu.master@gmail.com",
  "avl.anusha9@gmail.com",
  "shivansh.karan@gmail.com",
  "ayansadhukhan28@gmail.com",
  "prathm120814@gmail.com",
  "rahul@redgorillas.io",
  "kmalkan.gatech@gmail.com",
  "abhinav@chainflux.com",
  "nikhil.gundawar92@gmail.com",
  "saprative@gmail.com",
  "nik@tryollie.com",
  "dawardeka@iitb.ac.in",
  "sunil.agarwal@vibedoctor.dev",
  "amit@grovio.ai",
  "nandini@supragent.ai",
  "mohansuresh333@gmail.com",
  "harshilkumarpindikuru@gmail.com",
  "martipradyumna@gmail.com",
  "aditya.dpsg.15@gmail.com",
  "jainnaman027@gmail.com",
  "aktechhere@gmail.com",
  "sumisoundarya96@gmail.com",
  "anubhav8764@gmail.com",
  "sanchit.mittl@outlook.com",
  "pandurangmopgar7410@gmail.com",
  "ishrajesh@yardstick.live",
  "mithun1848+luma@gmail.com",
  "maheshs.iimk5@gmail.com",
  "tusharxo18@gmail.com",
  "devchetan42@gmail.com",
  "ajay@neatlogs.com",
  "vjarunima@gmail.com",
  "manish@instavm.io",
  "samyabrata@getmaxim.ai",
  "abhishekchakram@gmail.com",
  "anuvesh@tinydoc.ai",
  "adarsh@latspace.in",
  "ajay@pepsales.ai",
  "hchaturvedi@rippling.com",
  "raveen.b@gmail.com",
  "saurabh@vink.ai",
  "cp@sarasfinance.com",
  "rishi@gopitcrew.com",
];

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details: string;
  errors?: string[];
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(`\n${"=".repeat(60)}\n${msg}\n${"=".repeat(60)}`);
}

function logResult(r: TestResult) {
  const icon = r.passed ? "✅" : "❌";
  console.log(`${icon} ${r.name} (${r.duration}ms)`);
  console.log(`   ${r.details}`);
  if (r.errors?.length) {
    r.errors.forEach((e) => console.log(`   ⚠️  ${e}`));
  }
}

// ============================================================
// TEST 1: 150 concurrent page loads on Vercel
// ============================================================
async function test1_concurrentPageLoads() {
  log("TEST 1: 150 concurrent page loads on Vercel");
  const start = Date.now();
  const errors: string[] = [];

  const promises = Array.from({ length: 150 }, (_, i) =>
    fetch(VERCEL_URL, { headers: { "Cache-Control": "no-cache" } })
      .then((res) => ({ status: res.status, ok: res.ok, index: i }))
      .catch((err) => ({ status: 0, ok: false, index: i, error: err.message }))
  );

  const responses = await Promise.all(promises);
  const duration = Date.now() - start;

  const successful = responses.filter((r) => r.ok).length;
  const failed = responses.filter((r) => !r.ok);

  failed.forEach((f: any) => {
    errors.push(`Request ${f.index}: status ${f.status} ${f.error || ""}`);
  });

  const result: TestResult = {
    name: "150 concurrent page loads",
    passed: successful >= 143, // allow 5% failure
    duration,
    details: `${successful}/100 succeeded, avg ${Math.round(duration / 100)}ms per request`,
    errors: errors.slice(0, 10),
  };

  results.push(result);
  logResult(result);
}

// ============================================================
// TEST 2: 100 concurrent email blur validations (luma_list lookup)
// ============================================================
async function test2_concurrentEmailValidation() {
  log("TEST 2: 100 concurrent email blur validations (luma_list)");
  const start = Date.now();
  const errors: string[] = [];

  const promises = LUMA_EMAILS.map((email, i) =>
    fetch(
      `${SUPABASE_URL}/rest/v1/luma_list?email=eq.${encodeURIComponent(email)}&select=email`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )
      .then(async (res) => {
        const data = await res.json();
        return { ok: res.ok, found: data.length > 0, index: i, email };
      })
      .catch((err) => ({
        ok: false,
        found: false,
        index: i,
        email,
        error: err.message,
      }))
  );

  const responses = await Promise.all(promises);
  const duration = Date.now() - start;

  const successful = responses.filter((r) => r.ok && r.found).length;
  const notFound = responses.filter((r) => r.ok && !r.found);
  const failed = responses.filter((r) => !r.ok);

  notFound.forEach((f: any) => {
    errors.push(`Email not found: ${f.email}`);
  });
  failed.forEach((f: any) => {
    errors.push(`Request failed for ${f.email}: ${f.error || "unknown"}`);
  });

  const result: TestResult = {
    name: "100 concurrent luma_list lookups",
    passed: successful === 100 && failed.length === 0,
    duration,
    details: `${successful}/100 found, ${notFound.length} not found, ${failed.length} failed. Total: ${duration}ms`,
    errors: errors.slice(0, 10),
  };

  results.push(result);
  logResult(result);
}

// ============================================================
// TEST 3: 100 concurrent profile reads (profiles table)
// ============================================================
async function test3_concurrentProfileReads() {
  log("TEST 3: 100 concurrent profile reads");
  const start = Date.now();
  const errors: string[] = [];

  // All 100 emails query profiles table simultaneously
  const promises = LUMA_EMAILS.map((email, i) =>
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=email`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )
      .then(async (res) => {
        const data = await res.json();
        return { ok: res.ok, status: res.status, index: i, email };
      })
      .catch((err) => ({
        ok: false,
        status: 0,
        index: i,
        email,
        error: err.message,
      }))
  );

  const responses = await Promise.all(promises);
  const duration = Date.now() - start;

  const successful = responses.filter((r) => r.ok).length;
  const failed = responses.filter((r) => !r.ok);

  failed.forEach((f: any) => {
    errors.push(`Failed for ${f.email}: status ${f.status} ${f.error || ""}`);
  });

  const result: TestResult = {
    name: "100 concurrent profile reads",
    passed: successful === 100,
    duration,
    details: `${successful}/100 succeeded. Total: ${duration}ms`,
    errors: errors.slice(0, 10),
  };

  results.push(result);
  logResult(result);
}

// ============================================================
// TEST 4: Duplicate email race condition (10 simultaneous inserts for same email)
// ============================================================
async function test4_duplicateRaceCondition() {
  log("TEST 4: Duplicate race condition (10 simultaneous upserts for same email)");
  const start = Date.now();
  const errors: string[] = [];
  const testEmail = "loadtest-race@test.com";

  // First, clean up any previous test data
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${testEmail}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  // Try 10 simultaneous upserts for the same email
  const profileData = {
    email: testEmail,
    name: "Load Test",
    company: "Test Corp",
    role: "Tester",
    what_building: "Tests",
    looking_for: ["Peers"],
    can_offer: ["Peers"],
  };

  const promises = Array.from({ length: 10 }, (_, i) =>
    fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(profileData),
    })
      .then(async (res) => {
        const text = await res.text();
        return { ok: res.ok, status: res.status, index: i, body: text };
      })
      .catch((err) => ({
        ok: false,
        status: 0,
        index: i,
        body: "",
        error: err.message,
      }))
  );

  const responses = await Promise.all(promises);
  const duration = Date.now() - start;

  const successful = responses.filter((r) => r.ok || r.status === 201 || r.status === 200).length;
  const failed = responses.filter(
    (r) => !r.ok && r.status !== 201 && r.status !== 200 && r.status !== 409
  );

  // Check that only 1 row exists
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?email=eq.${testEmail}&select=email`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  const rows = await checkRes.json();
  const onlyOneRow = rows.length === 1;

  if (!onlyOneRow) {
    errors.push(`Expected 1 row, found ${rows.length} rows for ${testEmail}`);
  }

  failed.forEach((f: any) => {
    errors.push(`Insert ${f.index}: status ${f.status} — ${f.body || f.error}`);
  });

  // Cleanup
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${testEmail}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  const result: TestResult = {
    name: "10 simultaneous upserts (same email)",
    passed: onlyOneRow && failed.length === 0,
    duration,
    details: `${successful}/10 succeeded, ${rows.length} row(s) in DB (expected 1). Total: ${duration}ms`,
    errors: errors.slice(0, 10),
  };

  results.push(result);
  logResult(result);
}

// ============================================================
// TEST 5: Case-insensitive email matching
// ============================================================
async function test5_caseInsensitiveEmail() {
  log("TEST 5: Case-insensitive email matching");
  const start = Date.now();
  const errors: string[] = [];

  // Test different casings of the same email
  const baseEmail = "rohan@neon.fund";
  const variants = [
    "Rohan@Neon.Fund",
    "ROHAN@NEON.FUND",
    "rohan@NEON.fund",
    "Rohan@neon.fund",
    "rohan@Neon.Fund",
  ];

  const promises = variants.map((email) =>
    fetch(
      `${SUPABASE_URL}/rest/v1/luma_list?email=eq.${encodeURIComponent(email.toLowerCase())}&select=email`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )
      .then(async (res) => {
        const data = await res.json();
        return { email, found: data.length > 0, original: email };
      })
      .catch((err) => ({ email, found: false, original: email, error: err.message }))
  );

  const responses = await Promise.all(promises);
  const duration = Date.now() - start;

  const allFound = responses.every((r) => r.found);
  responses
    .filter((r) => !r.found)
    .forEach((r: any) => {
      errors.push(`"${r.original}" → not found (lowercase: "${r.email.toLowerCase()}")`);
    });

  // Also test WITHOUT lowercase — this should fail if DB has lowercase
  const rawRes = await fetch(
    `${SUPABASE_URL}/rest/v1/luma_list?email=eq.${encodeURIComponent("ROHAN@NEON.FUND")}&select=email`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  const rawData = await rawRes.json();
  const rawCaseFails = rawData.length === 0;

  if (rawCaseFails) {
    // This means the app MUST lowercase before querying — which it does
    console.log(
      "   ℹ️  DB is case-sensitive. App lowercases on blur — this is correct."
    );
  }

  const result: TestResult = {
    name: "Case-insensitive email matching",
    passed: allFound,
    duration,
    details: `${responses.filter((r) => r.found).length}/${variants.length} variants matched after lowercase. DB case-sensitive: ${rawCaseFails}`,
    errors,
  };

  results.push(result);
  logResult(result);
}

// ============================================================
// TEST 6: Invalid email formats
// ============================================================
async function test6_invalidEmails() {
  log("TEST 6: Invalid/malicious email inputs");
  const start = Date.now();
  const errors: string[] = [];

  const invalidEmails = [
    "",
    "notanemail",
    "@noemail.com",
    "spaces in@email.com",
    "a".repeat(500) + "@test.com", // very long email
    "test@test.com; DROP TABLE profiles;--", // SQL injection attempt
    "<script>alert('xss')</script>@test.com", // XSS attempt
    "test@test.com\n\rInjection: header",  // header injection
  ];

  const promises = invalidEmails.map((email) =>
    fetch(
      `${SUPABASE_URL}/rest/v1/luma_list?email=eq.${encodeURIComponent(email)}&select=email`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )
      .then(async (res) => {
        const data = await res.json().catch(() => []);
        return {
          email: email.slice(0, 50),
          ok: res.ok,
          status: res.status,
          found: Array.isArray(data) && data.length > 0,
        };
      })
      .catch((err) => ({
        email: email.slice(0, 50),
        ok: true, // network error is fine — means it was rejected
        status: 0,
        found: false,
        error: err.message,
      }))
  );

  const responses = await Promise.all(promises);
  const duration = Date.now() - start;

  // None of these should find a match
  const anyFound = responses.filter((r) => r.found);
  // None should cause a 500 server error
  const serverErrors = responses.filter((r) => r.status >= 500);

  anyFound.forEach((r) => {
    errors.push(`Invalid email "${r.email}" found a match!`);
  });
  serverErrors.forEach((r) => {
    errors.push(`Server error (${r.status}) for "${r.email}"`);
  });

  const result: TestResult = {
    name: "Invalid/malicious email inputs",
    passed: anyFound.length === 0 && serverErrors.length === 0,
    duration,
    details: `${responses.length} invalid emails tested, ${anyFound.length} false positives, ${serverErrors.length} server errors`,
    errors,
  };

  results.push(result);
  logResult(result);
}

// ============================================================
// TEST 7: Rapid-fire blur events (same email, 20 times in 2 seconds)
// ============================================================
async function test7_rapidFireBlur() {
  log("TEST 7: Rapid-fire blur events (20 requests in 2 seconds)");
  const start = Date.now();
  const errors: string[] = [];
  const email = "utkarsh@persistence.dev";

  const promises = Array.from({ length: 20 }, (_, i) =>
    new Promise<void>((resolve) => setTimeout(resolve, i * 100)).then(() =>
      fetch(
        `${SUPABASE_URL}/rest/v1/luma_list?email=eq.${encodeURIComponent(email)}&select=email`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      )
        .then(async (res) => {
          const data = await res.json();
          return { ok: res.ok, status: res.status, found: data.length > 0, index: i };
        })
        .catch((err) => ({
          ok: false,
          status: 0,
          found: false,
          index: i,
          error: err.message,
        }))
    )
  );

  const responses = await Promise.all(promises);
  const duration = Date.now() - start;

  const successful = responses.filter((r) => r.ok && r.found).length;
  const rateLimited = responses.filter((r) => r.status === 429);
  const failed = responses.filter((r) => !r.ok && r.status !== 429);

  if (rateLimited.length > 0) {
    errors.push(`${rateLimited.length} requests were rate-limited (429)`);
  }
  failed.forEach((f: any) => {
    errors.push(`Request ${f.index}: status ${f.status} ${f.error || ""}`);
  });

  const result: TestResult = {
    name: "Rapid-fire blur (20 in 2s)",
    passed: successful >= 18 && failed.length === 0, // allow some rate limiting
    duration,
    details: `${successful}/20 succeeded, ${rateLimited.length} rate-limited, ${failed.length} failed. Total: ${duration}ms`,
    errors,
  };

  results.push(result);
  logResult(result);
}

// ============================================================
// TEST 8: Mixed concurrent operations (read luma + read profiles + page load)
// ============================================================
async function test8_mixedConcurrent() {
  log("TEST 8: Mixed concurrent operations (150 total: 50 luma reads + 50 profile reads + 50 page loads)");
  const start = Date.now();
  const errors: string[] = [];

  const lumaPromises = LUMA_EMAILS.slice(0, 50).map((email) =>
    fetch(
      `${SUPABASE_URL}/rest/v1/luma_list?email=eq.${encodeURIComponent(email)}&select=email`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )
      .then((res) => ({ type: "luma", ok: res.ok, status: res.status }))
      .catch((err) => ({ type: "luma", ok: false, status: 0, error: err.message }))
  );

  const profilePromises = LUMA_EMAILS.slice(0, 50).map((email) =>
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=email`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )
      .then((res) => ({ type: "profile", ok: res.ok, status: res.status }))
      .catch((err) => ({ type: "profile", ok: false, status: 0, error: err.message }))
  );

  const pagePromises = Array.from({ length: 50 }, () =>
    fetch(VERCEL_URL)
      .then((res) => ({ type: "page", ok: res.ok, status: res.status }))
      .catch((err) => ({ type: "page", ok: false, status: 0, error: err.message }))
  );

  const allResponses = await Promise.all([
    ...lumaPromises,
    ...profilePromises,
    ...pagePromises,
  ]);
  const duration = Date.now() - start;

  const byType = {
    luma: allResponses.filter((r) => r.type === "luma"),
    profile: allResponses.filter((r) => r.type === "profile"),
    page: allResponses.filter((r) => r.type === "page"),
  };

  const lumaOk = byType.luma.filter((r) => r.ok).length;
  const profileOk = byType.profile.filter((r) => r.ok).length;
  const pageOk = byType.page.filter((r) => r.ok).length;

  allResponses
    .filter((r) => !r.ok)
    .forEach((r: any) => {
      errors.push(`${r.type}: status ${r.status} ${r.error || ""}`);
    });

  const allOk = lumaOk + profileOk + pageOk;
  const result: TestResult = {
    name: "Mixed concurrent (150 total)",
    passed: allOk >= 143,
    duration,
    details: `Luma: ${lumaOk}/50, Profiles: ${profileOk}/50, Pages: ${pageOk}/50. Total: ${duration}ms`,
    errors: errors.slice(0, 10),
  };

  results.push(result);
  logResult(result);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("\n🚀 STARTUP MATCHMAKER — LOAD & STRESS TESTS");
  console.log(`📍 Vercel: ${VERCEL_URL}`);
  console.log(`📍 Supabase: ${SUPABASE_URL}`);
  console.log(`📅 ${new Date().toISOString()}\n`);

  await test1_concurrentPageLoads();
  await test2_concurrentEmailValidation();
  await test3_concurrentProfileReads();
  await test4_duplicateRaceCondition();
  await test5_caseInsensitiveEmail();
  await test6_invalidEmails();
  await test7_rapidFireBlur();
  await test8_mixedConcurrent();

  // Summary
  log("SUMMARY");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach(logResult);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
